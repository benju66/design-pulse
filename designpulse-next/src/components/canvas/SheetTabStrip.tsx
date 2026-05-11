"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { ProjectSheet } from '@/types/map.types';
import { useMapStore } from '@/stores/useMapStore';
import {
  useCreateProjectSheet,
  useDeleteProjectSheet,
  useRenameProjectSheet,
} from '@/hooks/useMapQueries';
import { useSheetRealtime } from '@/hooks/useSheetRealtime';
import { processSheetService } from '@/services/api';
import { DrawingSetSelector } from '@/components/drawings/DrawingSetSelector';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SheetTabStripProps {
  projectId: string;
  sheets: ProjectSheet[];
}

interface ContextMenuState {
  sheetId: string;
  x: number;
  y: number;
}

// ── SheetTabStrip ─────────────────────────────────────────────────────────────
// Bottom 48px tab bar for navigating between project sheets.
// Industry standard for drawing tools (Bluebeam, AutoCAD Sheet Set Manager).
// AGENTS.md: C3 (Tailwind + dark:), C8 (client UUID), C16 (click-outside via
// native mousedown + ref.contains), C17 (zero-JS tooltips), C18 (Escape cancels
// rename), C23 (atomic selection on click).
export const SheetTabStrip: React.FC<SheetTabStripProps> = ({ projectId, sheets }) => {
  const activeSheetId = useMapStore((s) => s.activeSheetId);
  const setActiveSheetId = useMapStore((s) => s.setActiveSheetId);
  const setIsViewerOpen = useMapStore((s) => s.setIsViewerOpen);
  const openSheetIds = useMapStore((s) => s.openSheetIds);
  const addOpenSheetId = useMapStore((s) => s.addOpenSheetId);
  const removeOpenSheetId = useMapStore((s) => s.removeOpenSheetId);

  // Get bearer token via supabase.auth.getSession() — consistent with
  // TileRenderer.tsx and useCsiQueries.ts patterns in this codebase.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const createSheet = useCreateProjectSheet();
  const deleteSheet = useDeleteProjectSheet();
  const renameSheet = useRenameProjectSheet();

  // Drive live status + progress_percent updates via Supabase Realtime.
  // Replaces the 3s polling loop with push-based invalidation (debounced 300ms).
  useSheetRealtime(projectId);

  // Hidden file input ref — triggered programmatically on "+" click
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Pending sheetId waiting for a file to be picked
  const pendingSheetIdRef = useRef<string | null>(null);

  // Clear stale pending ref when user dismisses OS file picker without selecting.
  // Native 'cancel' event fires on <input type="file"> in all modern browsers.
  // Prevents the stale ID routing the next file to the wrong sheet (AGENTS.md C15).
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handleCancel = () => { pendingSheetIdRef.current = null; };
    input.addEventListener('cancel', handleCancel);
    return () => input.removeEventListener('cancel', handleCancel);
  }, []);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameOriginalRef = useRef('');
  const isEscapingRef = useRef(false); // suppresses onBlur commit after Escape (C18)

  // Right-click context menu (AGENTS.md C16 — native contextmenu event)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Re-upload target
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const reuploadSheetIdRef = useRef<string | null>(null);

  // ── Click-outside for context menu (AGENTS.md C16) ──────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    // Attach to native mousedown — NOT React synthetic onClick (C16)
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // ── Click-outside for rename input (AGENTS.md C16) ───────────────────────
  useEffect(() => {
    if (!renamingId) return;
    const handler = (e: MouseEvent) => {
      if (renameInputRef.current && !renameInputRef.current.contains(e.target as Node)) {
        // Click outside — cancel rename (AGENTS.md C18: inline cell Escape = cancel)
        setRenamingId(null);
        setRenameValue('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [renamingId]);

  // ── Start rename ────────────────────────────────────────────
  const startRename = useCallback((sheet: ProjectSheet) => {
    setContextMenu(null);
    isEscapingRef.current = false;     // reset at start of every rename session
    setRenamingId(sheet.id);
    setRenameValue(sheet.sheet_name);
    renameOriginalRef.current = sheet.sheet_name;
    // Focus on next tick after the input mounts
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, []);

  // ── Commit rename ───────────────────────────────────────────
  const commitRename = useCallback((sheetId: string) => {
    if (isEscapingRef.current) {
      isEscapingRef.current = false;
      return; // Escape was pressed — do NOT save (AGENTS.md C18)
    }
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== renameOriginalRef.current) {
      renameSheet.mutate({ projectId, sheetId, newName: trimmed });
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, projectId, renameSheet]);

  // ── Keyboard handler for rename input (AGENTS.md C18) ────────────────
  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, sheetId: string) => {
    if (e.key === 'Enter') {
      commitRename(sheetId);
    } else if (e.key === 'Escape') {
      // Inline cell: Escape CANCELS, reverts to original (AGENTS.md C18)
      isEscapingRef.current = true;   // set BEFORE renamingId=null triggers blur
      setRenamingId(null);
      setRenameValue('');
    }
  }, [commitRename]);

  // ── Upload flow ────────────────────────────────────────────
  // Step 1: "+" clicked → create DB row → store sheetId → trigger file picker
  const handleAddSheet = useCallback(() => {
    if (!accessToken) return;

    const sheetName = `Sheet ${sheets.length + 1}`;
    const id = crypto.randomUUID(); // C8: single mint — same ID for DB insert and optimistic cache
    createSheet.mutate(
      { projectId, sheetName, id },
      {
        onSuccess: (newSheet) => {
          pendingSheetIdRef.current = newSheet.id;
          setActiveSheetId(newSheet.id);
          addOpenSheetId(newSheet.id);
          fileInputRef.current?.click();
        },
      }
    );
  }, [accessToken, sheets.length, projectId, createSheet, setActiveSheetId, addOpenSheetId]);

  // Step 2: File selected → call FastAPI → sheet status transitions to 'ready' via polling
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, targetSheetId?: string) => {
    const file = e.target.files?.[0];
    const sheetId = targetSheetId ?? pendingSheetIdRef.current;
    const token = accessToken;
    if (!file || !sheetId || !token) return;

    e.target.value = '';
    pendingSheetIdRef.current = null;

    try {
      // Direct mode: pass file + pageIndex=0 (single-page sheet via re-upload)
      await processSheetService(sheetId, file, 0, token);
    } catch (err) {
      console.error('[SheetTabStrip] processSheetService failed:', err);
    }
  }, [accessToken]);

  // Re-upload flow
  const handleReupload = useCallback((sheetId: string) => {
    setContextMenu(null);
    reuploadSheetIdRef.current = sheetId;
    reuploadInputRef.current?.click();
  }, []);

  const handleReuploadFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sheetId = reuploadSheetIdRef.current;
    if (sheetId) handleFileChange(e, sheetId);
    reuploadSheetIdRef.current = null;
  }, [handleFileChange]);

  const handleCloseTab = useCallback((sheetId: string) => {
    const nextIds = openSheetIds.filter(id => id !== sheetId);
    removeOpenSheetId(sheetId);
    if (activeSheetId === sheetId) {
      if (nextIds.length > 0) {
        setActiveSheetId(nextIds[nextIds.length - 1]);
      } else {
        setActiveSheetId('');
        setIsViewerOpen(false);
      }
    }
  }, [openSheetIds, removeOpenSheetId, activeSheetId, setActiveSheetId, setIsViewerOpen]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((sheetId: string) => {
    setContextMenu(null);
    deleteSheet.mutate({ projectId, sheetId });
    handleCloseTab(sheetId);
  }, [projectId, deleteSheet, handleCloseTab]);

  return (
    <div className="flex-shrink-0 flex flex-col border-t border-slate-200 dark:border-slate-700
                    bg-slate-100 dark:bg-slate-900 overflow-hidden relative">
      {/* Drawing Set Selector — sits above the tab row */}
      <div className="px-2 pt-1.5 pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
        <DrawingSetSelector projectId={projectId} />
      </div>

      {/* Tab row — 48px */}
      <div className="h-12 flex items-stretch overflow-hidden relative">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={reuploadInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleReuploadFileChange}
      />

      {/* Scrollable tab list */}
      <div className="flex items-stretch overflow-x-auto flex-1 scrollbar-none">
        {sheets.filter(s => openSheetIds.includes(s.id)).map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isRenaming = renamingId === sheet.id;

          return (
            <div
              key={sheet.id}
              className={`
                group relative flex items-center gap-2 px-3 min-w-0 flex-shrink-0 max-w-[180px] cursor-pointer
                border-r border-slate-200 dark:border-slate-700 select-none
                transition-colors duration-150
                ${isActive
                  ? 'bg-white dark:bg-slate-800 border-t-2 border-t-sky-500 text-slate-900 dark:text-white'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }
              `}
              onClick={() => {
                if (!isRenaming && sheet.status === 'ready') {
                  // C23: atomic selection on click
                  setActiveSheetId(sheet.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ sheetId: sheet.id, x: e.clientX, y: e.clientY });
              }}
              onDoubleClick={() => startRename(sheet)}
              title={sheet.status !== 'ready' ? undefined : undefined}
            >
              {/* Status indicator */}
              <span className="flex-shrink-0">
                {sheet.status === 'processing' && (
                  <Loader2 size={12} className="animate-spin text-sky-500" />
                )}
                {sheet.status === 'ready' && (
                  <CheckCircle2 size={12} className={isActive ? 'text-sky-500' : 'text-slate-400'} />
                )}
                {sheet.status === 'error' && (
                  <AlertCircle size={12} className="text-red-500" />
                )}
              </span>

              {/* Progress bar — visible during processing, driven by Realtime.
                  Uses inline style for dynamic width (Tailwind v4 does not
                  generate arbitrary w-[X%] classes at runtime). */}
              {sheet.status === 'processing' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${sheet.progress_percent ?? 0}%` }}
                  />
                </div>
              )}

              {/* Sheet name — inline rename input or static label */}
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => handleRenameKeyDown(e, sheet.id)}
                  onBlur={() => commitRename(sheet.id)}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs font-medium text-slate-900 dark:text-white"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 min-w-0 truncate text-xs font-medium">
                  {sheet.sheet_name}
                </span>
              )}

              {/* Zero-JS tooltip for truncated names (AGENTS.md C17) */}
              {!isRenaming && (
                <span className="
                  pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                  px-2 py-1 rounded text-[10px] whitespace-nowrap bg-slate-800 text-white
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150
                  z-[100]
                ">
                  {sheet.sheet_name}
                  {sheet.status === 'processing' && ' (processing…)'}
                  {sheet.status === 'error' && ' (error — right-click to re-upload)'}
                </span>
              )}

              {/* Close button — visible on hover of active tab */}
              {isActive && !isRenaming && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCloseTab(sheet.id); }}
                  className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Close tab"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add sheet button — sticky right (C23: triggers immediately) */}
      <button
        onClick={handleAddSheet}
        disabled={createSheet.isPending}
        className="
          flex-shrink-0 flex items-center gap-1.5 px-3 border-l border-slate-200 dark:border-slate-700
          text-slate-500 hover:text-sky-600 dark:hover:text-sky-400
          hover:bg-slate-50 dark:hover:bg-slate-800/60
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-150 text-xs font-medium
        "
        title="Upload new sheet"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">Add Sheet</span>
      </button>

      {/* Right-click context menu (AGENTS.md C16 — native contextmenu event) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[140px]"
        >
          {[
            {
              label: 'Rename',
              action: () => {
                const sheet = sheets.find((s) => s.id === contextMenu.sheetId);
                if (sheet) startRename(sheet);
              },
            },
            {
              label: 'Re-upload PDF',
              action: () => handleReupload(contextMenu.sheetId),
            },
            {
              label: 'Delete',
              action: () => handleDelete(contextMenu.sheetId),
              danger: true,
            },
          ].map(({ label, action, danger }) => (
            <button
              key={label}
              onClick={action}
              className={`
                w-full text-left px-3 py-1.5 text-sm transition-colors
                ${danger
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      </div>{/* end tab row */}
    </div>
  );
};

export default SheetTabStrip;
