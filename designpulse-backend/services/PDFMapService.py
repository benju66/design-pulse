import io
import fitz  # PyMuPDF
import math
from typing import List, Dict, Tuple
from pydantic import BaseModel
from .models import PolygonData, ExportRequest, LegendItem

def hex_to_rgb(color_str: str) -> Tuple[float, float, float]:
    if not color_str:
        return (0, 0, 0)
    import re
    rgba_match = re.search(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', color_str)
    if rgba_match:
        return tuple(int(rgba_match.group(i))/255.0 for i in (1, 2, 3))
    
    color_str = color_str.lstrip('#')
    if len(color_str) >= 6:
        return tuple(int(color_str[i:i+2], 16)/255.0 for i in (0, 2, 4))
    return (0, 0, 0)

class PDFMapService:
    @staticmethod
    def convert_pdf_to_image(pdf_bytes: bytes, page_number: int = 1, zoom: float = 4.0) -> Tuple[bytes, bytes]:
        """
        Converts a single page of a PDF to a PNG image and extracts that page as a standalone PDF.
        Returns: (png_bytes, single_page_pdf_bytes)
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        if page_number < 1 or page_number > len(doc):
            raise ValueError(f"Page {page_number} does not exist. This PDF has {len(doc)} pages.")
            
        page = doc.load_page(page_number - 1)
        
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        
        single_page_doc = fitz.open()
        single_page_doc.insert_pdf(doc, from_page=page_number - 1, to_page=page_number - 1)
        single_page_pdf_bytes = single_page_doc.write()
        
        doc.close()
        return img_bytes, single_page_pdf_bytes

    @staticmethod
    def extract_snapping_vectors(pdf_bytes: bytes) -> List[Dict]:
        """
        Extracts structural vector lines from the PDF for use in the snapping engine.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            raise ValueError("PDF is empty")
            
        page = doc[0]
        width = page.rect.width
        height = page.rect.height
        
        inv_derot = ~page.derotation_matrix
        tl = page.cropbox.tl
        
        drawings = page.get_drawings()
        clean_lines = []

        def map_point(p):
            p_mapped = (p - tl) * inv_derot
            return {"pctX": p_mapped.x / width, "pctY": p_mapped.y / height}

        for path in drawings:
            # Reject curves
            if any(item[0] in ('c', 'v', 'y') for item in path["items"]):
                continue
                
            # Reject microscopic lineweights
            path_width = path.get("width")
            if path_width is not None and path_width < 0.2:
                continue

            for item in path["items"]:
                if item[0] == 'l':
                    p1, p2 = item[1], item[2]
                    clean_lines.append({"start": map_point(p1), "end": map_point(p2)})
                
                elif item[0] == 're':
                    rect = item[1]
                    p1, p2, p3, p4 = rect.tl, rect.tr, rect.br, rect.bl
                    clean_lines.append({"start": map_point(p1), "end": map_point(p2)})
                    clean_lines.append({"start": map_point(p2), "end": map_point(p3)})
                    clean_lines.append({"start": map_point(p3), "end": map_point(p4)})
                    clean_lines.append({"start": map_point(p4), "end": map_point(p1)})

        doc.close()
        return clean_lines

    @staticmethod
    def export_annotated_pdf(pdf_bytes: bytes, req: ExportRequest) -> bytes:
        """
        Injects standard, generic polygon annotations and legends into the PDF.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            raise ValueError("PDF is empty")
            
        page = doc[0]
        
        for poly in req.polygons:
            if not poly.points or len(poly.points) < 3:
                continue
            
            fitz_points = [
                (fitz.Point(
                    p.pctX * page.rect.width, 
                    p.pctY * page.rect.height
                ) * page.derotation_matrix) + page.cropbox.tl
                for p in poly.points
            ]
            
            stroke_rgb = hex_to_rgb(poly.stroke_color) if poly.stroke_color else hex_to_rgb(poly.fill_color)
            fill_rgb = hex_to_rgb(poly.fill_color) if poly.fill_color else None
            
            annot = page.add_polygon_annot(fitz_points)
            if fill_rgb:
                annot.set_colors(stroke=stroke_rgb, fill=fill_rgb)
            else:
                annot.set_colors(stroke=stroke_rgb)
                
            annot.set_opacity(poly.opacity if poly.opacity is not None else 0.8)
            annot.set_blendmode(fitz.PDF_BM_Multiply)
            
            if poly.dash_pattern:
                annot.set_border(width=1.5, dashes=poly.dash_pattern)
            else:
                annot.set_border(width=1.5)
            
            info = annot.info
            info["title"] = poly.title or "DesignPulse Map Module"
            info["content"] = poly.description or f"Zone: {poly.zone_label}"
            annot.set_info(info)
            annot.update()

        if req.legend_items and req.legend_config:
            legend = req.legend_config
            pctX = legend.get('pctX', 0.05)
            pctY = legend.get('pctY', 0.05)
            scaleX = legend.get('scaleX', 1)
            
            def get_mapped_pt(px_pct, py_pct):
                return (fitz.Point(
                    page.rect.width * px_pct,
                    page.rect.height * py_pct
                ) * page.derotation_matrix) + page.cropbox.tl

            overall_scale = scaleX * (page.rect.width / 1200.0)

            font_size = 14 * overall_scale
            title_size = 16 * overall_scale
            item_height = 24 * overall_scale
            padding = 16 * overall_scale
            legend_w = 200 * overall_scale
            
            items_height = (30 * overall_scale) + (len(req.legend_items) * item_height)
            legend_h = padding * 2 + items_height

            def map_quad(vx_pct, vy_pct, vw_pct, vh_pct):
                p1 = get_mapped_pt(vx_pct, vy_pct)
                p2 = get_mapped_pt(vx_pct + vw_pct, vy_pct)
                p3 = get_mapped_pt(vx_pct, vy_pct + vh_pct)
                p4 = get_mapped_pt(vx_pct + vw_pct, vy_pct + vh_pct)
                return fitz.Quad(p1, p2, p3, p4)

            w_pct = legend_w / page.rect.width
            h_pct = legend_h / page.rect.height

            bg_quad = map_quad(pctX, pctY, w_pct, h_pct)
            page.draw_quad(bg_quad, color=(0.8,0.8,0.8), fill=(1,1,1), width=1.5 * overall_scale)

            def map_offset_pt(x_off, y_off):
                return get_mapped_pt(pctX + (x_off / page.rect.width), pctY + (y_off / page.rect.height))

            def map_offset_quad(x_off, y_off, w, h):
                return map_quad(pctX + (x_off / page.rect.width), pctY + (y_off / page.rect.height), w / page.rect.width, h / page.rect.height)

            title_pt = map_offset_pt(padding, padding + title_size * 0.8)
            page.insert_text(title_pt, "Legend", fontsize=title_size, fontname="hebo", color=hex_to_rgb("#334155"), rotate=page.rotation)

            y_offset = padding + (30 * overall_scale)
            for item in req.legend_items:
                r_rgb = hex_to_rgb(item.color)
                
                if item.shape == 'circle':
                    center_pt = map_offset_pt(padding + 7 * overall_scale, y_offset + 7 * overall_scale)
                    page.draw_circle(center_pt, 7 * overall_scale, color=r_rgb, fill=r_rgb, width=1*overall_scale)
                elif item.shape == 'line':
                    p1 = map_offset_pt(padding, y_offset + 7 * overall_scale)
                    p2 = map_offset_pt(padding + 14 * overall_scale, y_offset + 7 * overall_scale)
                    page.draw_line(p1, p2, color=r_rgb, width=2.5*overall_scale)
                else:
                    swatch_quad = map_offset_quad(padding, y_offset, 14 * overall_scale, 14 * overall_scale)
                    page.draw_quad(swatch_quad, color=hex_to_rgb("#cbd5e1"), fill=r_rgb, width=1*overall_scale)
                
                text_pt = map_offset_pt(padding + 22 * overall_scale, y_offset + 11 * overall_scale)
                page.insert_text(text_pt, item.label, fontsize=font_size, fontname="helv", color=hex_to_rgb("#475569"), rotate=page.rotation)
                
                y_offset += item_height

        if req.include_data:
            width = page.rect.width
            height = page.rect.height
            p_w, p_h = (height, width) if width > height else (width, height)
            new_page = doc.new_page(width=p_w, height=p_h)
            
            title = f"{req.project_name} - {req.sheet_name} Report"
            new_page.insert_text(fitz.Point(30, 50), title, fontsize=24, fontname="helv", color=(0,0,0))
            
            y_offset = 100
            x_offset = 30
            for i, p in enumerate(req.polygons):
                text = f"{p.zone_label}: {p.title or ''}"
                col = i % 4
                row = i // 4
                px = x_offset + (col * (p_w - 60) / 4)
                py = y_offset + (row * 20)
                new_page.insert_text(fitz.Point(px, py), text, fontsize=12, fontname="helv", color=(0,0,0))
                
        pdf_bytes_out = doc.write()
        doc.close()
        
        return pdf_bytes_out