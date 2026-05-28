"""
services/exceptions.py — Shared exceptions and constants.

Extracted from tile_processor.py to eliminate circular import chains
after TileProcessor deletion. Consumed by:
  - services/worker.py
  - services/pdf_inspector.py
  - routers/drawings.py
  - main.py
"""

import os

# Environment-configurable PDF render zoom factor (PyMuPDF matrix scale).
PDF_RENDER_ZOOM = float(os.environ.get("PDF_RENDER_ZOOM", "3.0"))

# Circuit Breaker: maximum safe pixel count for PyMuPDF rendering.
# Prevents OOM when rendering extremely large architectural sheets.
MAX_SAFE_PIXELS = 200_000_000


class PdfProcessingError(Exception):
    """Structured exception for user-displayable PDF errors (encrypted, corrupted)."""
    pass
