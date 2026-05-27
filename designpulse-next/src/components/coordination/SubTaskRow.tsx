"use client";

import { CheckCircle2, AlertCircle, Circle, X } from 'lucide-react';
import { cn } from '@/lib/cn';

// ── Status cycling constants ─────────────────────────────────────────────────
const TASK_STATUS_CYCLE = ['Open', 'In Progress', 'Done'] as const;

function getNextStatus(current: string): string {
  const idx = TASK_STATUS_CYCLE.indexOf(current as typeof TASK_STATUS_CYCLE[number]);
  if (idx === -1) return 'Open';
  return TASK_STATUS_CYCLE[(idx + 1) % TASK_STATUS_CYCLE.length];
}

// ── Props (No hooks inside — Firehose Rule C24) ─────────────────────────────
export interface SubTaskRowProps {
  type: 'discipline' | 'task';
  label: string;
  status: string;
  notes?: string;
  assignee?: string | null;
  onStatusChange?: (newStatus: string) => void;
  onAssigneeChange?: (newAssignee: string) => void;
  onDelete?: () => void;
  canEdit: boolean;
}

// ── Status icon + color mapping ──────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'Complete':
    case 'Done':
      return <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />;
    case 'Pending':
    case 'In Progress':
    case 'Required':
      return <AlertCircle size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />;
    default:
      return <Circle size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />;
  }
}

function statusPillClasses(status: string): string {
  switch (status) {
    case 'Complete':
    case 'Done':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    case 'Pending':
    case 'In Progress':
    case 'Required':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export function SubTaskRow({
  type,
  label,
  status,
  notes,
  assignee,
  onStatusChange,
  onAssigneeChange,
  onDelete,
  canEdit,
}: SubTaskRowProps) {
  const isDiscipline = type === 'discipline';
  const isClickable = !isDiscipline && canEdit && !!onStatusChange;

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 min-h-[32px] group/subtask">
      {/* Status icon */}
      <StatusIcon status={status} />

      {/* Label */}
      <span className={cn(
        'text-sm truncate',
        isDiscipline
          ? 'text-slate-600 dark:text-slate-300 font-medium'
          : 'text-slate-700 dark:text-slate-200'
      )}>
        {label}
      </span>

      {/* Status pill */}
      {isClickable ? (
        <button
          type="button"
          onClick={() => onStatusChange(getNextStatus(status))}
          className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded border transition-colors shrink-0',
            'hover:ring-1 hover:ring-offset-1 hover:ring-sky-300 dark:hover:ring-sky-700',
            statusPillClasses(status),
          )}
          title={`Click to change: ${status} → ${getNextStatus(status)}`}
        >
          {status}
        </button>
      ) : (
        <span className={cn(
          'text-[11px] font-semibold px-2 py-0.5 rounded border shrink-0',
          statusPillClasses(status),
        )}>
          {status}
        </span>
      )}

      {/* Notes preview (discipline only) */}
      {isDiscipline && notes && (
        <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]" title={notes}>
          — {notes}
        </span>
      )}

      {/* Assignee (task only — free-text inline) */}
      {!isDiscipline && (
        <input
          type="text"
          value={assignee || ''}
          onChange={(e) => onAssigneeChange?.(e.target.value)}
          onBlur={(e) => onAssigneeChange?.(e.target.value)}
          placeholder="Assignee"
          disabled={!canEdit}
          className={cn(
            'text-xs bg-transparent border-0 border-b border-transparent px-1 py-0.5 w-24 truncate',
            'focus:border-sky-400 focus:outline-none',
            'text-slate-500 dark:text-slate-400',
            !canEdit && 'cursor-default opacity-60',
          )}
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Delete button (task only) */}
      {!isDiscipline && canEdit && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            'opacity-0 group-hover/subtask:opacity-100 transition-opacity',
            'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30',
            'rounded p-0.5',
          )}
          title="Delete task"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
