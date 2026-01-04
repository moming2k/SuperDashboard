# SuperDashboard Dockerfile - Multi-stage build with uv
# Uses uv for fast, reliable Python package installation
# Build: docker build -t superdashboard:latest .
# Run: docker run -p 8000:8000 --env-file backend/.env superdashboard:latest

# ==================== Base Stage ====================
FROM python:3.12-slim as base

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
    UV_SYSTEM_PYTHON=1

WORKDIR /app

# ==================== Dependencies Stage ====================
FROM base as dependencies

# Copy dependency files
COPY backend/pyproject.toml backend/requirements.txt ./

# Install Python dependencies using uv (much faster than pip)
RUN uv pip install --system -r requirements.txt

# ==================== Build Stage ====================
FROM dependencies as build

# Copy backend code
COPY backend/ ./backend/

# Copy plugins
COPY plugins/ ./plugins/

# ==================== Runtime Stage ====================
FROM python:3.12-slim as runtime

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy Python packages from dependencies stage
COPY --from=dependencies /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin

# Copy application code
COPY --from=build --chown=appuser:appuser /app /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Set working directory to backend
WORKDIR /app/backend

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
