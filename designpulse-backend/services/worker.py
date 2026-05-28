import asyncio
import os

from supabase import create_client

from services.exceptions import PdfProcessingError
from services.vector_extractor import VectorExtractor
import threading

_worker_local = threading.local()
_semaphore = None

def get_semaphore():
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(int(os.environ.get("MAX_CONCURRENT_JOBS", "3")))
    return _semaphore


def get_supabase():
    if not hasattr(_worker_local, "client"):
        _worker_local.client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _worker_local.client


async def process_sheet_job(
    sheet_id: str,
    project_id: str,
    staged_key: str,
    page_index: int = 0,
    source_filename: str = "",
) -> None:
    """
    Background job coroutine dispatched via asyncio.create_task() from the
    /drawings/process-sheet/{sheet_id} endpoint. Runs outside the FastAPI request cycle.

    Step 2b changes vs. original:
    - page_index param: passed to TileProcessor so multi-page PDFs are handled (BUG fix).
    - staged_key: download path changed from pending/{sheet_id}.pdf →
      {project_id}/staged/{staged_key}.pdf (UOPM architecture).
    - source_filename: written to DB on finalize for provenance.
    - status_message: written to DB on error so the UI can show the reason (BUG-7).
    - asyncio.gather(): tiles and vectors now run concurrently (OPT-3).
    - PdfProcessingError: caught specifically to surface user-readable messages.

    Progress mapping:
      0–90%  → tile uploads  (reported per batch by TileProcessor)
      90–95% → vector extraction complete  (now concurrent with tiles via gather)
      95–100% → DB row finalized
    """
    # Note: the caller (drawings.py) sets status='processing' before dispatching
    # this task, so we cannot use status=='processing' as a duplicate-job guard
    # (it would always trigger). The asyncio.Semaphore below limits concurrency.

    # Thread-local client — isolated httpx connection pool, never shared.
    # Note: we don't instantiate here anymore, we use get_supabase() so each thread gets its own.

    def write_progress(percent: int) -> None:
        """Synchronous DB write — called from asyncio.to_thread contexts."""
        get_supabase().table("project_sheets").update(
            {"progress_percent": percent}
        ).eq("id", sheet_id).execute()

    # staged_path defined outside try so the except block can clean it up.
    staged_path = f"{project_id}/staged/{staged_key}.pdf"

    try:
        async with get_semaphore():
            # ── Step 1: Download staged PDF from Storage ──────────────────────────
            pdf_bytes: bytes = await asyncio.to_thread(
                get_supabase().storage.from_("project_drawings").download,
                staged_path,
            )

            # ── Step 2: PDF copy + thumbnail + Vector extraction — concurrent ─────
            # No more tile generation. The client renders PDFs via pdf.js.
            # run_pdf_copy: extract the single page as a standalone PDF + thumbnail PNG.
            # run_vectors: extract structural vectors for snapping engine (unchanged).
            def run_pdf_copy() -> tuple[int, int]:
                """Extract single page PDF, generate thumbnail, upload both."""
                import fitz  # PyMuPDF
                from services.exceptions import MAX_SAFE_PIXELS, PDF_RENDER_ZOOM

                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                try:
                    if page_index >= len(doc):
                        raise PdfProcessingError(
                            f"Page {page_index + 1} does not exist in this PDF "
                            f"(document has {len(doc)} pages)."
                        )
                    page = doc[page_index]
                    width = int(page.rect.width)
                    height = int(page.rect.height)

                    # ── 2a: Extract single-page PDF ──────────────────────────────
                    single_doc = fitz.open()
                    single_doc.insert_pdf(doc, from_page=page_index, to_page=page_index)
                    pdf_out_bytes = single_doc.tobytes(deflate=True, garbage=4)
                    single_doc.close()

                    write_progress(30)

                    # ── 2b: Generate thumbnail PNG (longest axis ≤ 300px) ────────
                    thumb_max_px = 300
                    scale = thumb_max_px / max(width, height)
                    mat = fitz.Matrix(scale, scale)
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    thumb_bytes = pix.tobytes("png")

                    write_progress(50)

                    # ── 2c: Upload PDF + thumbnail to permanent location ─────────
                    permanent_base = f"{project_id}/{sheet_id}"
                    sb = get_supabase()

                    # Upload single-page PDF
                    sb.storage.from_("project_drawings").upload(
                        f"{permanent_base}/sheet.pdf",
                        pdf_out_bytes,
                        {"content-type": "application/pdf", "x-upsert": "true"},
                    )

                    write_progress(70)

                    # Upload thumbnail
                    sb.storage.from_("project_drawings").upload(
                        f"{permanent_base}/thumb.png",
                        thumb_bytes,
                        {"content-type": "image/png", "x-upsert": "true"},
                    )

                    write_progress(80)
                    return (width, height)
                finally:
                    doc.close()

            def run_vectors() -> None:
                VectorExtractor.extract_and_upload(
                    pdf_bytes, project_id, sheet_id, get_supabase(), page_index=page_index
                )

            (width, height), _ = await asyncio.gather(
                asyncio.to_thread(run_pdf_copy),
                asyncio.to_thread(run_vectors),
            )

            write_progress(95)

            # ── Step 3: Finalize DB row with provenance data ──────────────────────
            get_supabase().table("project_sheets").update({
                "status": "ready",
                "progress_percent": 100,
                "max_zoom": None,  # No longer used — PDF renderer handles zoom client-side
                "original_width": width,
                "original_height": height,
                "source_filename": source_filename or None,
                "source_page_index": page_index,
                "status_message": None,  # clear any previous error message
            }).eq("id", sheet_id).execute()


        # ── Step 4: Remove staged file (success path) ─────────────────────────
        # Staged PDF is removed after the job that consumed it succeeds.
        # TTL sweep in main.py handles staged files orphaned by crashes.
        try:
            get_supabase().storage.from_("project_drawings").remove([staged_path])
        except Exception as cleanup_err:
            print(f"[worker] WARNING: Could not clean staged file {staged_path}: {cleanup_err}")

        print(
            f"[worker] process_sheet_job completed for sheet {sheet_id} "
            f"(page={page_index}, {width}x{height})"
        )

    except Exception as e:
        # Produce a user-friendly message for known error types (BUG-7)
        if isinstance(e, PdfProcessingError):
            user_message = str(e)
        else:
            user_message = "Processing failed. Please try re-uploading."

        print(f"[worker] process_sheet_job FAILED for sheet {sheet_id}: {e}")

        # Sub-block 1: Write error status + human-readable message to DB.
        try:
            get_supabase().table("project_sheets").update({
                "status": "error",
                "progress_percent": 0,
                "status_message": user_message,
            }).eq("id", sheet_id).execute()
        except Exception as db_err:
            print(f"[worker] Failed to write error status for sheet {sheet_id}: {db_err}")

        # Sub-block 2: Clean up staged file.
        try:
            get_supabase().storage.from_("project_drawings").remove([staged_path])
        except Exception as storage_err:
            print(f"[worker] WARNING: Could not clean staged file {staged_path}: {storage_err}")
