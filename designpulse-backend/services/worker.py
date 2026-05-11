import asyncio
import os

from supabase import create_client

from services.tile_processor import TileProcessor
from services.vector_extractor import VectorExtractor


async def process_sheet_job(sheet_id: str, project_id: str) -> None:
    """
    Background job coroutine dispatched via asyncio.create_task() from the
    /process-sheet/{sheet_id} endpoint. Runs outside the FastAPI request cycle.

    Design invariants:
    - Thread-local Supabase client: a fresh client is created per job so its
      httpx connection pool is never shared across concurrent tasks (gap #4).
    - pending_path defined BEFORE try: accessible in the except cleanup block (gap #2).
    - Two independent except sub-blocks: a Storage failure cannot suppress the
      DB status write (gap #3 independence requirement).
    - Zombie-proof: the lifespan startup sweep in main.py handles the case where
      this coroutine is killed before the except block fires (gap #3 pod death).

    Progress mapping:
      0–90%  → tile uploads  (reported per 50-tile batch by TileProcessor)
      90–95% → vector extraction complete
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

    # pending_path defined outside try so the except block can clean it up
    # regardless of where the failure occurred.
    # RLS: path_tokens[1] must be a UUID — 'pending/' prefix would fail the cast.
    pending_path = f"{project_id}/pending/{sheet_id}.pdf"

    try:
        # ── Step 1: Download staged PDF ───────────────────────────────────────
        pdf_bytes: bytes = await asyncio.to_thread(
            local_supabase.storage.from_("project_drawings").download,
            pending_path,
        )

        # ── Step 2: Tile generation (progress 0–90%) ──────────────────────────
        def run_tiles() -> tuple[int, int, int]:
            return TileProcessor.process_pdf_to_tiles(
                pdf_bytes,
                project_id,
                sheet_id,
                local_supabase,
                on_progress=write_progress,
            )

        max_zoom, width, height = await asyncio.to_thread(run_tiles)

        # ── Step 3: Vector extraction (progress 90–95%) ───────────────────────
        def run_vectors() -> None:
            VectorExtractor.extract_and_upload(
                pdf_bytes, project_id, sheet_id, local_supabase
            )

        await asyncio.to_thread(run_vectors)
        write_progress(95)

        # ── Step 4: Finalize DB row ───────────────────────────────────────────
        local_supabase.table("project_sheets").update({
            "status": "ready",
            "progress_percent": 100,
            "max_zoom": max_zoom,
            "original_width": width,
            "original_height": height,
        }).eq("id", sheet_id).execute()

        # ── Step 5: Delete staging file (success path) ────────────────────────
        local_supabase.storage.from_("project_drawings").remove([pending_path])

        print(f"[worker] process_sheet_job completed for sheet {sheet_id} "
              f"(max_zoom={max_zoom}, {width}x{height})")

    except Exception as e:
        print(f"[worker] process_sheet_job FAILED for sheet {sheet_id}: {e}")

        # Sub-block 1: Revert DB row to recoverable 'error' state.
        # Independent try so a DB failure here is logged but doesn't
        # prevent the Storage cleanup below from running.
        try:
            local_supabase.table("project_sheets").update({
                "status": "error",
                "progress_percent": 0,
            }).eq("id", sheet_id).execute()
        except Exception as db_err:
            print(f"[worker] Failed to write error status for sheet {sheet_id}: {db_err}")

        # Sub-block 2: Delete orphaned staging PDF to prevent bucket bloat.
        # Independent try so a Storage failure does not suppress the DB write above.
        try:
            local_supabase.storage.from_("project_drawings").remove([pending_path])
        except Exception as storage_err:
            # Non-fatal: log for ops visibility. The file can be cleaned up manually
            # or by a future scheduled sweep if needed.
            print(f"[worker] WARNING: Could not clean staging file {pending_path}: {storage_err}")
