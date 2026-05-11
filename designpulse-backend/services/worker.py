import asyncio
import os

from supabase import create_client

from services.tile_processor import TileProcessor, PdfProcessingError
from services.vector_extractor import VectorExtractor


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
    # Thread-local client — isolated httpx connection pool, never shared.
    local_supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_KEY"],
    )

    def write_progress(percent: int) -> None:
        """Synchronous DB write — called from asyncio.to_thread contexts."""
        local_supabase.table("project_sheets").update(
            {"progress_percent": percent}
        ).eq("id", sheet_id).execute()

    # staged_path defined outside try so the except block can clean it up.
    staged_path = f"{project_id}/staged/{staged_key}.pdf"

    try:
        # ── Step 1: Download staged PDF from Storage ──────────────────────────
        pdf_bytes: bytes = await asyncio.to_thread(
            local_supabase.storage.from_("project_drawings").download,
            staged_path,
        )

        # ── Step 2: Tile generation + Vector extraction — concurrent (OPT-3) ──
        # Both operations receive the full pdf_bytes and operate on the same page.
        # asyncio.gather() runs them in parallel threads, cutting wall time by 1-5s.
        def run_tiles() -> tuple[int, int, int]:
            return TileProcessor.process_pdf_to_tiles(
                pdf_bytes,
                project_id,
                sheet_id,
                local_supabase,
                page_index=page_index,
                on_progress=write_progress,
            )

        def run_vectors() -> None:
            VectorExtractor.extract_and_upload(
                pdf_bytes, project_id, sheet_id, local_supabase
            )

        (max_zoom, width, height), _ = await asyncio.gather(
            asyncio.to_thread(run_tiles),
            asyncio.to_thread(run_vectors),
        )

        write_progress(95)

        # ── Step 3: Finalize DB row with provenance data ──────────────────────
        local_supabase.table("project_sheets").update({
            "status": "ready",
            "progress_percent": 100,
            "max_zoom": max_zoom,
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
            local_supabase.storage.from_("project_drawings").remove([staged_path])
        except Exception as cleanup_err:
            print(f"[worker] WARNING: Could not clean staged file {staged_path}: {cleanup_err}")

        print(
            f"[worker] process_sheet_job completed for sheet {sheet_id} "
            f"(page={page_index}, max_zoom={max_zoom}, {width}x{height})"
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
            local_supabase.table("project_sheets").update({
                "status": "error",
                "progress_percent": 0,
                "status_message": user_message,
            }).eq("id", sheet_id).execute()
        except Exception as db_err:
            print(f"[worker] Failed to write error status for sheet {sheet_id}: {db_err}")

        # Sub-block 2: Clean up staged file.
        try:
            local_supabase.storage.from_("project_drawings").remove([staged_path])
        except Exception as storage_err:
            print(f"[worker] WARNING: Could not clean staged file {staged_path}: {storage_err}")
