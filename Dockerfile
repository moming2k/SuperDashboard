# SuperDashboard Dockerfile - Multi-stage build with uv and .venv isolation
# Uses uv for fast, reliable Python package installation
# Uses .venv for complete isolation from system Python
# Build: docker build -t superdashboard:latest .
# Run: docker run -p 8000:8000 --env-file backend/.env superdashboard:latest

# Allow configurable Python base image
ARG PYTHON_BASE_IMAGE=python:3.12-slim

# ==================== Base Stage ====================
FROM ${PYTHON_BASE_IMAGE} as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Don't use system Python - force .venv usage
    UV_PROJECT_ENVIRONMENT=/app/backend/.venv

WORKDIR /app

# ==================== Dependencies Stage ====================
FROM base as dependencies

# Copy dependency files
COPY backend/pyproject.toml ./backend/

WORKDIR /app/backend

# Create virtual environment with uv (isolated from system)
RUN uv venv .venv

# Install Python dependencies from pyproject.toml using uv (much faster than pip)
RUN uv pip install --python .venv/bin/python .

# ==================== Build Stage ====================
FROM dependencies as build

# Copy backend code
COPY backend/ ./

# Copy plugins
COPY plugins/ /app/plugins/

# ==================== Runtime Stage ====================
# Re-declare ARG for this stage
ARG PYTHON_BASE_IMAGE=python:3.12-slim
FROM ${PYTHON_BASE_IMAGE} as runtime

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 appuser

WORKDIR /app/backend

# Copy virtual environment from dependencies stage (fully isolated)
COPY --from=dependencies --chown=appuser:appuser /app/backend/.venv /app/backend/.venv

# Copy application code
COPY --from=build --chown=appuser:appuser /app/backend /app/backend
COPY --from=build --chown=appuser:appuser /app/plugins /app/plugins

# Switch to non-root user
USER appuser

# Set environment variables
ENV PATH="/app/backend/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV="/app/backend/.venv"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Run the application using Python from .venv
CMD ["python", "main.py"]
