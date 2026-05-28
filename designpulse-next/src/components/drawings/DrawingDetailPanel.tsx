"use client";
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, Trash2, Maximize, Minimize } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ProjectSheet } from '@/types/map.types';
import { DisciplineConfig } from '@/types/models';
import { useUpdateProjectSheet, useDeleteProjectSheet } from '@/hooks/useMapQueries';
import { supabase } from '@/supabaseClient';
import { format } from 'date-fns';

interface DrawingDetailPanelProps {
  projectId: string;
  sheets: ProjectSheet[];
  disciplines: DisciplineConfig[];
}

export default function DrawingDetailPanel({ projectId, sheets, disciplines }: DrawingDetailPanelProps) {
  const selectedDrawingId = useUIStore(state => state.selectedDrawingId);
  const setSelectedDrawingId = useUIStore(state => state.setSelectedDrawingId);
  const viewMode = useUIStore(state => state.drawingGridViewMode);

  const [panelWidth, setPanelWidth] = useState(40); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const sheet = sheets.find(s => s.id === selectedDrawingId);

  const updateSheetMutation = useUpdateProjectSheet();
  const deleteSheetMutation = useDeleteProjectSheet();

  const [localName, setLocalName] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [localRevision, setLocalRevision] = useState('');
  const [localDrawingDate, setLocalDrawingDate] = useState('');
  const [localReceivedDate, setLocalReceivedDate] = useState('');

  useEffect(() => {
    if (sheet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalName(sheet.sheet_name || '');
      setLocalTitle(sheet.drawing_title || '');
      setLocalRevision(sheet.revision || '');
      setLocalDrawingDate(sheet.drawing_date || '');
      setLocalReceivedDate(sheet.received_date || '');
    }
  }, [sheet]);

  if (viewMode !== 'split' || !selectedDrawingId || !sheet) return null;

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = ((window.innerWidth - moveEvent.clientX) / window.innerWidth) * 100;
      const finalWidth = Math.max(20, Math.min(newWidth, 80));
      if (panelRef.current) panelRef.current.style.width = finalWidth + '%';
    };
    const handleMouseUp = (upEvent: MouseEvent) => {
      const newWidth = ((window.innerWidth - upEvent.clientX) / window.innerWidth) * 100;
      const finalWidth = Math.max(20, Math.min(newWidth, 80));
      setPanelWidth(finalWidth);
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleNameSave = () => {
    if (localName !== sheet.sheet_name) {
      updateSheetMutation.mutate({ projectId, sheetId: sheet.id, updates: { sheet_name: localName } });
    }
  };

  const handleTitleSave = () => {
    if (localTitle !== (sheet.drawing_title || '')) {
      updateSheetMutation.mutate({ projectId, sheetId: sheet.id, updates: { drawing_title: localTitle || null } });
    }
  };

  const handleRevisionSave = () => {
    if (localRevision !== (sheet.revision || '')) {
      updateSheetMutation.mutate({ projectId, sheetId: sheet.id, updates: { revision: localRevision || null } });
    }
  };

  const handleDrawingDateSave = () => {
    if (localDrawingDate !== (sheet.drawing_date || '')) {
      updateSheetMutation.mutate({ projectId, sheetId: sheet.id, updates: { drawing_date: localDrawingDate || null } });
    }
  };

  const handleReceivedDateSave = () => {
    if (localReceivedDate !== (sheet.received_date || '')) {
      updateSheetMutation.mutate({ projectId, sheetId: sheet.id, updates: { received_date: localReceivedDate || null } });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, originalValue: string, setter: (val: string) => void) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setter(originalValue);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this drawing?')) {
      deleteSheetMutation.mutate({ projectId, sheetId: sheet.id });
      setSelectedDrawingId(null);
    }
  };

  let publicUrl = '';
  if (sheet.status === 'ready') {
    const { data } = supabase.storage.from('project_drawings').getPublicUrl(`${projectId}/${sheet.id}/thumb.png`);
    publicUrl = data.publicUrl;
  }

  return (
    <div 
      ref={panelRef}
      style={!isMaximized ? { width: `${panelWidth}%` } : {}}
      className={`relative bg-white dark:bg-slate-900 shadow-[rgba(0,0,0,0.1)_-4px_0px_10px_0px] border-l border-slate-200 dark:border-slate-800 z-10 flex flex-col shrink-0 max-w-full ${
        isMaximized ? 'absolute top-0 bottom-0 right-0 w-full z-50 transition-all duration-300' : (isDragging ? 'h-full transition-none' : 'h-full transition-all duration-300')
      }`}
    >
      {!isMaximized && (
        <div 
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-20 hover:bg-sky-500/20 active:bg-sky-500/40 transition-colors"
        />
      )}
      
      {/* Header */}
      <div className="flex items-center p-4 border-b border-slate-200 dark:border-slate-800 relative w-full h-16 shrink-0 bg-slate-50 dark:bg-slate-900/50">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate pr-28 min-w-0 flex-1">
          {sheet.sheet_name || 'Unnamed Drawing'}
        </h3>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 pl-2">
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button 
            onClick={() => {
              setIsMaximized(false);
              setSelectedDrawingId(null);
            }}
            className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
            title="Close Panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-white dark:bg-slate-900 min-w-0 w-full flex flex-col gap-6">
        
        {/* Thumbnail Section */}
        {publicUrl && (
          <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicUrl} alt="Thumbnail" className="w-full h-full object-contain" />
          </div>
        )}

        {/* Edit Metadata Section */}
        <div className="flex flex-col gap-4">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Details</h4>
          
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Drawing Number</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => handleKeyDown(e, sheet.sheet_name || '', setLocalName)}
              placeholder="e.g., A1.01"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Drawing Title</label>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => handleKeyDown(e, sheet.drawing_title || '', setLocalTitle)}
              placeholder="e.g., Floor Plan"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Revision</label>
            <input
              type="text"
              value={localRevision}
              onChange={(e) => setLocalRevision(e.target.value)}
              onBlur={handleRevisionSave}
              onKeyDown={(e) => handleKeyDown(e, sheet.revision || '', setLocalRevision)}
              placeholder="e.g., Rev 1"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Drawing Date</label>
              <input
                type="date"
                value={localDrawingDate}
                onChange={(e) => setLocalDrawingDate(e.target.value)}
                onBlur={handleDrawingDateSave}
                onKeyDown={(e) => handleKeyDown(e, sheet.drawing_date || '', setLocalDrawingDate)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Received Date</label>
              <input
                type="date"
                value={localReceivedDate}
                onChange={(e) => setLocalReceivedDate(e.target.value)}
                onBlur={handleReceivedDateSave}
                onKeyDown={(e) => handleKeyDown(e, sheet.received_date || '', setLocalReceivedDate)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Discipline</label>
            <select
              value={sheet.discipline_id || ''}
              onChange={(e) => {
                updateSheetMutation.mutate({
                  projectId,
                  sheetId: sheet.id,
                  updates: { discipline_id: e.target.value || null },
                });
              }}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            >
              <option value="">Uncategorized</option>
              {disciplines.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{sheet.status}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Upload Date</label>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {sheet.created_at ? format(new Date(sheet.created_at), 'MMM d, yyyy') : 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between">
          <div className="relative group">
            <button 
              onClick={handleDelete}
              disabled={deleteSheetMutation.isPending}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              <Trash2 size={20} />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
              Delete Drawing
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
