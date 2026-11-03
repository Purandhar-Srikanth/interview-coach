"""FastAPI entry point: the JSON API lives under /api, everything else is the built React app."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import interview, progress, resume, sessions
from app.config import ROOT_DIR, get_settings
from app.db import SessionLocal, init_db
from app.guard import purge_old_data
from app.security import SecurityMiddleware

FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with SessionLocal() as db:
        purge_old_data(db, force=True)  # demo only: delete data older than the retention period
    yield


# The interactive API docs (/docs, /redoc, /openapi.json) are handy locally but would publish
# a map of the API on the live demo, so they're turned off in demo mode.
_show_docs = not get_settings().demo_mode
app = FastAPI(
    title="Interview Coach",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if _show_docs else None,
    redoc_url="/redoc" if _show_docs else None,
    openapi_url="/openapi.json" if _show_docs else None,
)
app.add_middleware(SecurityMiddleware)
app.include_router(resume.router)
app.include_router(sessions.router)
app.include_router(interview.router)
app.include_router(progress.router)


@app.get("/api/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "version": app.version,
        "demo_mode": settings.demo_mode,
        "llm_mode": settings.llm_mode,
        "llm_configured": settings.llm_mode == "mock" or settings.openai_api_key is not None,
    }


# Serve the React build (only exists after `npm run build`). In development, Vite serves the UI.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def spa(path: str) -> FileResponse:
        # Real files (favicon etc.) are returned as-is; any other path gets index.html
        # so React Router can handle client-side routes like /progress.
        if path.startswith("api/"):  # a mistyped API URL should be a 404, not the web page
            raise HTTPException(404, "Not found")
        file = FRONTEND_DIST / path
        if path and file.is_file() and file.resolve().is_relative_to(FRONTEND_DIST):
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
