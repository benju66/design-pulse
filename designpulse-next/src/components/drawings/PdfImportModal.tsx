'use client';

/**
 * PdfImportModal — Steps 8b / 9
 *
 * Two-phase modal orchestrating the UOPM pipeline:
 *
 *   Phase 1 — SELECTING (after file drop, while inspect call runs):
 *     - PageThumbnailGrid: displays low-res thumbnails for each detected page.
 *     - User checks pages to import, optionally edits sheet names.
 *     - Drawing Set selector: choose an existing set or create a new one.
 *     - "Import N Sheets" button: starts Phase 2.
 *
 *   Phase 2 — DISPATCHING:
 *     - Shows a progress list with row-level status indicators.
 *     - Calls useBulkImportSheets which batches dispatch calls (C20).
 *     - Each sheet transitions to 'processing' → 'ready'/'error' via Realtime.
 *     - Modal auto-closes when all sheets reach a terminal state (or user clicks Done).
 *
 * AGENTS.md guardrails:
 *   - C8: client-minted UUIDs (in useBulkImportSheets)
 *   - C16: click-outside uses pointerdown + ref.contains
 *   - C17: zero-JS tooltips for status badges
 *   - C18: Escape saves → modal discards without import (no data loss risk pre-dispatch)
 *   - C20: batch size 5 in useBulkImportSheets
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Upload, AlertCircle,
  Loader2, CheckCircle, ChevronRight, Calendar
} from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { InspectPdfResponse } from '@/types/map.types';
import { inspectAndStagePdfService } from '@/services/api';
import { useBulkImportSheets } from '@/hooks/useMapQueries';
import { useDrawingSets, useCreateDrawingSet } from '@/hooks/useDrawingSetQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { SheetSelection, ModalPhase } from './PdfImportModal.types';
import { WizardView } from './WizardView';
import { TitleBlockTrainingView } from './TitleBlockTrainingView';

interface PdfImportModalProps {
  projectId: string;
  onClose: () => void;
}

export function PdfImportModal({ projectId, onClose }: PdfImportModalProps) {
  // Get auth token via supabase client (no external auth-helpers dependency)
  const [token, setToken] = useState('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? '');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? '');
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Drawing set state ──────────────────────────────────────────────────────
  const { data: existingSets = [] } = useDrawingSets(projectId);
  const createSet = useCreateDrawingSet();
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDate, setNewSetDate] = useState('');
  const [createNewSet, setCreateNewSet] = useState(false);

  // ── Discipline state ───────────────────────────────────────────────────────
  const { data: settings } = useProjectSettings(projectId);
  const disciplines = settings?.disciplines || [];
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');

  // ── Inspection state ───────────────────────────────────────────────────────
  const [phase, setPhase] = useState<ModalPhase>('uploading');
  const [inspectResult, setInspectResult] = useState<InspectPdfResponse | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [selections, setSelections] = useState<SheetSelection[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [currentWizardIndex, setCurrentWizardIndex] = useState(0);

  // ── Dispatch state ─────────────────────────────────────────────────────────
  const bulkImport = useBulkImportSheets();
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // ── Click-outside (AGENTS.md C16) ─────────────────────────────────────────
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (phase === 'dispatching') return; // lock during import
      if (overlayRef.current && e.target === overlayRef.current) onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose, phase]);

  // ── Escape key (AGENTS.md C18) ────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && phase !== 'dispatching') {
        if (document.activeElement?.tagName === 'INPUT') return; // C18: Do not close modal if typing
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, phase]);

  // ── Pre-select active drawing set ─────────────────────────────────────────
  useEffect(() => {
    const active = existingSets.find((s) => s.is_active);
    if (active && !selectedSetId) setSelectedSetId(active.id);
  }, [existingSets, selectedSetId]);

  // ── File handler (drag + drop + click) ────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setInspectError('Only PDF files are supported.');
      return;
    }

    setPhase('uploading');
    setInspectError(null);
    setIsInspecting(true);

    try {
      const result = await inspectAndStagePdfService(projectId, file, token);
      setInspectResult(result);

      // Enter picker phase for all uploads (single or multi-page)
      setSelections(
        result.pages.map((p) => ({
          pageIndex: p.page_index,
          sheetName: p.suggested_label,
          drawingTitle: '',
          revision: '',
          drawingDate: '',
          receivedDate: '',
          selected: true,
        }))
      );
      setPhase('global_assignment');
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : 'Failed to inspect PDF');
      setPhase('uploading');
    } finally {
      setIsInspecting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token]);

  // ── Drawing set resolution ─────────────────────────────────────────────────
  async function resolveDrawingSetId(): Promise<string | null> {
    if (!createNewSet) return selectedSetId;
    if (!newSetName.trim()) return selectedSetId; // fallback

    const newId = await createSet.mutateAsync({
      projectId,
      setName: newSetName.trim(),
      issueDate: newSetDate || null,
      makeActive: true,
    });
    return newId;
  }

  // ── Dispatch ───────────────────────────────────────────────────────────────
  async function dispatchImport(
    stagedKey: string,
    filename: string,
    pageSelections: Array<{ pageIndex: number; sheetName: string; drawingTitle: string; revision: string; drawingDate: string; receivedDate: string }>
  ) {
    setPhase('dispatching');
    setDispatchError(null);

    try {
      const drawingSetId = await resolveDrawingSetId();
      await bulkImport.mutateAsync({
        projectId,
        drawingSetId,
        disciplineId: selectedDisciplineId || null,
        stagedKey,
        filename,
        selections: pageSelections,
        token,
      });
      setPhase('done');
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  async function handleImportSelected() {
    if (!inspectResult) return;
    const chosen = selections.filter((s) => s.selected);
    if (chosen.length === 0) return;

    await dispatchImport(
      inspectResult.staged_key,
      inspectResult.filename,
      chosen.map((s) => ({
        pageIndex: s.pageIndex,
        sheetName: s.sheetName,
        drawingTitle: s.drawingTitle,
        revision: s.revision,
        drawingDate: s.drawingDate,
        receivedDate: s.receivedDate
      }))
    );
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  const selectedCount = selections.filter((s) => s.selected).length;


  function toggleOne(pageIndex: number) {
    setSelections((prev) =>
      prev.map((s) => s.pageIndex === pageIndex ? { ...s, selected: !s.selected } : s)
    );
  }

  function updateField(pageIndex: number, field: keyof SheetSelection, value: string | boolean) {
    setSelections((prev) =>
      prev.map((s) => s.pageIndex === pageIndex ? { ...s, [field]: value } : s)
    );
  }

  const [bulkDrawingDate, setBulkDrawingDate] = useState('');
  const [bulkReceivedDate, setBulkReceivedDate] = useState('');

  function applyBulkDates() {
    setSelections(prev => prev.map(s => {
      if (!s.selected) return s;
      return {
        ...s,
        drawingDate: bulkDrawingDate || s.drawingDate,
        receivedDate: bulkReceivedDate || s.receivedDate
      };
    }));
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderDropZone() {
    return (
      <div
        id="pdf-import-dropzone"
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => document.getElementById('pdf-import-file-input')?.click()}
        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pdf-import-file-input')?.click()}
        className={`flex flex-col items-center justify-center gap-4 p-12 rounded-2xl
                    border-2 border-dashed cursor-pointer transition-all
                    ${dragOver
                      ? 'border-teal-400 bg-teal-400/10'
                      : 'border-white/20 hover:border-white/40 bg-white/3'
                    }`}
      >
        <input
          id="pdf-import-file-input"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
          disabled={isInspecting}
        />
        <div className={`p-4 rounded-2xl ${isInspecting ? 'bg-indigo-400/10' : 'bg-teal-400/10'}`}>
          {isInspecting ? (
            <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
          ) : (
            <Upload className="h-8 w-8 text-teal-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-200">
            {isInspecting ? 'Processing Document...' : 'Drop a drawing PDF here'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {isInspecting ? 'Extracting pages and generating thumbnails' : 'Multi-page PDFs supported · Up to 500 MB'}
          </p>
        </div>
        {inspectError && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10
                          px-4 py-2 rounded-xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {inspectError}
          </div>
        )}
      </div>
    );
  }

  function renderImportSettingsSection() {
    return (
      <div className="space-y-6">
        {/* Drawing Set */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Drawing Set
          </p>
          <div className="flex gap-2 flex-wrap">
            {existingSets.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedSetId(s.id); setCreateNewSet(false); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                            ${!createNewSet && selectedSetId === s.id
                              ? 'bg-teal-500 text-white'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {s.set_name}
                {s.is_active && (
                  <span className="ml-1.5 text-xs opacity-70">(active)</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setCreateNewSet(true)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                          ${createNewSet
                            ? 'bg-teal-500 text-white'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              + New Set
            </button>
          </div>

          {createNewSet && (
            <div className="flex gap-2">
              <input
                id="new-set-name-inline"
                autoFocus
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder="Set name (e.g. IFC – May 2026)"
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                           text-sm text-slate-200 placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
              <div className="relative flex items-center w-36 shrink-0">
                <input
                  id="new-set-date-inline"
                  type="text"
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  value={newSetDate}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 4) val = val.slice(0, 4) + '-' + val.slice(4);
                    if (val.length > 6) val = val.slice(0, 7) + '-' + val.slice(7, 9);
                    setNewSetDate(val);
                  }}
                  className="w-full pl-3 pr-8 py-2 rounded-lg bg-white/5 border border-white/10
                             text-sm text-slate-300 focus:outline-none focus:ring-1
                             focus:ring-teal-500/50"
                />
                <button 
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('new-set-date-hidden');
                    if (el && 'showPicker' in el) {
                      try { (el as HTMLInputElement).showPicker(); } catch (e) { /* ignore */ }
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Pick date"
                >
                  <Calendar className="h-4 w-4" />
                </button>
                <input
                  id="new-set-date-hidden"
                  type="date"
                  value={newSetDate.length === 10 ? newSetDate : ''}
                  onChange={(e) => setNewSetDate(e.target.value)}
                  className="absolute bottom-0 right-0 w-0 h-0 opacity-0 pointer-events-none"
                  tabIndex={-1}
                />
              </div>
            </div>
          )}
        </div>

        {/* Discipline Selection */}
        {disciplines.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Discipline (Optional)
            </p>
            <select
              value={selectedDisciplineId}
              onChange={(e) => setSelectedDisciplineId(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                         text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50
                         appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">Uncategorized</option>
              {disciplines.map((d: any) => (
                <option key={d.id} value={d.id} className="bg-slate-900">{d.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  function renderGlobalAssignmentView() {
    return (
      <div className="flex flex-col gap-6 w-full pt-4">
        <div className="p-6 rounded-2xl bg-slate-900 border border-white/10 space-y-6">
          {renderImportSettingsSection()}
          
          <div className="pt-6 border-t border-white/5 space-y-4">
             <h4 className="text-sm font-semibold text-slate-300">Default Dates (Applied to all sheets)</h4>
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-1.5">Drawing Date</label>
                   <input 
                     type="date" 
                     value={bulkDrawingDate} 
                     onChange={e => setBulkDrawingDate(e.target.value)} 
                     className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500" 
                   />
                </div>
                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-1.5">Received Date</label>
                   <input 
                     type="date" 
                     value={bulkReceivedDate} 
                     onChange={e => setBulkReceivedDate(e.target.value)} 
                     className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500" 
                   />
                </div>
             </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 gap-4">
           <button 
             onClick={() => {
               applyBulkDates();
               setPhase('wizard');
               setCurrentWizardIndex(0);
             }}
             className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
           >
             Skip & Review Manually
           </button>
           <button 
             onClick={() => {
               applyBulkDates();
               setPhase('title_block_training');
             }}
             className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
           >
             Train Title Block (Auto-Extract)
           </button>
        </div>
      </div>
    );
  }



  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center
                 bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-7xl max-h-[90vh] flex flex-col
                      bg-slate-950 border border-white/10 rounded-2xl shadow-2xl
                      overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-base font-semibold text-slate-200">
            {phase === 'uploading' && 'Import Drawings'}
            {(phase === 'global_assignment' || phase === 'wizard') && `Select Pages — ${inspectResult?.filename ?? ''}`}
            {phase === 'title_block_training' && `Train Extractor — ${inspectResult?.filename ?? ''}`}
            {phase === 'extracting' && 'Extracting Text…'}
            {phase === 'dispatching' && 'Processing Sheets…'}
            {phase === 'done' && 'Import Complete'}
          </h2>
          {phase !== 'dispatching' && (
            <button
              id="pdf-import-close"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400
                         hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {/* Upload phase */}
          {phase === 'uploading' && (
            <>
              {renderDropZone()}
              {(existingSets.length > 0 || disciplines.length > 0) && renderImportSettingsSection()}
            </>
          )}

          {/* Global Assignment phase */}
          {phase === 'global_assignment' && (
             renderGlobalAssignmentView()
          )}

          {/* Title Block Training phase */}
          {(phase === 'title_block_training' || phase === 'extracting') && (
            <div className="relative">
              {phase === 'extracting' && (
                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl border border-white/10">
                  <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                  <h3 className="text-lg font-semibold text-white">Extracting Data...</h3>
                  <p className="text-sm text-slate-400 mt-2">Processing {selections.filter(s => s.selected).length} sheets via PyMuPDF</p>
                </div>
              )}
              <TitleBlockTrainingView 
                projectId={projectId}
                token={token}
                inspectResult={inspectResult}
                selections={selections}
                setSelections={setSelections}
                setPhase={setPhase}
                onComplete={() => {
                  setPhase('wizard');
                  setCurrentWizardIndex(0);
                }}
              />
            </div>
          )}

          {/* Wizard phase */}
          {phase === 'wizard' && (
             <WizardView 
               projectId={projectId}
               token={token}
               inspectResult={inspectResult}
               selections={selections}
               currentWizardIndex={currentWizardIndex}
               setCurrentWizardIndex={setCurrentWizardIndex}
               toggleOne={toggleOne}
               updateField={updateField}
             />
          )}

          {/* Dispatching phase */}
          {(phase === 'dispatching' || phase === 'done') && (
            <div className="space-y-3">
              {selections.filter((s) => s.selected).map((sel) => (
                <div
                  key={sel.pageIndex}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5"
                >
                  {phase === 'dispatching' ? (
                    <Loader2 className="h-4 w-4 text-teal-400 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-teal-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{sel.sheetName}</p>
                    <p className="text-xs text-slate-500">
                      Page {sel.pageIndex + 1} of {inspectResult?.filename}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>
              ))}

              {dispatchError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10
                                px-4 py-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {dispatchError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'global_assignment' || phase === 'wizard' || phase === 'done') && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0 bg-slate-950">
            {(phase === 'global_assignment' || phase === 'wizard') ? (
              <>
                <button
                  onClick={() => {
                    if (phase === 'wizard') setPhase('global_assignment');
                    else { setPhase('uploading'); setInspectResult(null); }
                  }}
                  className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Back
                </button>
                {phase === 'wizard' && (
                   <button
                     id="pdf-import-submit"
                     disabled={selectedCount === 0 || bulkImport.isPending}
                     onClick={handleImportSelected}
                     className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-lg shadow-teal-500/20"
                   >
                     {bulkImport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                     Import {selectedCount} Sheet{selectedCount !== 1 ? 's' : ''}
                   </button>
                )}
              </>
            ) : (
              <button
                id="pdf-import-done"
                onClick={onClose}
                className="ml-auto px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400
                           text-white text-sm font-medium transition-colors"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


