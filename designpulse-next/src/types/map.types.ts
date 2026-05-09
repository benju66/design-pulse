

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
  savingZoneId: string | null;
  pendingPolygonPoints: Point[] | null;
  selectedFile: File | null;
  pdfPageNumber: number;
  isUploading: boolean;

  setToolMode: (mode: ToolMode | ((prev: ToolMode) => ToolMode)) => void;
  setSelectedZoneIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  toggleSelectedZoneId: (id: string) => void;
  clearSelectedZones: () => void;
  setEditingZoneId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setActiveSheetId: (id: string | ((prev: string) => string)) => void;
  setSavingZoneId: (val: string | null | ((prev: string | null) => string | null)) => void;
  setPendingPolygonPoints: (val: Point[] | null | ((prev: Point[] | null) => Point[] | null)) => void;
  setSelectedFile: (val: File | null | ((prev: File | null) => File | null)) => void;
  setPdfPageNumber: (val: number | ((prev: number) => number)) => void;
  setIsUploading: (val: boolean | ((prev: boolean) => boolean)) => void;
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
