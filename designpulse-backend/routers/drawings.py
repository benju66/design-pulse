"""
routers/drawings.py — Step 3b

Drawing-domain API endpoints extracted from main.py (AGENTS.md D.4).
Uses APIRouter(prefix="/drawings") so all paths are /drawings/...

Endpoints:
  POST /drawings/inspect-and-stage-pdf   — validation + thumbnails + staging
  POST /drawings/process-sheet/{sheet_id} — dual-mode dispatch (staged or direct)
  POST /drawings/attach-original/{sheet_id} — attach source PDF for export

Auth pattern: all endpoints use the shared get_current_user dependency from main.py.
The verify_project_access() helper covers the inspect endpoint (no sheet_id available
at that stage — V4 fix from dependency analysis).
"""

import asyncio
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client
from typing import List, Optional

from services.pdf_inspector import inspect_and_stage_pdf, MAX_PDF_BYTES
from services.tile_processor import PdfProcessingError
from services.worker import process_sheet_job
from services.auth import get_current_user

router = APIRouter(prefix="/drawings", tags=["drawings"])

# ── Supabase client (shared, read-only ops only — writes use thread-local clients) ──
from dotenv import load_dotenv
load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL", "")
supabase_key = os.environ.get("SUPABASE_KEY", "")
supabase: Client = create_client(supabase_url, supabase_key)


# ── Pydantic response models ──────────────────────────────────────────────────

class StagedPageMeta(BaseModel):
    page_index: int
    suggested_label: str
    width: float
    height: float
    thumbnail_b64: str


class InspectPdfResponse(BaseModel):
    staged_key: str
    page_count: int
    truncated: bool
    filename: str
    pages: List[StagedPageMeta]


# ── Authorization helpers ─────────────────────────────────────────────────────

async def verify_project_access(project_id: str, user_id: str) -> None:
    """
    Verifies the caller is a member of the given project.

    Used by /inspect-and-stage-pdf which has no sheet_id yet (V4 fix).
    Unlike verify_project_sheet_access in main.py, this takes project_id directly.
    """
    def check() -> Optional[str]:
        res = (
            supabase.table("project_members")
            .select("id")
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data or len(res.data) == 0:
            return "Not authorized to access this project"
        return None

    err = await asyncio.to_thread(check)
    if err:
        raise HTTPException(status_code=403, detail=err)


async def verify_sheet_project_access(sheet_id: str, user_id: str) -> str:
    """
    Verifies access via sheet_id and returns the project_id.
    Mirrors the logic in main.py's verify_project_sheet_access.
    """
    def check() -> tuple[Optional[str], Optional[str]]:
        sheet_res = (
            supabase.table("project_sheets")
            .select("project_id")
            .eq("id", sheet_id)
            .execute()
        )
        if not sheet_res.data:
            return None, "Sheet not found"
        project_id = sheet_res.data[0]["project_id"]
        member_res = (
            supabase.table("project_members")
            .select("id")
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not member_res.data:
            return None, "Not authorized to access this project"
        return project_id, None

    project_id, err = await asyncio.to_thread(check)
    if err == "Sheet not found":
        raise HTTPException(status_code=404, detail=err)
    if err:
        raise HTTPException(status_code=403, detail=err)
    return project_id  # type: ignore[return-value]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/inspect-and-stage-pdf", response_model=InspectPdfResponse)
async def inspect_and_stage(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Step 1 of the UOPM pipeline.

    Fast path (< 5s for most drawing sets):
      1. Validate file type and project membership.
      2. Read PDF bytes with streaming size guard (BUG-3).
      3. Generate low-res thumbnails + suggested sheet labels (Q2).
      4. Stage full PDF at {project_id}/staged/{staged_key}.pdf.
      5. Return InspectPdfResponse — frontend renders PageThumbnailGrid.

    Single-page shortcut: frontend detects page_count == 1 and skips the
    picker modal, dispatching immediately to /process-sheet (BUG-12).
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    await verify_project_access(project_id, user["sub"])

    # Streaming size check — read one extra byte to detect oversized payloads (BUG-3)
    pdf_bytes = await file.read(MAX_PDF_BYTES + 1)
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"PDF exceeds {MAX_PDF_BYTES // (1024 * 1024)} MB limit",
        )

    try:
        result = await asyncio.to_thread(
            inspect_and_stage_pdf,
            pdf_bytes,
            project_id,
            file.filename,
            supabase,
        )
    except ValueError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except PdfProcessingError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"[inspect-and-stage-pdf] Failed for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to inspect PDF")

    return InspectPdfResponse(**result)


@router.post("/process-sheet/{sheet_id}", status_code=202)
async def process_sheet(
    sheet_id: str,
    staged_key: Optional[str] = Form(None),
    page_index: int = Form(0),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    """
    Step 2 of the UOPM pipeline — dual-mode dispatch.

    Staged mode (bulk import):
      - Receives staged_key + page_index, no file upload.
      - Worker downloads the already-staged PDF from Storage.

    Direct mode (re-upload / single sheet):
      - Receives a PDF file directly (no staged_key).
      - Stages it immediately under {project_id}/staged/{uuid}.pdf.
      - Worker processes it identically to staged mode.

    Returns 202 Accepted immediately; heavy work runs in background.
    """
    # Validate: exactly one source must be provided
    if staged_key is None and file is None:
        raise HTTPException(status_code=400, detail="Provide either staged_key or a PDF file")
    if staged_key is not None and file is not None:
        raise HTTPException(status_code=400, detail="Provide staged_key OR a file, not both")

    project_id = await verify_sheet_project_access(sheet_id, user["sub"])

    source_filename = ""

    if file is not None:
        # Direct mode: validate, size-check, and stage now
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

        source_filename = file.filename
        pdf_bytes = await file.read(MAX_PDF_BYTES + 1)
        if len(pdf_bytes) > MAX_PDF_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF exceeds {MAX_PDF_BYTES // (1024 * 1024)} MB limit",
            )

        import uuid as uuid_lib
        auto_staged_key = str(uuid_lib.uuid4())
        staged_path = f"{project_id}/staged/{auto_staged_key}.pdf"

        def stage_direct() -> None:
            supabase.storage.from_("project_drawings").upload(
                path=staged_path,
                file=pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": "true"},
            )

        await asyncio.to_thread(stage_direct)
        staged_key = auto_staged_key

    # Reset DB row — handles re-upload case where row already has a terminal state
    supabase.table("project_sheets").update({
        "status": "processing",
        "progress_percent": 0,
        "status_message": None,
    }).eq("id", sheet_id).execute()

    # Fire background job — non-blocking
    asyncio.create_task(
        process_sheet_job(
            sheet_id=sheet_id,
            project_id=project_id,
            staged_key=staged_key,  # type: ignore[arg-type]
            page_index=page_index,
            source_filename=source_filename,
        )
    )

    return JSONResponse(
        status_code=202,
        content={"status": "accepted", "sheet_id": sheet_id},
    )


@router.post("/attach-original/{sheet_id}")
async def attach_original_pdf(
    sheet_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Attaches a source PDF to an existing sheet for vector extraction and export."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    await verify_sheet_project_access(sheet_id, user["sub"])

    pdf_bytes = await file.read(MAX_PDF_BYTES + 1)
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"PDF exceeds {MAX_PDF_BYTES // (1024 * 1024)} MB limit",
        )

    def process_attach() -> None:
        pdf_path = f"originals/{sheet_id}.pdf"
        supabase.storage.from_("floorplans").remove([pdf_path])
        supabase.storage.from_("floorplans").upload(
            path=pdf_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf"},
        )

    await asyncio.to_thread(process_attach)
    return {"status": "success", "message": "Original PDF attached successfully!"}


@router.get("/preview/{project_id}/{staged_key}/{page_index}")
async def get_preview(
    project_id: str,
    staged_key: str,
    page_index: int,
    user: dict = Depends(get_current_user),
):
    """Generates a high-res (2000px) JPEG preview of a single page instantly for the manual review wizard."""
    await verify_project_access(project_id, user["sub"])
    
    import tempfile
    import fitz
    from fastapi.responses import Response

    local_path = os.path.join(tempfile.gettempdir(), f"preview_{staged_key}.pdf")
    
    def process_preview():
        pdf_bytes = None
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                pdf_bytes = f.read()
        else:
            # Fallback to downloading from Supabase if cache was cleared
            try:
                pdf_bytes = supabase.storage.from_("project_drawings").download(f"{project_id}/staged/{staged_key}.pdf")
            except Exception:
                pass
            if not pdf_bytes:
                raise ValueError("PDF not found in local cache or Supabase storage")

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_index < 0 or page_index >= len(doc):
            doc.close()
            raise ValueError(f"Invalid page index {page_index} for PDF with {len(doc)} pages")

        page = doc[page_index]
        rect = page.rect
        
        # Target 2000px longest axis for high-res reading preview
        longest = max(rect.width, rect.height)
        zoom = 2000 / longest if longest > 0 else 2.0
        
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        jpeg_bytes = pix.tobytes("jpeg", jpg_quality=85)
        doc.close()
        return jpeg_bytes

    try:
        jpeg_bytes = await asyncio.to_thread(process_preview)
        return Response(content=jpeg_bytes, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        print(f"[preview] Error generating preview: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate high-res preview")
