import fitz
import pyvips
import os
import shutil
from concurrent.futures import ThreadPoolExecutor


class TileProcessor:
    @staticmethod
    def process_pdf_to_tiles(pdf_bytes: bytes, project_id: str, sheet_id: str, supabase_client):
        """
        Renders a PDF to a high-res buffer, then uses pyvips to stream-slice it 
        into a Deep Zoom tile pyramid, uploading directly to Supabase.

        Path convention: {project_id}/{sheet_id}/tiles/{z}/{col}_{row}.webp
        This ensures Storage RLS path_tokens[1] resolves to project_id for
        zero-JOIN membership checks.

        Returns: max_zoom, original_width, original_height
        """
        # Render high-res image using PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        
        zoom = 4.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # Save PyMuPDF output to memory as PNG
        img_bytes = pix.tobytes("png")
        doc.close()
        
        # Load the high-res image into pyvips
        image = pyvips.Image.new_from_buffer(img_bytes, "")
        
        original_width = image.width
        original_height = image.height
        
        temp_dir = f"temp_{sheet_id}_tiles"
        os.makedirs(temp_dir, exist_ok=True)
        
        # dzsave generates standard Deep Zoom Image (DZI)
        image.dzsave(f"{temp_dir}/tiles", suffix=".webp")
        
        tiles_dir = f"{temp_dir}/tiles_files"
        max_zoom = 0

        # Collect all tiles for parallel upload
        upload_tasks = []
        
        if os.path.exists(tiles_dir):
            for zoom_folder in os.listdir(tiles_dir):
                z_path = os.path.join(tiles_dir, zoom_folder)
                if os.path.isdir(z_path):
                    try:
                        z = int(zoom_folder)
                        max_zoom = max(max_zoom, z)
                    except ValueError:
                        continue
                        
                    for tile_file in os.listdir(z_path):
                        tile_path = os.path.join(z_path, tile_file)
                        with open(tile_path, "rb") as f:
                            tile_data = f.read()
                            # Path: {project_id}/{sheet_id}/tiles/{z}/{col}_{row}.webp
                            remote_path = f"{project_id}/{sheet_id}/tiles/{zoom_folder}/{tile_file}"
                            upload_tasks.append((remote_path, tile_data))

        # Parallel upload with ThreadPoolExecutor (P-3: ~10x faster than sequential)
        def upload_tile(args):
            remote_path, tile_data = args
            try:
                supabase_client.storage.from_("project_drawings").upload(
                    path=remote_path,
                    file=tile_data,
                    file_options={"content-type": "image/webp"}
                )
            except Exception:
                # Fallback for upsert if it already exists
                supabase_client.storage.from_("project_drawings").update(
                    path=remote_path,
                    file=tile_data,
                    file_options={"content-type": "image/webp"}
                )

        if upload_tasks:
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(upload_tile, task) for task in upload_tasks]
                for future in futures:
                    future.result()  # Propagate exceptions — no silent swallowing
                            
        # Clean up temp files
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        return max_zoom, original_width, original_height
