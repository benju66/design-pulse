"""
services/pdf_inspector.py — Step 2c

Lightweight PDF inspection service for the /drawings/inspect-and-stage-pdf endpoint.
Responsibilities:
  1. Validate the PDF (size limit, not encrypted/corrupted).
  2. Generate low-resolution thumbnails for each page (capped at MAX_INSPECT_PAGES).
  3. Stage the full PDF to Supabase Storage under {project_id}/staged/{staged_key}.pdf.
  4. Return InspectPdfResponse as a plain dict (Pydantic model lives in the router).

No dependency on tile_processor.py or worker.py — fully independent service.
"""

import base64
import os
import tempfile
import uuid as uuid_lib
from typing import Any

import fitz

from services.tile_processor import PdfProcessingError, MAX_SAFE_PIXELS, PDF_RENDER_ZOOM

MAX_INSPECT_PAGES = int(os.environ.get("MAX_INSPECT_PAGES", "200"))
# Thumbnail target: longest axis ≤ 150px regardless of page orientation/size (BUG-11).
THUMB_MAX_PX = 150
THUMB_JPEG_QUALITY = 60

MAX_PDF_BYTES = int(os.environ.get("MAX_PDF_MB", "500")) * 1024 * 1024


def inspect_and_stage_pdf(
    pdf_bytes: bytes,
    project_id: str,
    original_filename: str,
    supabase_client: Any,
) -> dict:
    """
    Validates, thumbnails, and stages a PDF. Returns a dict matching InspectPdfResponse.

    Raises:
        ValueError: file too large (HTTP 413 in router)
        PdfProcessingError: encrypted or corrupted PDF (HTTP 422 in router)
    """
    # ── 1. Size guard (BUG-3) ─────────────────────────────────────────────────
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise ValueError(
            f"PDF exceeds {MAX_PDF_BYTES // (1024 * 1024)} MB limit "
            f"({len(pdf_bytes) // (1024 * 1024)} MB received)"
        )

    # ── 2. Open PDF — catch encrypted/corrupted (BUG-4) ──────────────────────
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except fitz.FileDataError as e:
        raise PdfProcessingError(f"Cannot open PDF: {e}") from e

    if doc.needs_pass:
        doc.close()
        raise PdfProcessingError("PDF is password-protected. Remove the password before uploading.")

    page_count = len(doc)
    truncated = page_count > MAX_INSPECT_PAGES
    pages_to_process = min(page_count, MAX_INSPECT_PAGES)

    # ── 3. Generate thumbnails (BUG-11: capped, bounded zoom) ─────────────────
    pages: list[dict] = []
    for i in range(pages_to_process):
        page = doc[i]
        rect = page.rect

        target_pixels = rect.width * rect.height * (PDF_RENDER_ZOOM ** 2)
        if target_pixels > MAX_SAFE_PIXELS:
            doc.close()
            raise ValueError(f"PDF page {i+1} dimensions too large to process safely (Exceeds 200MP)")

        # Compute zoom so longest axis → THUMB_MAX_PX
        longest = max(rect.width, rect.height)
        zoom = THUMB_MAX_PX / longest if longest > 0 else 0.15
        zoom = max(zoom, 0.05)  # floor to prevent zero-size pixmap

        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        jpeg_bytes = pix.tobytes("jpeg", jpg_quality=THUMB_JPEG_QUALITY)
        thumb_b64 = base64.b64encode(jpeg_bytes).decode("utf-8")

        # Q2: Use PDF page label if available (e.g. "A1.1"), fallback to "Page N"
        try:
            pdf_label = doc.get_page_labels()
        except Exception:
            pdf_label = []
        label = next(
            (entry.get("startpage", "") for entry in pdf_label if entry.get("startpage") == i),
            None,
        )
        suggested_label = f"Page {i + 1}" if not label else str(label)

        pages.append({
            "page_index": i,
            "suggested_label": suggested_label,
            "width": rect.width,
            "height": rect.height,
            "thumbnail_b64": thumb_b64,
        })

    doc.close()

    # ── 4. Stage full PDF to Storage ─────────────────────────────────────────
    # Path: {project_id}/staged/{staged_key}.pdf
    # Storage RLS: path_tokens[1] = project_id — covered by existing policy.
    staged_key = str(uuid_lib.uuid4())
    staged_path = f"{project_id}/staged/{staged_key}.pdf"

    # Remove any stale file at this path (shouldn't happen with UUID keys, but defensive)
    try:
        supabase_client.storage.from_("project_drawings").remove([staged_path])
    except Exception:
        pass  # Non-fatal — path likely doesn't exist

    supabase_client.storage.from_("project_drawings").upload(
        path=staged_path,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )

    # ── 5. Cache locally for instant high-res previews ───────────────────────
    try:
        temp_dir = tempfile.gettempdir()
        local_path = os.path.join(temp_dir, f"preview_{staged_key}.pdf")
        with open(local_path, "wb") as f:
            f.write(pdf_bytes)
    except Exception as e:
        print(f"[pdf_inspector] Warning: failed to cache preview locally: {e}")

    return {
        "staged_key": staged_key,
        "page_count": page_count,
        "truncated": truncated,
        "filename": original_filename,
        "pages": pages,
    }

def extract_title_block_zones(staged_key: str, zones: list[dict], page_indices: list[int]) -> list[dict]:
    """
    Extracts text from specified coordinate zones across multiple pages using PyMuPDF.
    CPU-bound: MUST be called via run_in_threadpool.
    """
    temp_dir = tempfile.gettempdir()
    local_path = os.path.join(temp_dir, f"preview_{staged_key}.pdf")
    
    if not os.path.exists(local_path):
        raise ValueError("Cached PDF not found. It may have expired or was not staged correctly.")
        
    results = []
    
    try:
        doc = fitz.open(local_path)
    except Exception as e:
        raise PdfProcessingError(f"Failed to open cached PDF for extraction: {e}")
        
    try:
        for idx in page_indices:
            if idx < 0 or idx >= len(doc):
                continue
                
            page = doc[idx]
            page_rect = page.rect
            width = page_rect.width
            height = page_rect.height
            
            result = {
                "pageIndex": idx,
                "sheetName": "",
                "drawingTitle": ""
            }
            
            for zone in zones:
                field = zone.get("field")
                rect_pct = zone.get("rect") # [x, y, w, h] in percentages
                
                if not field or not rect_pct or len(rect_pct) != 4:
                    continue
                    
                x, y, w, h = rect_pct
                
                # Convert relative percentages to absolute coordinates
                x0 = x * width
                y0 = y * height
                x1 = (x + w) * width
                y1 = (y + h) * height
                
                clip_rect = fitz.Rect(x0, y0, x1, y1)
                raw_text = page.get_text("text", clip=clip_rect)
                
                # Sanitize text based on field
                if field == "sheetName":
                    # Remove all whitespace/newlines, convert to uppercase
                    clean_text = "".join(raw_text.split()).upper()
                    result["sheetName"] = clean_text
                elif field == "drawingTitle":
                    # Replace newlines with spaces, strip trailing/leading
                    clean_text = " ".join(raw_text.split())
                    result["drawingTitle"] = clean_text
                    
            results.append(result)
            
    finally:
        doc.close()
        
    return results
