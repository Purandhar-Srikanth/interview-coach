# Production image (used by Render, see render.yaml). Two stages:
#   1. build the React frontend with Node
#   2. a small Python image that runs FastAPI, which serves both the API and the built frontend

# ---- Stage 1: frontend ----
FROM node:26-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + built frontend ----
FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Run as a normal user, not root (a basic container-security habit).
RUN useradd --create-home --uid 1000 app
WORKDIR /home/app/code
RUN chown app /home/app/code

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY --chown=app backend/app backend/app
COPY --chown=app --from=frontend /build/dist frontend/dist

USER app
EXPOSE 7860
# Render sets $PORT; 7860 is the local default.
# No --proxy-headers: the app reads the real client IP itself (guard.client_ip), safely.
CMD ["sh", "-c", "uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-7860}"]
