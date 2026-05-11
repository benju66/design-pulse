from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from supabase import create_client, Client
from pydantic import BaseModel
from typing import List, Optional, Dict
import asyncio
import datetime
import glob
import os
import io
import shutil
import fitz  # PyMuPDF for fast PDF to Image conversion
import math
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

from services.PDFMapService import PDFMapService
from routers import drawings as drawings_router

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────────────────────

    # 1. Clean up orphaned temp tile directories from previous crashed runs.
    for stale_dir in glob.glob("temp_*_tiles"):
        shutil.rmtree(stale_dir, ignore_errors=True)
        print(f"[startup] Cleaned orphaned temp dir: {stale_dir}")

    # 2. Zombie State Sweep: rows stuck in status='processing' at startup belong
    #    to tasks killed mid-flight. Reset to 'error' so users can right-click → Re-upload.
    try:
        zombie_res = (
            supabase.table("project_sheets")
            .update({"status": "error", "progress_percent": 0,
                     "status_message": "Processing interrupted — please re-upload."})
            .eq("status", "processing")
            .execute()
        )
        swept = len(zombie_res.data) if zombie_res.data else 0
        if swept:
            print(f"[startup] Zombie sweep: reverted {swept} orphaned processing row(s) to 'error'.")
    except Exception as e:
        print(f"[startup] WARNING: Zombie sweep failed (non-fatal): {e}")

    # 3. Staged PDF TTL sweep — delete staged/ files older than 72 hours (Q3).
    #    Staged PDFs are written by /drawings/inspect-and-stage-pdf and consumed
    #    by /drawings/process-sheet. If a session is abandoned or crashed, these
    #    files accumulate. The 72h TTL balances enterprise workflow gaps vs. cost.
    try:
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=72)
        # List all objects in staged/ prefixes across all projects.
        # Supabase Storage list() returns objects with created_at metadata.
        staged_list_res = supabase.storage.from_("project_drawings").list(
            path="",
            options={"limit": 1000},
        )
        # Storage list at root returns project_id folders; we need to recurse.
        # Iterate known project folders and list their staged/ subdirectory.
        if staged_list_res:
            for folder in staged_list_res:
                folder_name = folder.get("name", "")
                if not folder_name:
                    continue
                try:
                    staged_items = supabase.storage.from_("project_drawings").list(
                        path=f"{folder_name}/staged",
                        options={"limit": 500},
                    )
                    stale_paths = []
                    for item in (staged_items or []):
                        created_raw = item.get("created_at") or item.get("updated_at")
                        if not created_raw:
                            continue
                        # Parse ISO timestamp (Supabase returns UTC strings)
                        try:
                            created_at = datetime.datetime.fromisoformat(
                                created_raw.replace("Z", "+00:00")
                            ).replace(tzinfo=None)
                        except ValueError:
                            continue
                        if created_at < cutoff:
                            stale_paths.append(f"{folder_name}/staged/{item['name']}")
                    if stale_paths:
                        supabase.storage.from_("project_drawings").remove(stale_paths)
                        print(f"[startup] TTL sweep: removed {len(stale_paths)} stale staged PDF(s) from {folder_name}/staged/")
                except Exception:
                    pass  # Non-fatal per-folder failure; continue to next folder
    except Exception as e:
        print(f"[startup] WARNING: Staged PDF TTL sweep failed (non-fatal): {e}")

    yield
    # ── SHUTDOWN (nothing to teardown) ───────────────────────────────────────


app = FastAPI(title="SitePulse Backend API", lifespan=lifespan)

# Register domain routers (AGENTS.md D.4)
app.include_router(drawings_router.router)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:8000")

# Split by comma to support multiple origins in one env var (e.g. staging + prod).
# Always include the known dev ports and production domain as a safety net.
allowed_origins = [url.strip() for url in FRONTEND_URL.split(",")]
for default_url in [
    "http://localhost:3000",   # Next.js default port
    "http://localhost:8000",   # Next.js custom port (next dev -p 8000)
    "https://designpulse.build",
]:
    if default_url not in allowed_origins:
        allowed_origins.append(default_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
supabase_jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")

if not supabase_url or not supabase_key or not supabase_jwt_secret:
    raise ValueError("FATAL ERROR: Supabase keys are missing from the .env file!")

supabase: Client = create_client(supabase_url, supabase_key)

@app.get("/")
def health_check():
    return {"status": "success", "message": "Backend is online!"}

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token structure")
            
        if user_response.user.role != "authenticated":
            raise HTTPException(status_code=401, detail="Not authorized")
            
        return {"sub": user_response.user.id, "role": user_response.user.role}
        
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def verify_project_sheet_access(sheet_id: str, user_id: str):
    """Unified sheet access verification using the project_sheets table.
    Returns the project_id for the sheet if the user has access.
    
    Note: verify_sheet_access (legacy, queried dead 'sheets' table) has been
    removed. All endpoints now use this function exclusively.
    """
    def check_access():
        sheet_res = supabase.table("project_sheets").select("project_id").eq("id", sheet_id).execute()
        if not sheet_res.data or len(sheet_res.data) == 0:
            return None, "Sheet not found"
        project_id = sheet_res.data[0]["project_id"]
        
        member_res = supabase.table("project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_res.data or len(member_res.data) == 0:
            return None, "Not authorized to access this project"
        return project_id, None
        
    import asyncio
    project_id, err = await asyncio.to_thread(check_access)
    if err == "Sheet not found":
        raise HTTPException(status_code=404, detail=err)
    if err == "Not authorized to access this project":
        raise HTTPException(status_code=403, detail=err)
    return project_id

class PointData(BaseModel):
    pctX: float
    pctY: float

class MarkupData(BaseModel):
    color: str
    points: List[PointData]

class ExportRequest(BaseModel):
    include_data: bool
    markups: List[MarkupData]
    project_name: str
    sheet_name: str
    legend_data: Optional[Dict] = None

# Rosetta Stone: CSI TOC Extractor response model
class CsiSpecItem(BaseModel):
    csi_number: str   # Normalized: "09 65 16"
    description: str  # e.g. "Resilient Sheet Flooring"

def hex_to_rgb(color_str: str):
    import re
    rgba_match = re.search(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', color_str)
    if rgba_match:
        return tuple(int(rgba_match.group(i))/255.0 for i in (1, 2, 3))
    
    color_str = color_str.lstrip('#')
    if len(color_str) >= 6:
        return tuple(int(color_str[i:i+2], 16)/255.0 for i in (0, 2, 4))
    return (0, 0, 0)

@app.post("/upload-floorplan/{sheet_id}")
async def upload_and_convert_floorplan(
    sheet_id: str,
    page_number: int = 1,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    try:
        await verify_project_sheet_access(sheet_id, user["sub"])
        pdf_bytes = await file.read()

        def process_upload():
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            if page_number < 1 or page_number > len(doc):
                raise ValueError(f"Page {page_number} does not exist. This PDF has {len(doc)} pages.")

            page = doc.load_page(page_number - 1)

            # Upgrade the zoom from 2.0 to 4.0 for high-fidelity rendering
            zoom = 4.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img_bytes = pix.tobytes("png")

            file_path = f"converted/{sheet_id}.png"
            supabase.storage.from_("floorplans").remove([file_path])
            supabase.storage.from_("floorplans").upload(
                path=file_path,
                file=img_bytes,
                file_options={"content-type": "image/png"},
            )

            single_page_doc = fitz.open()
            single_page_doc.insert_pdf(doc, from_page=page_number - 1, to_page=page_number - 1)
            single_page_pdf_bytes = single_page_doc.write()
            single_page_doc.close()  # P-5: prevent file descriptor leak

            pdf_path = f"originals/{sheet_id}.pdf"
            supabase.storage.from_("floorplans").remove([pdf_path])
            supabase.storage.from_("floorplans").upload(
                path=pdf_path,
                file=single_page_pdf_bytes,
                file_options={"content-type": "application/pdf"},
            )

            public_url = supabase.storage.from_("floorplans").get_public_url(file_path)
            supabase.table("sheets").update({"base_image_url": public_url}).eq("id", sheet_id).execute()
            return public_url

        import asyncio
        public_url = await asyncio.to_thread(process_upload)
        return {"status": "success", "image_url": public_url}

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NOTE: /process-sheet, /attach-original, and /inspect-and-stage-pdf
# have been moved to routers/drawings.py (AGENTS.md D.4).
# The legacy /process-sheet endpoint below is REMOVED — use /drawings/process-sheet.


@app.post("/extract-csi-toc", response_model=List[CsiSpecItem])
async def extract_csi_toc(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),  # Auth required on every endpoint
):
    """Rosetta Stone: Extract CSI MasterFormat codes from a PDF Table of Contents.
    
    Uses page.get_text() on body text (NOT doc.get_toc() which only reads PDF bookmarks).
    Scans the first 15 pages where TOCs typically reside.
    Returns a normalized list of CsiSpecItem for the frontend to build project_csi_specs.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    try:
        pdf_bytes = await file.read()

        def process_extraction() -> List[dict]:
            import re

            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            # Scan first 15 pages where TOC typically appears
            pages_to_scan = min(15, len(doc))

            # Robust CSI pattern: captures xx xx xx, xx.xx.xx, xx-xx-xx, or xxxxxx
            # Approved pattern: r"(?:\d{2}[\s.-]?){2}\d{2}" — handles all architect variants
            csi_pattern = re.compile(r'(?:\d{2}[\s.-]?){2}\d{2}')

            results: List[dict] = []
            seen: set = set()

            for page_num in range(pages_to_scan):
                page = doc.load_page(page_num)
                text = page.get_text()  # Body text, not bookmarks

                for line in text.splitlines():
                    line = line.strip()
                    if not line:
                        continue

                    match = csi_pattern.search(line)
                    if not match:
                        continue

                    raw_number = match.group(0)

                    # Strip formatting chars (spaces, dots, dashes) to get 6 clean digits
                    clean_digits = re.sub(r'[\s.-]', '', raw_number)
                    if len(clean_digits) != 6:
                        continue

                    # Reformat as standard "XX XX XX" for consistent storage
                    formatted = f"{clean_digits[0:2]} {clean_digits[2:4]} {clean_digits[4:6]}"

                    if formatted in seen:
                        continue
                    seen.add(formatted)

                    # Description: text after the CSI code on the same line
                    description = line[match.end():].strip().lstrip('.-\u2014 \t')
                    if not description:
                        # Fallback: text before the code (some formats list code last)
                        description = line[:match.start()].strip().rstrip('.-\u2014 \t')

                    if description:
                        results.append({"csi_number": formatted, "description": description})

            doc.close()
            return results

        import asyncio
        results = await asyncio.to_thread(process_extraction)
        return results

    except fitz.FileDataError:
        raise HTTPException(status_code=400, detail="Invalid or corrupted PDF file.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting CSI TOC: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-vectors/{sheet_id}")
async def extract_vectors(
    sheet_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Extracts structural vector lines from the PDF for use in the map snapping engine.
    Returns the parsed JSON payload to the Next.js frontend (Rule B.5).
    """
    try:
        await verify_project_sheet_access(sheet_id, user["sub"])
        
        pdf_path = f"originals/{sheet_id}.pdf"
        try:
            pdf_bytes = supabase.storage.from_("floorplans").download(pdf_path)
        except Exception:
            raise HTTPException(status_code=404, detail="Original PDF not found in Storage. Please re-upload or attach the source file.")

        import asyncio
        # Run heavy PyMuPDF extraction in a thread to prevent blocking
        vectors = await asyncio.to_thread(PDFMapService.extract_snapping_vectors, pdf_bytes)
        return {"status": "success", "vectors": vectors}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting vectors: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to extract vectors from PDF")

@app.post("/export-pdf/{sheet_id}")
async def export_status_pdf(
    sheet_id: str, 
    req: ExportRequest,
    user: dict = Depends(get_current_user),
):
    try:
        await verify_project_sheet_access(sheet_id, user["sub"])
        def process_export():
            pdf_path = f"originals/{sheet_id}.pdf"
            # Download as raw bytes directly from Supabase
            res = supabase.storage.from_("floorplans").download(pdf_path)
            
            doc = fitz.open(stream=res, filetype="pdf")
            page = doc[0]
            
            width = page.rect.width
            height = page.rect.height
            
            for markup in req.markups:
                if len(markup.points) < 3: continue
                
                # Re-map standard visual percentages to the exact unrotated PDF canvas logic
                fitz_points = [
                    (fitz.Point(
                        p.pctX * page.rect.width, 
                        p.pctY * page.rect.height
                    ) * page.derotation_matrix) + page.cropbox.tl
                    for p in markup.points
                ]
                
                color_rgb = hex_to_rgb(markup.color)
                fill_rgb = color_rgb
                
                shape_opacity = 0.8
                
                # Create standard Interactive Data Layer Markup (Allows moving, coloring, and Bluebeam modification seamlessly)
                annot = page.add_polygon_annot(fitz_points)
                annot.set_colors(stroke=color_rgb, fill=fill_rgb)
                annot.set_opacity(shape_opacity)
                annot.set_blendmode(fitz.PDF_BM_Multiply)
                
                # Make it look like a revision cloud
                try:
                    annot.set_border({"width": 1.5, "effect": fitz.PDF_ANNOT_LE_CLOUDY, "effect_intensity": 2.0})
                except Exception:
                    # Fallback for different PyMuPDF version signatures
                    try:
                        annot.set_border(width=1.5, dashes=None, effect=fitz.PDF_ANNOT_LE_CLOUDY, effect_intensity=2.0)
                    except Exception:
                        annot.set_border(width=1.5)
                
                info = annot.info
                info["title"] = "Design Pulse VE"
                info["content"] = "VE Markup"
                info["subject"] = "Visual Status"
                annot.set_info(info)
                
                annot.update()

            if req.legend_data:
                legend = req.legend_data
                
                with open("legend_debug.txt", "w") as df:
                    df.write(str(legend))
                    
                pctX = legend.get('pctX', 0.05)
                pctY = legend.get('pctY', 0.05)
                scaleX = legend.get('scaleX', 1)
                active_milestones = legend.get('active_milestones', [])

                # Correctly map a visual percentage point to the underlying unrotated PDF canvas
                def get_mapped_pt(px_pct, py_pct):
                    return (fitz.Point(
                        page.rect.width * px_pct,
                        page.rect.height * py_pct
                    ) * page.derotation_matrix) + page.cropbox.tl

                # Scale proportionally to what a user sees on a standard ~1200px map canvas
                overall_scale = scaleX * (page.rect.width / 1200.0)

                font_size = 14 * overall_scale
                title_size = 16 * overall_scale
                item_height = 24 * overall_scale
                padding = 16 * overall_scale
                legend_w = 200 * overall_scale

                active_temporal_states = legend.get('active_temporal_states', [])

                milestones_height = (30 * overall_scale) + (len(active_milestones) * item_height) if active_milestones else 0
                statuses_height = (30 * overall_scale) + (len(active_temporal_states) * item_height) if active_temporal_states else 0
                
                middle_pad = padding if (active_milestones and active_temporal_states) else 0
                total_items_height = milestones_height + statuses_height + middle_pad
                
                legend_h = padding * 2 + total_items_height

                def map_quad(vx_pct, vy_pct, vw_pct, vh_pct):
                    p1 = get_mapped_pt(vx_pct, vy_pct)
                    p2 = get_mapped_pt(vx_pct + vw_pct, vy_pct)
                    p3 = get_mapped_pt(vx_pct, vy_pct + vh_pct)
                    p4 = get_mapped_pt(vx_pct + vw_pct, vy_pct + vh_pct)
                    return fitz.Quad(p1, p2, p3, p4)

                w_pct = legend_w / page.rect.width
                h_pct = legend_h / page.rect.height

                # BG Quad
                bg_quad = map_quad(pctX, pctY, w_pct, h_pct)
                # Remove shadows, add gray border as requested by user
                page.draw_quad(bg_quad, color=(0.8,0.8,0.8), fill=(1,1,1), width=1.5 * overall_scale)

                def map_offset_pt(x_off, y_off):
                    return get_mapped_pt(pctX + (x_off / page.rect.width), pctY + (y_off / page.rect.height))

                def map_offset_quad(x_off, y_off, w, h):
                    return map_quad(pctX + (x_off / page.rect.width), pctY + (y_off / page.rect.height), w / page.rect.width, h / page.rect.height)

                if active_milestones:
                    # Title 1
                    title_1_pt = map_offset_pt(padding, padding + title_size * 0.8)
                    page.insert_text(title_1_pt, "Milestones", fontsize=title_size, fontname="hebo", color=hex_to_rgb("#334155"), rotate=page.rotation)

                    y_offset = padding + (30 * overall_scale)
                    for m in active_milestones:
                        r_rgb = hex_to_rgb(m['color'])
                        # Swatch is 14x14 
                        swatch_quad = map_offset_quad(padding, y_offset, 14 * overall_scale, 14 * overall_scale)
                        page.draw_quad(swatch_quad, color=hex_to_rgb("#cbd5e1"), fill=r_rgb, width=1*overall_scale)
                        
                        # Text
                        text_pt = map_offset_pt(padding + 22 * overall_scale, y_offset + 11 * overall_scale)
                        page.insert_text(text_pt, m['name'], fontsize=font_size, fontname="helv", color=hex_to_rgb("#475569"), rotate=page.rotation)
                        
                        y_offset += item_height

                if active_temporal_states:
                    start_y = padding + milestones_height + middle_pad
                    title_2_pt = map_offset_pt(padding, start_y + title_size * 0.8)
                    page.insert_text(title_2_pt, "Map Statuses", fontsize=title_size, fontname="hebo", color=hex_to_rgb("#334155"), rotate=page.rotation)

                    y_offset = start_y + (30 * overall_scale)
                    TEMPORAL_COLORS = {
                        'planned': '#94a3b8',
                        'ongoing': '#f59e0b',
                        'completed': '#10b981',
                    }
                    for state in active_temporal_states:
                        icon_color = TEMPORAL_COLORS.get(state, '#cbd5e1')
                        
                        center_vx = padding + 14 * overall_scale
                        center_vy = y_offset + 10 * overall_scale
                        center_pt = map_offset_pt(center_vx, center_vy)
                        
                        # Radius for the circle (match 9.6 from before but visually it was 12 * 0.8 = 9.6)
                        r_val = 9.6 * overall_scale
                        
                        page.draw_circle(center_pt, r_val, color=hex_to_rgb(icon_color), fill=hex_to_rgb("#ffffff"), width=2.5*overall_scale)
                        
                        # Draw custom icons perfectly matching vector offsets
                        if state == 'completed':
                            c1 = map_offset_pt(center_vx - 4 * overall_scale, center_vy + 1 * overall_scale)
                            c2 = map_offset_pt(center_vx - 1 * overall_scale, center_vy + 4 * overall_scale)
                            c3 = map_offset_pt(center_vx + 5 * overall_scale, center_vy - 4 * overall_scale)
                            page.draw_polyline([c1, c2, c3], color=hex_to_rgb(icon_color), width=2*overall_scale)
                        elif state == 'planned':
                            rc_w = 8 * overall_scale
                            rc_h = 8 * overall_scale
                            r_q = map_offset_quad(center_vx - 4*overall_scale, center_vy - 4*overall_scale, rc_w, rc_h)
                            page.draw_quad(r_q, color=hex_to_rgb(icon_color), width=1.5*overall_scale)
                            l1 = map_offset_pt(center_vx - 4*overall_scale, center_vy - 1*overall_scale)
                            l2 = map_offset_pt(center_vx + 4*overall_scale, center_vy - 1*overall_scale)
                            page.draw_line(l1, l2, color=hex_to_rgb(icon_color), width=1.5*overall_scale)
                            p1 = map_offset_pt(center_vx - 2*overall_scale, center_vy - 6*overall_scale)
                            p2 = map_offset_pt(center_vx - 2*overall_scale, center_vy - 4*overall_scale)
                            p3 = map_offset_pt(center_vx + 2*overall_scale, center_vy - 6*overall_scale)
                            p4 = map_offset_pt(center_vx + 2*overall_scale, center_vy - 4*overall_scale)
                            page.draw_line(p1, p2, color=hex_to_rgb(icon_color), width=1.5*overall_scale)
                            page.draw_line(p3, p4, color=hex_to_rgb(icon_color), width=1.5*overall_scale)
                        elif state == 'ongoing':
                            h1 = map_offset_pt(center_vx - 4*overall_scale, center_vy - 4*overall_scale)
                            h2 = map_offset_pt(center_vx + 4*overall_scale, center_vy - 4*overall_scale)
                            h3 = map_offset_pt(center_vx - 4*overall_scale, center_vy + 4*overall_scale)
                            h4 = map_offset_pt(center_vx + 4*overall_scale, center_vy + 4*overall_scale)
                            page.draw_polyline([h1, h2, h3, h4, h1], color=hex_to_rgb(icon_color), width=1.5*overall_scale)
                        
                        state_text = state.capitalize()
                        text_pt = map_offset_pt(padding + 32 * overall_scale, y_offset + 14 * overall_scale)
                        page.insert_text(text_pt, state_text, fontsize=font_size, fontname="helv", color=hex_to_rgb("#475569"), rotate=page.rotation)
                        
                        y_offset += item_height

            if req.include_data:
                # We determine landscape or portrait to append a correctly oriented trailing page
                p_w, p_h = (height, width) if width > height else (width, height)
                new_page = doc.new_page(width=p_w, height=p_h)
                
                title = f"{req.project_name} - {req.sheet_name} VE Log"
                new_page.insert_text(fitz.Point(30, 50), title, fontsize=24, fontname="helv", color=(0,0,0))
                
                y_offset = 100
                x_offset = 30
                for i, m in enumerate(req.markups):
                    text = f"Markup {i+1}"
                    col = i % 4
                    row = i // 4
                    px = x_offset + (col * (p_w - 60) / 4)
                    py = y_offset + (row * 20)
                    new_page.insert_text(fitz.Point(px, py), text, fontsize=12, fontname="helv", color=(0,0,0))
                    
            pdf_bytes = doc.write()
            doc.close()
            
            return pdf_bytes

        import asyncio
        pdf_bytes = await asyncio.to_thread(process_export)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={req.project_name}_{req.sheet_name}_Status.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    except fitz.FileDataError:
        raise HTTPException(status_code=404, detail="Original PDF not found in Storage. Please re-upload or attach the source file.")
    except Exception as e:
         print(f"Error exporting pdf: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))