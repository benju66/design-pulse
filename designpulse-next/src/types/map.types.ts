
// ── Drawing Sets ──────────────────────────────────────────────────────────────
export interface DrawingSet {
  id: string;
  project_id: string;
  set_name: string;
  issue_date: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── PDF Inspection (UOPM pipeline step 1) ────────────────────────────────────
export interface StagedPageMeta {
  page_index: number;
  suggested_label: string;
  width: number;
  height: number;
  thumbnail_b64: string;
}

export interface InspectPdfResponse {
  staged_key: string;
  page_count: number;
  truncated: boolean;
  filename: string;
  pages: StagedPageMeta[];
}

// ── Domain type for a project_sheets row ─────────────────────────────────────
// Typed view of database.types.ts project_sheets.Row — used throughout the
// Drawings module without importing the raw Database type.
export interface ProjectSheet {
  id: string;
  project_id: string;
  sheet_name: string;
  status: 'processing' | 'ready' | 'error';
  progress_percent: number;
  original_width: number | null;
  original_height: number | null;
  max_zoom: number | null;
  // ── UOPM provenance columns (Step 4a) ────────────────────────────────────
  drawing_set_id: string | null;
  discipline_id: string | null;
  source_filename: string | null;
  source_page_index: number | null;
  staged_key: string | null;     // internal — not shown in UI
  status_message: string | null; // surfaced in error tooltip (BUG-7)
  drawing_title: string | null;
  revision: string | null;
  drawing_date: string | null;
  received_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Point {
  pctX: number;
  pctY: number;
}

export interface Zone {
  id: string;
  label: string;
  coordinates: Point[];
  color: string;
  opacity: number;
  // Metadata for linking to VE/Coordination rows
  opportunityId?: string;
}

export type ToolMode = 'pan' | 'draw' | 'edit' | 'select' | 'multi_select' | 'add_node' | 'delete_node' | 'stamp';

export interface MapState {
  toolMode: ToolMode;
  selectedZoneIds: string[];
  editingZoneId: string | null;
  activeSheetId: string;
  openSheetIds: string[];
  savingZoneId: string | null;
  pendingPolygonPoints: Point[] | null;
  isViewerOpen: boolean;
  // NOTE: selectedFile, pdfPageNumber, isUploading removed in v2 (AGENTS.md C34)

  setToolMode: (mode: ToolMode | ((prev: ToolMode) => ToolMode)) => void;
  setSelectedZoneIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  toggleSelectedZoneId: (id: string) => void;
  clearSelectedZones: () => void;
  setEditingZoneId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setActiveSheetId: (id: string | ((prev: string) => string)) => void;
  addOpenSheetId: (id: string) => void;
  removeOpenSheetId: (id: string) => void;
  clearOpenSheets: () => void;
  setSavingZoneId: (val: string | null | ((prev: string | null) => string | null)) => void;
  setPendingPolygonPoints: (val: Point[] | null | ((prev: Point[] | null) => Point[] | null)) => void;
  setIsViewerOpen: (val: boolean) => void;
}

// Minimal RBush generic interface to ensure spatial indexing operations are typed
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RBush<T> {
  insert(item: T): this;
  load(data: T[]): this;
  remove(item: T, equals?: (a: T, b: T) => boolean): this;
  clear(): this;
  search(bbox: BBox): T[];
  all(): T[];
  collides(bbox: BBox): boolean;
  toJSON(): unknown;
  fromJSON(data: unknown): this;
}

// Canonical VectorLine type — moved from useSnappingVectors.ts to prevent
// dependency inversion (utils must never import from hooks).
export interface VectorLine extends BBox {
  lineData: { start: Point; end: Point };
}

// Layout dimensions computed from floor plan image fitting.
// Canonical location — moved from MappedZone.tsx.
export interface LayoutConfig {
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
}

// Canvas-level rendering settings passed to child components.
export interface CanvasRenderSettings {
  showHistoryHover: boolean;
  markupThickness: number;
}

// Map snapping configuration for vector-assisted drawing.
export interface MapSnappingSettings {
  enableSnapping: boolean;
  snappingStrength: number;
  showCrosshair: boolean;
}

// Legend position/transform state for the Konva legend group.
export interface LegendTransform {
  isVisible: boolean;
  pctX: number;
  pctY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

// ── Async snap callback type ──────────────────────────────────────────────────
// Replaces the legacy synchronous RBush<VectorLine> prop pattern.
// Wraps the snapping Web Worker promise API. Returns the snapped Point if
// a snap candidate is found within thresholdPct, or null if not.
export type SnapCallback = (
  point: Point,
  thresholdPct: number
) => Promise<Point | null>;
