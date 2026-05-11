export interface SheetSelection {
  pageIndex: number;
  sheetName: string;
  drawingTitle: string;
  revision: string;
  drawingDate: string;
  receivedDate: string;
  selected: boolean;
}

export type ModalPhase = 'uploading' | 'global_assignment' | 'title_block_training' | 'extracting' | 'wizard' | 'dispatching' | 'done';

export interface ZoneDefinition {
  field: string;
  rect: [number, number, number, number]; // x, y, w, h
}
