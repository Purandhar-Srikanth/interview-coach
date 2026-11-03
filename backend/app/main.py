"""FastAPI entry point: the JSON API lives under /api, everything else is the built React app."""

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import ROOT_DIR, get_settings

FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

app = FastAPI(title="Interview Coach", version="0.1.0")


@app.get("/api/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "version": app.version,
        "demo_mode": settings.demo_mode,
        "llm_configured": settings.openai_api_key is not None,
    }


# Serve the React build (only exists after `npm run build`). In development, Vite serves the UI.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        # Real files (favicon etc.) are returned as-is; any other path gets index.html
        # so React Router can handle client-side routes like /progress.
        file = FRONTEND_DIST / path
        if path and file.is_file() and file.resolve().is_relative_to(FRONTEND_DIST):
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
