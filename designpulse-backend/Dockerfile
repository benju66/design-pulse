# ── Design Pulse Backend ─────────────────────────────────────────────
# Python/FastAPI microservice for PDF processing, tile generation,
# and vector extraction (PyMuPDF + pyvips + Shapely).
#
# Requires libvips at the OS level for Deep Zoom tile pyramid generation.
# Render.com's native Python runtime cannot install system C libraries,
# so this Dockerfile is the canonical deployment target.
# ─────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

# ── 1. System dependencies ──────────────────────────────────────────
#   libvips-dev  → C library required by pyvips (Deep Zoom tiling)
#   libglib2.0-0 → runtime dep for libvips
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libvips-dev \
        build-essential \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# ── 2. Python dependencies ──────────────────────────────────────────
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── 3. Application code ─────────────────────────────────────────────
COPY . .

# ── 4. Expose port and launch ────────────────────────────────────────
#   Render injects $PORT at runtime; uvicorn binds to it.
EXPOSE 10000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
