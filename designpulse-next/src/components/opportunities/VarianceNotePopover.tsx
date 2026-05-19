'use client';
/**
 * VarianceNotePopover.tsx
 *
 * Inline popover for viewing/editing variance notes on the Budget Ledger grid.
 * Rendered inside the LedgerDeltaCell when the note icon is clicked.
 *
 * Features:
 *  - Version-scoped editability: only the active version's note is editable
 *  - Historical notes from prior versions shown read-only with version labels
 *  - Auto-save on blur (or Cmd+Enter)
 *  - 500-character limit with counter
 *  - Dark mode support
 *
 * Positioning: Tailwind absolute positioning (no @floating-ui dependency).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Pencil, Clock, CheckCircle2 } from 'lucide-react';
import { useVarianceHistoryByCostCode } from '@/hooks/useEstimateQueries';
import { useUpsertVarianceNote } from '@/hooks/useUpsertVarianceNote';

interface VarianceNotePopoverProps {
  projectId: string;
  costCode: string;
  activeVersionId: string | null;
  onClose: () => void;
  /** Anchor position relative to viewport — used to flip if near bottom edge */
  anchorRect?: DOMRect | null;
}

const MAX_NOTE_LENGTH = 500;

export function VarianceNotePopover({
  projectId,
  costCode,
  activeVersionId,
  onClose,
}: VarianceNotePopoverProps) {
  const { data: history = [], isLoading } = useVarianceHistoryByCostCode(projectId, costCode);
  const upsertMutation = useUpsertVarianceNote(projectId);

  // Find the active version's note (if any)
  const activeNote = history.find(n => n.estimate_version_id === activeVersionId);
  const historicalNotes = history.filter(n => n.estimate_version_id !== activeVersionId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(activeNote?.variance_note ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync draft when data loads
  useEffect(() => {
    if (activeNote) setDraft(activeNote.variance_note);
  }, [activeNote]);

  // Click-outside handler
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === (activeNote?.variance_note ?? '')) {
      setIsEditing(false);
      return;
    }
    upsertMutation.mutate(
      { costCode, note: trimmed },
      { onSuccess: () => setIsEditing(false) }
    );
  }, [draft, activeNote, costCode, upsertMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDraft(activeNote?.variance_note ?? '');
      setIsEditing(false);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  }, [activeNote, handleSave]);

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 z-[100] w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-1 duration-150"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Variance Notes</span>
          <span className="font-mono text-xs text-sky-500 dark:text-sky-400">{costCode}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">Loading…</div>
        ) : (
          <>
            {/* Active version note — editable */}
            {activeVersionId && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400 flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    Current Version
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-sky-500 transition-colors"
                      title="Edit note"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <textarea
                      ref={textareaRef}
                      rows={3}
                      value={draft}
                      maxLength={MAX_NOTE_LENGTH}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={handleSave}
                      onKeyDown={handleKeyDown}
                      placeholder="Explain this budget variance…"
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-sky-300 dark:border-sky-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400 text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] ${draft.length > MAX_NOTE_LENGTH * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {draft.length}/{MAX_NOTE_LENGTH}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {upsertMutation.isPending ? 'Saving…' : 'Blur or ⌘+Enter to save'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className={`text-xs leading-relaxed ${
                    activeNote?.variance_note
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-400 dark:text-slate-500 italic'
                  }`}>
                    {activeNote?.variance_note || 'No note for current version. Click pencil to add one.'}
                  </p>
                )}
              </div>
            )}

            {/* Historical notes — read-only */}
            {historicalNotes.length > 0 && (
              <div className="px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-2">
                  <Clock size={10} />
                  History
                </span>
                <div className="space-y-2.5">
                  {historicalNotes.map(note => (
                    <div key={note.id} className="relative pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                        {note.version_name}
                        <span className="ml-2 text-slate-400 dark:text-slate-500 font-normal" title={new Date(note.created_at).toLocaleString()}>
                          {relativeTime(note.updated_at || note.created_at)}
                        </span>
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                        {note.variance_note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!activeNote && historicalNotes.length === 0 && !isLoading && (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                No variance notes for this cost code.
              </div>
            )}
          </>
        )}
      </div>

      {/* Mutation error */}
      {upsertMutation.isError && (
        <div className="px-4 py-2 border-t border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10 text-xs text-rose-600 dark:text-rose-400">
          Failed to save: {upsertMutation.error?.message}
        </div>
      )}
    </div>
  );
}
