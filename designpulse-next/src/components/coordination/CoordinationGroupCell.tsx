'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { CellContext } from '@tanstack/react-table';
import { Opportunity, CoordGroupConfig } from '@/types/models';
import { COORD_GROUP_COLORS } from '@/lib/constants';
import { cn } from '@/lib/cn';

/**
 * Inline group assignment cell for the `coord_group` column.
 * All data comes from `table.options.meta` (Firehose Rule — no hooks inside cell).
 */
export function CoordinationGroupCell({ row, table }: CellContext<Opportunity, unknown>) {
  const meta = table.options.meta;
  const coordGroups: CoordGroupConfig[] = meta?.coordGroups ?? [];
  const onGroupsChange = meta?.onGroupsChange;
  const updateData = meta?.updateData;

  const groupId = row.original.coord_group_id;
  const group = groupId ? coordGroups.find(g => g.id === groupId) : null;

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click-outside: useRef containment + native mousedown (guardrail 16)
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setNewLabel('');
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const handleAssign = useCallback((targetGroupId: string | null) => {
    if (!updateData) return;
    updateData.mutate({ id: row.original.id, updates: { coord_group_id: targetGroupId } });
    setIsOpen(false);
  }, [updateData, row.original.id]);

  const handleCreate = useCallback(() => {
    if (!newLabel.trim() || !onGroupsChange || !updateData) return;
    const newId = crypto.randomUUID();
    const color = COORD_GROUP_COLORS[selectedColorIndex % COORD_GROUP_COLORS.length];
    const newGroup: CoordGroupConfig = {
      id: newId,
      label: newLabel.trim(),
      color,
      order: coordGroups.length,
    };
    // Append to settings
    onGroupsChange([...coordGroups, newGroup]);
    // Assign to this row immediately
    updateData.mutate({ id: row.original.id, updates: { coord_group_id: newId } });
    setIsCreating(false);
    setNewLabel('');
    setIsOpen(false);
  }, [newLabel, selectedColorIndex, coordGroups, onGroupsChange, updateData, row.original.id]);

  // Navigate mode — render badge or dash
  if (!isOpen) {
    return (
      <div
        className="px-2 py-1.5 h-full flex items-center cursor-pointer group/gcell"
        onClick={() => setIsOpen(true)}
      >
        {group ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-sm transition-all group-hover/gcell:ring-2 group-hover/gcell:ring-white/30 group-hover/gcell:brightness-110"
            style={{ backgroundColor: group.color }}
          >
            {group.label}
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">&mdash;</span>
        )}
      </div>
    );
  }

  // Active mode — popover
  return (
    <div className="relative px-2 py-1 h-full" ref={popoverRef}>
      {/* Current value as trigger */}
      {group ? (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-sm ring-2 ring-purple-400"
          style={{ backgroundColor: group.color }}
        >
          {group.label}
        </span>
      ) : (
        <span className="text-xs text-slate-400">&mdash;</span>
      )}

      {/* Dropdown popover */}
      <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 min-w-[200px] max-h-[280px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
        {/* Unassign option (only show if currently assigned) */}
        {groupId && (
          <>
            <button
              onClick={() => handleAssign(null)}
              className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-rose-500 transition-colors"
            >
              <X size={12} />
              <span>Unassign</span>
            </button>
            <div className="border-b border-slate-100 dark:border-slate-700/60 my-1" />
          </>
        )}

        {/* Existing groups */}
        {coordGroups.map(g => (
          <button
            key={g.id}
            onClick={() => handleAssign(g.id)}
            className={cn(
              'w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors',
              g.id === groupId && 'bg-purple-50 dark:bg-purple-900/20'
            )}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: g.color }}
            />
            <span className="truncate">{g.label}</span>
          </button>
        ))}

        {/* Divider before create */}
        {coordGroups.length > 0 && (
          <div className="border-b border-slate-100 dark:border-slate-700/60 my-1" />
        )}

        {/* Create new group */}
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-purple-500 transition-colors"
          >
            <Plus size={12} />
            <span>Create new group</span>
          </button>
        ) : (
          <div className="px-3 py-2 space-y-2">
            <input
              type="text"
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewLabel('');
                }
              }}
              placeholder="Group name..."
              className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            {/* Color swatch picker */}
            <div className="flex flex-wrap gap-1">
              {COORD_GROUP_COLORS.map((color, i) => (
                <button
                  key={color}
                  onClick={() => setSelectedColorIndex(i)}
                  className={cn(
                    'w-5 h-5 rounded-full transition-all',
                    i === selectedColorIndex && 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white dark:ring-offset-slate-800'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCreate}
                disabled={!newLabel.trim()}
                className="px-2 py-1 text-[10px] font-bold rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewLabel(''); }}
                className="px-2 py-1 text-[10px] font-bold rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
