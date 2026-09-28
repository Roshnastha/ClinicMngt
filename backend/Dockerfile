# ---------------------------------------------------------------------------
# PhysioDesk backend – FastAPI + uvicorn
# Build context is the PROJECT ROOT (see docker-compose.yml) so the
# `backend.app.*` import package stays intact.
# ---------------------------------------------------------------------------

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /repo

# Install dependencies first (better layer caching).
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy the backend package + Alembic config (context: project root).
COPY backend/ ./backend/

# Run as an unprivileged user.
RUN useradd --create-home appuser && chown -R appuser /repo
USER appuser

EXPOSE 8000

# Start the API (module path `backend.app.main:app`, matching local dev).
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
