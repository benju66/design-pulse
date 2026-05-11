import fitz
import pyvips
import os
import tempfile
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import Callable, Optional


# Step 2a: MAX_WORKERS and PDF_RENDER_ZOOM now env-configurable (OPT-2, OPT-4).
# Raising MAX_WORKERS from 10 → 50 gives ~5x tile-upload throughput on large sheets.
MAX_TILE_WORKERS = int(os.environ.get("MAX_TILE_WORKERS", "50"))
PDF_RENDER_ZOOM  = float(os.environ.get("PDF_RENDER_ZOOM", "3.0"))


class PdfProcessingError(Exception):
    """Structured exception for user-displayable PDF errors (encrypted, corrupted)."""
    pass


class TileProcessor:
    @staticmethod
    def process_pdf_to_tiles(
        pdf_bytes: bytes,
        project_id: str,
        sheet_id: str,
        supabase_client,
        page_index: int = 0,
        on_progress: Optional[Callable[[int], None]] = None,
    ) -> tuple[int, int, int]:
        """
        Renders a single PDF page to a high-res buffer, slices it into a Deep Zoom
        WebP tile pyramid, and uploads to Supabase Storage.

        Step 2a changes:
        - page_index param replaces hardcoded doc[0] (multi-page PDF support).
        - page_index bounds-check raises PdfProcessingError before any work begins.
        - fitz.FileDataError (encrypted/corrupted PDF) caught and re-raised as
          PdfProcessingError so worker.py can write status_message to DB (BUG-4).
        - MAX_TILE_WORKERS and PDF_RENDER_ZOOM are now env-configurable (OPT-2, OPT-4).

        Path convention: {project_id}/{sheet_id}/tiles/{z}/{col}_{row}.webp
        RLS requirement: path_tokens[1] must be a valid project_id UUID.

        Returns: (max_zoom, original_width, original_height)
        """
        # ── 1. Open PDF — catch encrypted/corrupted files ─────────────────────
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except fitz.FileDataError as e:
            raise PdfProcessingError(f"Cannot open PDF: {e}") from e

        # ── 2. Validate page_index before any rendering work ──────────────────
        if page_index < 0 or page_index >= len(doc):
            doc.close()
            raise PdfProcessingError(
                f"page_index {page_index} is out of range "
                f"(PDF has {len(doc)} page(s))"
            )

        # ── 3. Render target page to high-res PNG via PyMuPDF ─────────────────
        # PDF_RENDER_ZOOM default 3.0: balances quality vs tile count.
        # 4x produced ~2000 tiles and took 10+ minutes; 3x cuts count ~44%.
        page = doc[page_index]
        pix = page.get_pixmap(matrix=fitz.Matrix(PDF_RENDER_ZOOM, PDF_RENDER_ZOOM), alpha=False)
        img_bytes = pix.tobytes("png")
        doc.close()

        # ── 4. Load into pyvips for Deep Zoom slicing ─────────────────────────
        image = pyvips.Image.new_from_buffer(img_bytes, "")
        original_width: int = image.width
        original_height: int = image.height

        # ── 5. Generate tile pyramid to an OS-managed absolute temp dir ───────
        temp_dir = tempfile.mkdtemp(prefix=f"dp_tiles_{sheet_id}_")

        try:
            image.dzsave(os.path.join(temp_dir, "tiles"), suffix=".webp")
            tiles_dir = os.path.join(temp_dir, "tiles_files")

            upload_tasks: list[tuple[str, bytes]] = []
            max_zoom = 0

            if os.path.exists(tiles_dir):
                for zoom_folder in os.listdir(tiles_dir):
                    z_path = os.path.join(tiles_dir, zoom_folder)
                    if not os.path.isdir(z_path):
                        continue
                    try:
                        z = int(zoom_folder)
                        max_zoom = max(max_zoom, z)
                    except ValueError:
                        continue

                    for tile_file in os.listdir(z_path):
                        tile_path = os.path.join(z_path, tile_file)
                        with open(tile_path, "rb") as f:
                            tile_data = f.read()
                        # RLS path: path_tokens[1] = project_id (required for Storage policy)
                        remote_path = f"{project_id}/{sheet_id}/tiles/{zoom_folder}/{tile_file}"
                        upload_tasks.append((remote_path, tile_data))

            # ── 6. Parallel upload with tenacity retry ────────────────────────
            # MAX_TILE_WORKERS env-configurable (default 50, was 10).
            @retry(
                stop=stop_after_attempt(3),
                wait=wait_exponential(multiplier=1, min=2, max=10),
                reraise=True,
            )
            def upload_single_tile(path: str, data: bytes) -> None:
                supabase_client.storage.from_("project_drawings").upload(
                    path=path,
                    file=data,
                    file_options={"content-type": "image/webp", "upsert": "true"},
                )

            total = len(upload_tasks)
            uploaded = 0

            with ThreadPoolExecutor(max_workers=MAX_TILE_WORKERS) as executor:
                futures = {
                    executor.submit(upload_single_tile, path, data): path
                    for path, data in upload_tasks
                }
                for future in as_completed(futures):
                    future.result()  # re-raises if upload_single_tile failed after retries
                    uploaded += 1
                    # Emit progress 0-90% (worker reserves 90-100% for vectors + DB write)
                    if on_progress and total > 0 and uploaded % MAX_TILE_WORKERS == 0:
                        on_progress(int((uploaded / total) * 90))

        finally:
            # Always clean up temp dir — even if an upload batch fails mid-way
            shutil.rmtree(temp_dir, ignore_errors=True)

        return max_zoom, original_width, original_height
