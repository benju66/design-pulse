from pydantic import BaseModel
from typing import List, Optional, Dict

class PointData(BaseModel):
    pctX: float
    pctY: float

class PolygonData(BaseModel):
    zone_id: str
    zone_label: str
    points: List[PointData]
    fill_color: Optional[str] = None
    stroke_color: Optional[str] = None
    opacity: Optional[float] = 0.8
    dash_pattern: Optional[List[int]] = None
    title: Optional[str] = None
    description: Optional[str] = None

class LegendItem(BaseModel):
    label: str
    color: str
    shape: Optional[str] = 'square' # 'square', 'circle', 'line'

class ExportRequest(BaseModel):
    include_data: bool
    polygons: List[PolygonData]
    project_name: str
    sheet_name: str
    legend_items: Optional[List[LegendItem]] = None
    legend_config: Optional[Dict] = None
