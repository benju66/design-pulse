import fitz
import json


class VectorExtractor:
    @staticmethod
    def extract_and_upload(pdf_bytes: bytes, project_id: str, sheet_id: str, supabase_client):
        """
        Extracts structural vector lines from a PDF page, normalizes them to
        percentage-of-page coordinates, and uploads as JSON to Supabase Storage.

        Path convention: {project_id}/{sheet_id}/vectors.json
        Output format: {"vectors": [{"start": {"pctX": float, "pctY": float}, "end": {...}}, ...]}
        
        This matches the frontend parser in useSnappingVectors.ts which reads json.vectors
        and expects {start: {pctX, pctY}, end: {pctX, pctY}} objects.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        
        # Get page dimensions for percentage normalization
        page_width = page.rect.width
        page_height = page.rect.height
        
        # Derotation matrix for rotated PDFs (matches PDFMapService.map_point logic)
        derotation = page.derotation_matrix
        cropbox_tl = page.cropbox.tl
        
        def normalize_point(pt):
            """Convert a raw fitz.Point to percentage-of-page coordinates,
            accounting for page rotation and cropbox offset."""
            mapped = (fitz.Point(pt.x, pt.y) * derotation) + cropbox_tl
            return {
                "pctX": mapped.x / page_width,
                "pctY": mapped.y / page_height
            }
        
        vectors = []
        paths = page.get_drawings()
        
        # Guardrail: prevent extreme memory usage on massive vector files
        MAX_VECTORS = 50000
        
        for p in paths:
            if len(vectors) >= MAX_VECTORS:
                break
            
            # Filter: skip invisible or micro-width lines (< 0.1pt)
            # These are typically printer marks or hairlines that add noise to the RBush tree
            linewidth = p.get("width", 1.0)
            if linewidth is not None and linewidth < 0.1:
                continue
                
            for item in p["items"]:
                if len(vectors) >= MAX_VECTORS:
                    break
                    
                if item[0] == "l":  # line segment
                    p1 = item[1]
                    p2 = item[2]
                    vectors.append({
                        "start": normalize_point(p1),
                        "end": normalize_point(p2)
                    })
                elif item[0] == "re":  # rectangle → 4 line segments
                    rect = item[1]
                    corners = [
                        fitz.Point(rect.x0, rect.y0),
                        fitz.Point(rect.x1, rect.y0),
                        fitz.Point(rect.x1, rect.y1),
                        fitz.Point(rect.x0, rect.y1),
                    ]
                    for i in range(4):
                        if len(vectors) >= MAX_VECTORS:
                            break
                        vectors.append({
                            "start": normalize_point(corners[i]),
                            "end": normalize_point(corners[(i + 1) % 4])
                        })
                # Skip curves (item[0] == "c") — they add significant RBush noise
                # with minimal snap utility for construction drawings
        
        doc.close()
        
        # Wrap in {"vectors": [...]} envelope to match frontend parser
        payload = json.dumps({"vectors": vectors}).encode('utf-8')
        remote_path = f"{project_id}/{sheet_id}/vectors.json"
        
        try:
            supabase_client.storage.from_("project_drawings").upload(
                path=remote_path,
                file=payload,
                file_options={"content-type": "application/json"}
            )
        except Exception:
            supabase_client.storage.from_("project_drawings").update(
                path=remote_path,
                file=payload,
                file_options={"content-type": "application/json"}
            )
