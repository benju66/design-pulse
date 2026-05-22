"use client";

import { useState } from 'react';
import { List, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
const FloorplanCanvas = dynamic(() => import('@/components/FloorplanCanvas'), { ssr: false });
import { SheetTabStrip } from '@/components/canvas/SheetTabStrip';
import { DrawingGrid } from '@/components/drawings/DrawingGrid';
import DrawingDetailPanel from '@/components/drawings/DrawingDetailPanel';
import { PdfImportModal } from '@/components/drawings/PdfImportModal';
import { useUIStore } from '@/stores/useUIStore';
import { useMapStore } from '@/stores/useMapStore';
import { useProjectSheets, useSheetMarkups, markupsToZones, useUpdateSheetMarkups } from '@/hooks/useMapQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';

interface DrawingsViewProps {
  projectId: string;
}

export function DrawingsView({ projectId }: DrawingsViewProps) {
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);

  // ── Map/Drawing Hooks ──
  const activeSheetId = useMapStore((s) => s.activeSheetId);
  const isViewerOpen = useMapStore((s) => s.isViewerOpen);
  const setIsViewerOpen = useMapStore((s) => s.setIsViewerOpen);
  
  const { data: sheets = [] } = useProjectSheets(projectId);
  const { data: rawMarkups = [] } = useSheetMarkups(activeSheetId || null);
  const updateMarkups = useUpdateSheetMarkups();
  const { data: settings } = useProjectSettings(projectId);

  const drawingGridViewMode = useUIStore(state => state.drawingGridViewMode);
  const selectedDrawingId = useUIStore(state => state.selectedDrawingId);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const zones = markupsToZones(rawMarkups);

  // Determine if the sheet is ready for canvas rendering.
  const isSheetReady = activeSheet?.status === 'ready'
    && activeSheet.max_zoom != null
    && activeSheet.original_width != null
    && activeSheet.original_height != null;

  // Zone persistence — all unlinked (opportunityId: null, AGENTS.md C11)
  const saveZones = (updatedZones: typeof zones) => {
    if (!activeSheetId) return;
    updateMarkups.mutate({
      sheetId: activeSheetId,
      opportunityId: null,
      markups: updatedZones,
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* View-Specific Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Drawings
        </h2>
        <div className="flex gap-3 items-center">
          {isViewerOpen ? (
            <Button
              variant="secondary"
              onClick={() => setIsViewerOpen(false)}
            >
              <List size={16} className="mr-2" />
              Close Drawing
            </Button>
          ) : (
            <Button
              intent="drawings"
              id="drawings-import-btn"
              onClick={() => setIsPdfImportOpen(true)}
            >
              <Upload size={16} className="mr-2" />
              Import Drawings
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 relative bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-row">
          {!isViewerOpen ? (
            <>
              <div className={`flex flex-col flex-1 min-w-0 h-full @container ${
                (drawingGridViewMode === 'split' && selectedDrawingId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
              }`}>
                <DrawingGrid
                  projectId={projectId}
                  sheets={sheets}
                  disciplines={settings?.disciplines || []}
                  onOpenViewer={(sheetId) => {
                    const store = useMapStore.getState();
                    store.setActiveSheetId(sheetId);
                    store.addOpenSheetId(sheetId);
                    setIsViewerOpen(true);
                  }}
                />
              </div>
              
              <DrawingDetailPanel
                projectId={projectId}
                sheets={sheets}
                disciplines={settings?.disciplines || []}
              />
            </>
          ) : activeSheetId && isSheetReady ? (
            <>
              <FloorplanCanvas
                projectId={projectId}
                sheetId={activeSheetId}
                maxZoom={activeSheet.max_zoom ?? undefined}
                originalWidth={activeSheet.original_width ?? undefined}
                originalHeight={activeSheet.original_height ?? undefined}
                zones={zones}
                onPolygonComplete={(points) => {
                  const newZone = {
                    id: crypto.randomUUID(),
                    label: '',
                    coordinates: points,
                    color: '#3b82f6',
                    opacity: 0.35,
                  };
                  saveZones([...zones, newZone]);
                }}
                onUpdateZonePolygon={(zoneId, points) => {
                  saveZones(
                    zones.map((z) => (z.id === zoneId ? { ...z, coordinates: points } : z))
                  );
                }}
                onDeleteZone={(zoneId) => {
                  const ids = Array.isArray(zoneId) ? zoneId : [zoneId];
                  saveZones(zones.filter((z) => !ids.includes(z.id)));
                }}
              />
            </>
          ) : activeSheetId && activeSheet?.status === 'processing' ? (
            <div className="flex flex-col h-full items-center justify-center gap-4 text-slate-400 dark:text-slate-500">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent" />
              <p className="text-sm font-medium">Processing sheet&hellip;</p>
              <p className="text-xs text-slate-400">
                {activeSheet.progress_percent != null && activeSheet.progress_percent > 0
                  ? `${activeSheet.progress_percent}% complete`
                  : 'Generating tile pyramid'}
              </p>
            </div>
          ) : activeSheetId && activeSheet?.status === 'error' ? (
            <div className="flex flex-col h-full items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
              <p className="text-sm text-red-400">Processing failed.</p>
              <p className="text-xs">Right-click the tab below and choose <span className="font-semibold text-sky-400">Re-upload PDF</span>.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
              <p className="text-sm">No sheets yet.</p>
              <p className="text-xs">Click <span className="font-semibold text-sky-500">+ Add Sheet</span> below to upload a PDF.</p>
            </div>
          )}
        </div>
        {isViewerOpen && <SheetTabStrip projectId={projectId} sheets={sheets} />}
      </div>

      {isPdfImportOpen && (
        <PdfImportModal
          projectId={projectId}
          onClose={() => setIsPdfImportOpen(false)}
        />
      )}
    </div>
  );
}
