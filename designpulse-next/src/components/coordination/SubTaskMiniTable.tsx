"use client";

import React, { useState, useCallback, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import type {
  DisciplineConfig,
  DisciplineDetails,
  CoordinationDetailsMap,
  CoordinationTask,
} from '@/types/models';
import { cn } from '@/lib/cn';

// ── Props (No hooks — Firehose Rule C24) ─────────────────────────────────────
interface SubTaskMiniTableProps {
  opportunityId: string;
  disciplines: DisciplineConfig[];
  coordinationDetails: CoordinationDetailsMap | null;
  canEdit: boolean;
  onDisciplineStatusChange: (oppId: string, discId: string, newStatus: string) => void;
  onTaskStatusChange: (oppId: string, taskId: string, newStatus: string) => void;
  onTaskTitleChange: (oppId: string, taskId: string, newTitle: string) => void;
  onTaskAssigneeChange: (oppId: string, taskId: string, newAssignee: string) => void;
  onTaskDelete: (oppId: string, taskId: string) => void;
  onTaskCreate: (oppId: string, title: string) => void;
}

// ── Status styling ───────────────────────────────────────────────────────────
function statusPillClasses(status: string): string {
  switch (status) {
    case 'Complete':
    case 'Done':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'Pending':
    case 'In Progress':
    case 'Required':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export const SubTaskMiniTable = React.memo(function SubTaskMiniTable({
  opportunityId,
  disciplines,
  coordinationDetails,
  canEdit,
  onDisciplineStatusChange,
  onTaskStatusChange,
  onTaskTitleChange,
  onTaskAssigneeChange,
  onTaskDelete,
  onTaskCreate,
}: SubTaskMiniTableProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // ── Column resize state ──────────────────────────────────────────────────
  const INITIAL_WIDTHS = { type: 60, name: 200, status: 120, assignee: 100 };
  const [colWidths, setColWidths] = useState(INITIAL_WIDTHS);
  const resizeRef = useRef<{ col: keyof typeof INITIAL_WIDTHS; startX: number; startW: number } | null>(null);

  const handleResizeMouseDown = useCallback((col: keyof typeof INITIAL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = col === 'name' ? (e.currentTarget.parentElement?.offsetWidth ?? 200) : colWidths[col];
    resizeRef.current = { col, startX, startW };

    const handle = e.currentTarget as HTMLElement;
    handle.classList.add('opacity-100', 'bg-sky-600', 'w-[3px]');

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newWidth = Math.max(32, resizeRef.current.startW + delta);
      setColWidths(prev => ({ ...prev, [col]: newWidth }));
    };

    const onMouseUp = () => {
      handle.classList.remove('opacity-100', 'bg-sky-600', 'w-[3px]');
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);



  const details = (coordinationDetails || {}) as Record<string, unknown>;

  // Collect assigned discipline items (status !== 'Not Required')
  const disciplineItems: { id: string; label: string; status: string }[] = [];
  for (const d of disciplines) {
    const rawEntry = details[d.id];
    if (typeof rawEntry === 'object' && rawEntry !== null && 'status' in rawEntry) {
      const disc = rawEntry as DisciplineDetails;
      if (disc.status !== 'Not Required') {
        disciplineItems.push({ id: d.id, label: d.label, status: disc.status });
      }
    }
  }

  // Collect free-form tasks
  const tasks: CoordinationTask[] = Array.isArray(details.tasks)
    ? ([...(details.tasks as CoordinationTask[])].sort((a, b) => a.order_index - b.order_index))
    : [];

  const hasItems = disciplineItems.length > 0 || tasks.length > 0;

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    onTaskCreate(opportunityId, trimmed);
    setNewTaskTitle('');
  }, [newTaskTitle, onTaskCreate, opportunityId]);

  return (
    <div className="ml-10 mr-4 my-2">
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: colWidths.type }} />
            <col style={{ width: colWidths.name }} />
            <col style={{ width: colWidths.status }} />
            <col style={{ width: colWidths.assignee }} />
            {/* Last column is the filler — absorbs remaining space */}
            <col />
          </colgroup>

          {/* Header */}
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800">
              <th className="relative px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 group/resize">
                Type
                <div
                  onMouseDown={(e) => handleResizeMouseDown('type', e)}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-sky-500 opacity-0 group-hover/resize:opacity-100 transition-opacity"
                />
              </th>
              <th className="relative px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 group/resize">
                Name
                <div
                  onMouseDown={(e) => handleResizeMouseDown('name', e)}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-sky-500 opacity-0 group-hover/resize:opacity-100 transition-opacity"
                />
              </th>
              <th className="relative px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 group/resize">
                Status
                <div
                  onMouseDown={(e) => handleResizeMouseDown('status', e)}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-sky-500 opacity-0 group-hover/resize:opacity-100 transition-opacity"
                />
              </th>
              <th className="relative px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 group/resize">
                Assignee
                <div
                  onMouseDown={(e) => handleResizeMouseDown('assignee', e)}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-sky-500 opacity-0 group-hover/resize:opacity-100 transition-opacity"
                />
              </th>
              <th className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700" />
            </tr>
          </thead>

          <tbody>
            {/* Discipline rows */}
            {disciplineItems.map((item) => (
              <tr
                key={item.id}
                className="group/sub h-8 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {/* Type badge */}
                <td className="px-2 py-1 border-b border-r border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    DISC
                  </span>
                </td>
                {/* Name */}
                <td className="px-2 py-1 text-sm text-slate-700 dark:text-slate-200 font-medium truncate border-b border-r border-slate-200 dark:border-slate-700">
                  {item.label}
                </td>
                {/* Status */}
                <td className="px-2 py-1 border-b border-r border-slate-200 dark:border-slate-700">
                  {canEdit ? (
                    <select
                      value={item.status}
                      onChange={(e) => onDisciplineStatusChange(opportunityId, item.id, e.target.value)}
                      className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded border-none cursor-pointer focus:ring-2 focus:ring-sky-500 outline-none',
                        statusPillClasses(item.status),
                      )}
                    >
                      <option value="Not Required">Not Required</option>
                      <option value="Pending">Pending</option>
                      <option value="Required">Required</option>
                      <option value="Complete">Complete</option>
                    </select>
                  ) : (
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded', statusPillClasses(item.status))}>
                      {item.status}
                    </span>
                  )}
                </td>
                {/* Assignee — empty for disciplines */}
                <td className="px-2 py-1 border-b border-r border-slate-200 dark:border-slate-700" />
                {/* Filler */}
                <td className="px-2 py-1 border-b border-slate-200 dark:border-slate-700" />
              </tr>
            ))}

            {/* Task rows */}
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="group/sub h-8 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {/* Type badge */}
                <td className="px-2 py-1 border-b border-r border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                    TASK
                  </span>
                </td>
                {/* Name */}
                <td className="px-2 py-1 border-b border-r border-slate-200 dark:border-slate-700">
                  {canEdit ? (
                    <input
                      type="text"
                      defaultValue={task.title || ''}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== task.title) {
                          onTaskTitleChange(opportunityId, task.id, val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') {
                          (e.target as HTMLInputElement).value = task.title || '';
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="text-sm bg-transparent border-0 border-b border-transparent focus:border-sky-400 focus:outline-none w-full px-0 py-0 text-slate-700 dark:text-slate-200"
                    />
                  ) : (
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate block">
                      {task.title || '-'}
                    </span>
                  )}
                </td>

                {/* Status */}
                <td className="px-2 py-1 border-b border-r border-slate-200 dark:border-slate-700">
                  {canEdit ? (
                    <select
                      value={task.status}
                      onChange={(e) => onTaskStatusChange(opportunityId, task.id, e.target.value)}
                      className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded border-none cursor-pointer focus:ring-2 focus:ring-sky-500 outline-none',
                        statusPillClasses(task.status),
                      )}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                    </select>
                  ) : (
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded', statusPillClasses(task.status))}>
                      {task.status}
                    </span>
                  )}
                </td>
                {/* Assignee */}
                <td className="px-2 py-1 border-b border-r border-slate-200 dark:border-slate-700">
                  {canEdit ? (
                    <input
                      type="text"
                      defaultValue={task.assignee || ''}
                      onBlur={(e) => onTaskAssigneeChange(opportunityId, task.id, e.target.value)}
                      placeholder="—"
                      className="text-xs bg-transparent border-0 border-b border-transparent focus:border-sky-400 focus:outline-none w-full px-0 py-0 text-slate-500 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {task.assignee || '—'}
                    </span>
                  )}
                </td>
                {/* Filler + Delete action */}
                <td className="px-1 py-1 border-b border-slate-200 dark:border-slate-700">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onTaskDelete(opportunityId, task.id)}
                      className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded p-0.5"
                      title="Delete task"
                    >
                      <X size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Ghost row — inline task creation */}
            {canEdit && (
              <tr className="h-8">
                <td className="px-2 py-1" />
                <td className="px-2 py-1" colSpan={4}>
                  <div className="relative flex items-center w-full">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTask();
                        }
                      }}
                      placeholder="+ Add task..."
                      className={cn(
                        'text-sm bg-transparent border-0 border-b border-transparent w-full px-0 py-0.5',
                        'focus:border-sky-400 focus:outline-none',
                        'text-slate-600 dark:text-slate-300',
                        'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                      )}
                    />
                    {newTaskTitle.trim() && (
                      <button
                        type="button"
                        onClick={handleAddTask}
                        className="absolute right-0 text-sky-500 hover:text-sky-600 p-0.5 rounded"
                        title="Add task"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state */}
            {!hasItems && !canEdit && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-center">
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                    No checklist items
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
