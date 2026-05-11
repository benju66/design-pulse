'use client';

/**
 * DrawingSetSelector — Step 8a
 *
 * Procore-style drawing set selector + creator.
 * Appears above the sheets list in the Drawings sidebar.
 *
 * Behaviour:
 *   - Lists all drawing sets for the project, newest first.
 *   - Active set shown with a teal badge.
 *   - "Activate" button atomically swaps the active set via RPC.
 *   - "New Set" inline form creates a drawing set (with optional issue date)
 *     and optionally makes it active immediately.
 */

import React, { useState, useRef } from 'react';
import { ChevronDown, Plus, Check, Calendar, Layers } from 'lucide-react';
import { useDrawingSets, useCreateDrawingSet, useActivateDrawingSet } from '@/hooks/useDrawingSetQueries';

interface DrawingSetSelectorProps {
  projectId: string;
  /** Called when a set is activated so the parent can optionally filter the sheet list */
  onSetActivated?: (setId: string) => void;
}

export function DrawingSetSelector({ projectId, onSetActivated }: DrawingSetSelectorProps) {
  const { data: sets = [], isLoading } = useDrawingSets(projectId);
  const createSet = useCreateDrawingSet();
  const activateSet = useActivateDrawingSet();

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [setName, setSetName] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [makeActive, setMakeActive] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeSet = sets.find((s) => s.is_active);

  // Click-outside pattern (AGENTS.md C16)
  React.useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowForm(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!setName.trim()) return;
    await createSet.mutateAsync({
      projectId,
      setName: setName.trim(),
      issueDate: issueDate || null,
      makeActive,
    });
    setSetName('');
    setIssueDate('');
    setShowForm(false);
    setOpen(false);
  }

  async function handleActivate(setId: string) {
    await activateSet.mutateAsync({ setId, projectId });
    onSetActivated?.(setId);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        id="drawing-set-selector-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg
                   bg-white/5 hover:bg-white/10 border border-white/10
                   text-sm text-slate-200 transition-colors"
      >
        <Layers className="h-4 w-4 text-teal-400 shrink-0" />
        <span className="flex-1 text-left truncate">
          {isLoading
            ? 'Loading sets…'
            : activeSet
              ? activeSet.set_name
              : 'No Active Drawing Set'}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50
                        bg-slate-900 border border-white/10 rounded-xl shadow-2xl
                        overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {sets.length === 0 && !showForm && (
              <p className="px-4 py-3 text-xs text-slate-500">No drawing sets yet.</p>
            )}
            {sets.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2.5
                           hover:bg-white/5 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{s.set_name}</p>
                  {s.issue_date && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {s.issue_date}
                    </p>
                  )}
                </div>
                {s.is_active ? (
                  <span className="ml-2 flex items-center gap-1 text-xs text-teal-400
                                   bg-teal-400/10 px-2 py-0.5 rounded-full shrink-0">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                ) : (
                  <button
                    onClick={() => handleActivate(s.id)}
                    disabled={activateSet.isPending}
                    className="ml-2 text-xs text-slate-400 hover:text-teal-400
                               opacity-0 group-hover:opacity-100 transition-all
                               px-2 py-0.5 rounded border border-transparent
                               hover:border-teal-400/30 shrink-0"
                  >
                    Activate
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* New set form */}
          {showForm ? (
            <form
              onSubmit={handleCreate}
              className="border-t border-white/10 p-3 space-y-2"
            >
              <input
                id="new-drawing-set-name"
                autoFocus
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="Set name (e.g. IFC – May 2026)"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10
                           text-sm text-slate-200 placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                <input
                  id="new-drawing-set-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded bg-white/5 border border-white/10
                             text-sm text-slate-300 focus:outline-none focus:ring-1
                             focus:ring-teal-500/50"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="rounded accent-teal-500"
                />
                Make active immediately
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!setName.trim() || createSet.isPending}
                  className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-400
                             text-sm font-medium text-white disabled:opacity-50
                             transition-colors"
                >
                  {createSet.isPending ? 'Creating…' : 'Create Set'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-2 rounded-lg border border-white/10
                             text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              id="new-drawing-set-btn"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 w-full px-3 py-2.5
                         border-t border-white/10 text-sm text-slate-400
                         hover:text-teal-400 hover:bg-white/5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Drawing Set
            </button>
          )}
        </div>
      )}
    </div>
  );
}
