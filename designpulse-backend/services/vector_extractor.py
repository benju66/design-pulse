import fitz
import json
from tenacity import retry, stop_after_attempt, wait_exponential


class VectorExtractor:
    @staticmethod
    def extract_and_upload(
        pdf_bytes: bytes,
        project_id: str,
        sheet_id: str,
        supabase_client,
        page_index: int = 0,
    ) -> None:
        """
        Extracts structural vector lines from a PDF page, normalizes them to
        percentage-of-page coordinates, and uploads as JSON to Supabase Storage.

        Path convention: {project_id}/{sheet_id}/vectors.json
        RLS requirement: path_tokens[1] must be a valid project_id UUID.

        Output format: {"vectors": [{"start": {"pctX": f, "pctY": f}, "end": {...}}, ...]}
        This matches the frontend parser in useSnappingVectors.ts.

        Changes vs. original:
        - tenacity retry with upsert replaces fragile upload→update fallback.
        - upsert: "true" handles both first-upload and re-upload atomically.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        if page_index < 0 or page_index >= len(doc):
            doc.close()
            raise ValueError(f"page_index {page_index} out of range")
            
        page = doc[page_index]

        page_width: float = page.rect.width
        page_height: float = page.rect.height
        derotation = page.derotation_matrix
        cropbox_tl = page.cropbox.tl

        def normalize_point(pt) -> dict[str, float]:
            """Convert a raw fitz.Point to percentage-of-page, accounting for rotation."""
            mapped = (fitz.Point(pt.x, pt.y) * derotation) + cropbox_tl
            return {
                "pctX": mapped.x / page_width,
                "pctY": mapped.y / page_height,
            }

        vectors: list[dict] = []
        paths = page.get_drawings()
        MAX_VECTORS = 50_000

        for p in paths:
            if len(vectors) >= MAX_VECTORS:
                break

            linewidth = p.get("width", 1.0)
            if linewidth is not None and linewidth < 0.1:
                continue

            for item in p["items"]:
                if len(vectors) >= MAX_VECTORS:
                    break

                if item[0] == "l":  # line segment
                    vectors.append({
                        "start": normalize_point(item[1]),
                        "end": normalize_point(item[2]),
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
                            "end": normalize_point(corners[(i + 1) % 4]),
                        })
                # Curves ("c") intentionally skipped — add noise to RBush with minimal snap utility

        doc.close()

        payload = json.dumps({"vectors": vectors}).encode("utf-8")
        remote_path = f"{project_id}/{sheet_id}/vectors.json"

        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=2, max=10),
            reraise=True,
        )
        def upload_vectors() -> None:
            # upsert: "true" handles both first-upload and re-upload atomically.
            # Replaces the fragile try-upload / except-update fallback pattern.
            supabase_client.storage.from_("project_drawings").upload(
                path=remote_path,
                file=payload,
                file_options={"content-type": "application/json", "upsert": "true"},
            )

        upload_vectors()
