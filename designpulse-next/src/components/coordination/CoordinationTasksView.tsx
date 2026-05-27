"use client";
import React, { useState, useRef, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  ColumnDef,
  CellContext,
  SortingState,
  VisibilityState,
  Row,
  RowSelectionState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  Plus,
  PanelRight,
} from 'lucide-react';
import {
  Opportunity,
  DisciplineConfig,
  DisciplineDetails,
  CoordinationTask,
  CoordGroupConfig,
} from '@/types/models';
import { useProjectSettings, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import {
  useCreateOpportunity,
  useDeleteOpportunity,
  useUpdateCoordinationDetails,
  useBulkUpdateCoordinationStatus,
  useBulkUpdateCoordGroup,
} from '@/hooks/useOpportunityQueries';
import { useUIStore } from '@/stores/useUIStore';
import { formatDate } from '@/lib/formatters';
import { DEFAULT_DISCIPLINES, UNASSIGNED_GROUP_ID } from '@/lib/constants';
import { CheckboxCell, CheckboxHeader } from '@/components/data-table/cells';
import { BulkActionBar, DeleteConfirmModal, GhostRow, TableEmptyState } from '@/components/data-table';
import { GridFilterDrawer } from '@/components/ui/GridFilterDrawer';
import { ColumnChooser } from '@/components/opportunities/ColumnChooser';
import { BulkStatusChangeMenu } from './BulkStatusChangeMenu';
import { BulkGroupAssignMenu } from './BulkGroupAssignMenu';
import { CoordinationGroupCell } from './CoordinationGroupCell';
import { SubTaskRow } from './SubTaskRow';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

// ── Module-level stable constants (Rule 47 — selector stability) ────────────
const EMPTY_VISIBILITY: VisibilityState = {};
const EMPTY_ORDER: string[] = [];
const EMPTY_GROUPS: CoordGroupConfig[] = [];

// ── Props ────────────────────────────────────────────────────────────────────
interface CoordinationTasksViewProps {
  projectId: string;
  opportunities: Opportunity[];
  coordGroups?: CoordGroupConfig[];
  onGroupsChange?: (groups: CoordGroupConfig[]) => void;
  activeGroupIds?: string[];
  filterSlot?: ReactNode;
  filterActiveCount?: number;
  onClearFilters?: () => void;
}

// ── Coordination status color helper (matches CoordinationTable) ─────────────
function statusColor(status: string): string {
  switch (status) {
    case 'Draft': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    case 'In Drafting': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'Ready for Review': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'Implemented': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'Not Applicable': return 'bg-slate-200 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400';
    default: return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }
}

// ── Sub-task count helper ────────────────────────────────────────────────────
function getSubTaskSummary(opp: Opportunity, disciplines: DisciplineConfig[]): { done: number; total: number } {
  const details = (opp.coordination_details || {}) as Record<string, unknown>;
  let done = 0;
  let total = 0;

  // Count discipline entries
  for (const d of disciplines) {
    const rawEntry = details[d.id];
    if (typeof rawEntry === 'object' && rawEntry !== null && 'status' in rawEntry) {
      const status = (rawEntry as { status: string }).status;
      if (status !== 'Not Required') {
        total++;
        if (status === 'Complete') done++;
      }
    }
  }

  // Count free-form tasks
  const tasks = details.tasks;
  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      if (t && typeof t === 'object' && 'status' in t) {
        total++;
        if ((t as CoordinationTask).status === 'Done') done++;
      }
    }
  }

  return { done, total };
}

// ── Memoized Parent Row ─────────────────────────────────────────────────────
interface MemoizedTaskRowProps {
  row: Row<Opportunity>;
  visibleColumnIds: string;
  pinnedColumnOffsets: string;
  isRowSelected: boolean;
  isExpanded: boolean;
  selectedOpportunityId: string | null;
  measureElement: (node: HTMLElement | null) => void;
  disciplines: DisciplineConfig[];
  canEdit: boolean;
  onTaskStatusChange: (oppId: string, taskId: string, newStatus: string) => void;
  onTaskAssigneeChange: (oppId: string, taskId: string, newAssignee: string) => void;
  onTaskDelete: (oppId: string, taskId: string) => void;
  onTaskCreate: (oppId: string, title: string) => void;
}

const MemoizedTaskRow = React.memo(function MemoizedTaskRow({
  row,
  visibleColumnIds: _visibleColumnIds,
  pinnedColumnOffsets: _pinnedColumnOffsets,
  isRowSelected: _isRowSelected,
  isExpanded,
  selectedOpportunityId,
  measureElement,
  disciplines,
  canEdit,
  onTaskStatusChange,
  onTaskAssigneeChange,
  onTaskDelete,
  onTaskCreate,
}: MemoizedTaskRowProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const isHighlighted = row.original.id === selectedOpportunityId;
  const details = (row.original.coordination_details || {}) as Record<string, unknown>;

  // Collect discipline sub-tasks
  const disciplineItems = useMemo(() => {
    const items: { id: string; label: string; status: string; notes: string }[] = [];
    for (const d of disciplines) {
      const rawEntry = details[d.id];
      if (typeof rawEntry === 'object' && rawEntry !== null && 'status' in rawEntry) {
        const disc = rawEntry as DisciplineDetails;
        if (disc.status !== 'Not Required') {
          items.push({ id: d.id, label: d.label, status: disc.status, notes: disc.notes || '' });
        }
      }
    }
    return items;
  }, [details, disciplines]);

  // Collect free-form tasks
  const tasks = useMemo(() => {
    const raw = details.tasks;
    if (!Array.isArray(raw)) return [];
    return (raw as CoordinationTask[]).sort((a, b) => a.order_index - b.order_index);
  }, [details]);

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    onTaskCreate(row.original.id, trimmed);
    setNewTaskTitle('');
  }, [newTaskTitle, onTaskCreate, row.original.id]);

  return (
    <tbody
      ref={measureElement}
      className="border-b border-slate-100 dark:border-slate-800/50"
    >
      <tr
        id={`row-${row.original.id}`}
        className={cn(
          'group transition-colors',
          isHighlighted
            ? 'bg-sky-50 dark:bg-sky-900/20 border-l-2 border-sky-500'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
        )}
      >
        {row.getVisibleCells().map((cell) => {
          const isPinned = cell.column.getIsPinned() === 'left';
          const isLastPinned = isPinned && cell.column.getIsLastColumn('left');
          return (
            <td
              key={cell.id}
              className={cn(
                'p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800 align-top bg-clip-padding',
                isPinned && `sticky z-[8] ${
                  isHighlighted
                    ? 'bg-sky-50 dark:bg-sky-900/20'
                    : 'bg-white dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                }`,
                isLastPinned && 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2',
              )}
              style={isPinned ? { left: cell.column.getStart('left') } : {}}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>

      {/* Expanded sub-task section */}
      {isExpanded && (
        <tr>
          <td
            colSpan={row.getVisibleCells().length}
            className="p-0 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50"
          >
            <div className="border-l-2 border-slate-200 dark:border-slate-700 ml-8 pl-4 py-2">
              {/* Discipline sub-rows */}
              {disciplineItems.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-1 block">
                    Disciplines
                  </span>
                  {disciplineItems.map(item => (
                    <SubTaskRow
                      key={item.id}
                      type="discipline"
                      label={item.label}
                      status={item.status}
                      notes={item.notes}
                      canEdit={false}
                    />
                  ))}
                </div>
              )}

              {/* Free-form task sub-rows */}
              {(tasks.length > 0 || canEdit) && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-1 block">
                    Tasks
                  </span>
                  {tasks.map(task => (
                    <SubTaskRow
                      key={task.id}
                      type="task"
                      label={task.title}
                      status={task.status}
                      assignee={task.assignee}
                      onStatusChange={(newStatus) => onTaskStatusChange(row.original.id, task.id, newStatus)}
                      onAssigneeChange={(newAssignee) => onTaskAssigneeChange(row.original.id, task.id, newAssignee)}
                      onDelete={() => onTaskDelete(row.original.id, task.id)}
                      canEdit={canEdit}
                    />
                  ))}

                  {/* Inline task creation */}
                  {canEdit && (
                    <div className="flex items-center gap-2 py-1.5 px-3">
                      <Plus size={14} className="text-slate-400 shrink-0" />
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
                          'text-sm bg-transparent border-0 border-b border-transparent w-full px-1 py-0.5',
                          'focus:border-sky-400 focus:outline-none',
                          'text-slate-600 dark:text-slate-300',
                          'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                        )}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Empty state when no sub-tasks at all */}
              {disciplineItems.length === 0 && tasks.length === 0 && !canEdit && (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic px-3 py-2">
                  No sub-tasks
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}, (prev, next) => {
  if (prev.row.original !== next.row.original) return false;
  if (prev.selectedOpportunityId !== next.selectedOpportunityId) return false;
  if (prev.visibleColumnIds !== next.visibleColumnIds) return false;
  if (prev.pinnedColumnOffsets !== next.pinnedColumnOffsets) return false;
  if (prev.isRowSelected !== next.isRowSelected) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  return true;
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function CoordinationTasksView({
  projectId,
  opportunities,
  coordGroups = EMPTY_GROUPS,
  onGroupsChange,
  activeGroupIds = EMPTY_ORDER,
  filterSlot,
  filterActiveCount = 0,
  onClearFilters,
}: CoordinationTasksViewProps) {
  // ── Store selectors (stable per Rule 47) ─────────────────────────────────
  const selectedOpportunityId = useUIStore(s => s.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(s => s.setSelectedOpportunityId);
  const columnVisibility = useUIStore(s => s.tasksColumnVisibility[projectId]) ?? EMPTY_VISIBILITY;
  const setColumnVisibility = useUIStore(s => s.setTasksColumnVisibility);
  const columnOrder = useUIStore(s => s.tasksColumnOrder[projectId]) ?? EMPTY_ORDER;
  const setColumnOrder = useUIStore(s => s.setTasksColumnOrder);

  // ── Project settings (C-6: called once in parent, not N times) ───────────
  const { data: settings } = useProjectSettings(projectId);
  const disciplines: DisciplineConfig[] = settings?.disciplines || DEFAULT_DISCIPLINES;
  const { permissions, isLoading: isPermLoading } = useCurrentUserPermissions(projectId);

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useCreateOpportunity(projectId);
  const deleteMutation = useDeleteOpportunity(projectId);
  const updateCoordDetails = useUpdateCoordinationDetails(projectId);
  const bulkStatusMutation = useBulkUpdateCoordinationStatus(projectId);
  const bulkGroupMutation = useBulkUpdateCoordGroup(projectId);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedRows = useMemo(
    () => Object.keys(rowSelection).filter(id => rowSelection[id]),
    [rowSelection]
  );
  const clearSelection = useCallback(() => setRowSelection({}), []);

  // ── Task mutation callbacks (lifted to parent — C24 compliance) ──────────
  const handleTaskStatusChange = useCallback((oppId: string, taskId: string, newStatus: string) => {
    const opp = opportunities.find(o => o.id === oppId);
    if (!opp) return;
    const details = (opp.coordination_details || {}) as Record<string, unknown>;
    const tasks = Array.isArray(details.tasks) ? [...(details.tasks as CoordinationTask[])] : [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], status: newStatus as CoordinationTask['status'] };
    updateCoordDetails.mutate({ id: oppId, updates: { tasks } });
  }, [opportunities, updateCoordDetails]);

  const handleTaskAssigneeChange = useCallback((oppId: string, taskId: string, newAssignee: string) => {
    const opp = opportunities.find(o => o.id === oppId);
    if (!opp) return;
    const details = (opp.coordination_details || {}) as Record<string, unknown>;
    const tasks = Array.isArray(details.tasks) ? [...(details.tasks as CoordinationTask[])] : [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], assignee: newAssignee || null };
    updateCoordDetails.mutate({ id: oppId, updates: { tasks } });
  }, [opportunities, updateCoordDetails]);

  const handleTaskDelete = useCallback((oppId: string, taskId: string) => {
    const opp = opportunities.find(o => o.id === oppId);
    if (!opp) return;
    const details = (opp.coordination_details || {}) as Record<string, unknown>;
    const tasks = Array.isArray(details.tasks) ? (details.tasks as CoordinationTask[]).filter(t => t.id !== taskId) : [];
    updateCoordDetails.mutate({ id: oppId, updates: { tasks } });
  }, [opportunities, updateCoordDetails]);

  const handleTaskCreate = useCallback((oppId: string, title: string) => {
    const opp = opportunities.find(o => o.id === oppId);
    if (!opp) return;
    const details = (opp.coordination_details || {}) as Record<string, unknown>;
    const existing = Array.isArray(details.tasks) ? (details.tasks as CoordinationTask[]) : [];
    const newTask: CoordinationTask = {
      id: crypto.randomUUID(),
      title,
      status: 'Open',
      assignee: null,
      order_index: existing.length,
    };
    updateCoordDetails.mutate({ id: oppId, updates: { tasks: [...existing, newTask] } });
  }, [opportunities, updateCoordDetails]);

  // ── Bulk action handlers ─────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    try {
      await Promise.all(selectedRows.map(id => deleteMutation.mutateAsync(id)));
      clearSelection();
      setIsDeleteModalOpen(false);
      toast.success(`${selectedRows.length} item(s) deleted`);
    } catch {
      toast.error('Failed to delete some items');
    }
  }, [selectedRows, deleteMutation, clearSelection]);

  const handleBulkStatusChange = useCallback(async (newStatus: string) => {
    bulkStatusMutation.mutate(
      { ids: selectedRows, newStatus },
      { onSuccess: () => { clearSelection(); toast.success(`Updated ${selectedRows.length} item(s)`); } }
    );
  }, [selectedRows, bulkStatusMutation, clearSelection]);

  const handleBulkGroupAssign = useCallback(async (groupId: string | null) => {
    bulkGroupMutation.mutate(
      { ids: selectedRows, groupId },
      { onSuccess: () => { clearSelection(); toast.success(`Updated ${selectedRows.length} item(s)`); } }
    );
  }, [selectedRows, bulkGroupMutation, clearSelection]);

  // ── Open panel handler ───────────────────────────────────────────────────
  const handleOpenPanel = useCallback((id: string, isCurrentlySelected: boolean) => {
    setSelectedOpportunityId(isCurrentlySelected ? null : id);
  }, [setSelectedOpportunityId]);

  // ── Column definitions ───────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Opportunity>[]>(() => [
    {
      id: 'select',
      size: 40,
      enableResizing: false,
      enableSorting: false,
      header: ({ table }) => <CheckboxHeader table={table} disabled={!permissions.can_edit_records} />,
      cell: (info) => <CheckboxCell info={info} disabled={!permissions.can_edit_records} />,
    },
    {
      id: 'expand',
      size: 40,
      enableResizing: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex items-center justify-center h-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              row.toggleExpanded();
            }}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            title={row.getIsExpanded() ? 'Collapse' : 'Expand'}
          >
            {row.getIsExpanded()
              ? <ChevronDown size={16} />
              : <ChevronRight size={16} />
            }
          </button>
        </div>
      ),
    },
    {
      id: 'open_panel',
      size: 40,
      enableResizing: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }: CellContext<Opportunity, unknown>) => (
        <div className="flex items-center justify-center p-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPanel(row.original.id, row.original.id === selectedOpportunityId);
            }}
            className={`p-1 rounded transition-colors ${
              row.original.id === selectedOpportunityId
                ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
                : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30'
            }`}
            title={row.original.id === selectedOpportunityId ? 'Close panel' : 'Open panel'}
          >
            <PanelRight size={20} />
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'display_id',
      id: 'display_id',
      header: 'ID',
      size: 90,
      cell: ({ getValue, row }) => {
        const recordType = row.original.record_type || 'Coordination';
        const badgeClass = recordType === 'Coordination'
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
        return (
          <div className="px-2 py-1.5 flex items-center h-full">
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${badgeClass}`}>
              {(getValue() as string) || '-'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'title',
      id: 'title',
      header: 'Title',
      size: 280,
      cell: ({ getValue }) => (
        <div className="px-2 py-1 text-sm text-slate-800 dark:text-slate-200 truncate h-full flex items-center">
          {(getValue() as string) || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'coordination_status',
      id: 'coordination_status',
      header: 'Status',
      size: 140,
      cell: ({ getValue }) => {
        const status = (getValue() as string) || 'Draft';
        return (
          <div className="px-2 py-1 h-full flex items-center">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(status))}>
              {status}
            </span>
          </div>
        );
      },
    },
    {
      id: 'coord_group',
      header: 'Group',
      size: 140,
      cell: (info: CellContext<Opportunity, unknown>) => (
        <CoordinationGroupCell
          {...info}
        />
      ),
    },
    {
      accessorKey: 'due_date',
      id: 'due_date',
      header: 'Due Date',
      size: 110,
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        return (
          <div className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 h-full flex items-center">
            {val ? formatDate(val) : '-'}
          </div>
        );
      },
    },
    {
      id: 'sub_task_summary',
      header: 'Sub-Tasks',
      size: 100,
      enableSorting: false,
      cell: ({ row }) => {
        const { done, total } = getSubTaskSummary(row.original, disciplines);
        if (total === 0) return <div className="px-2 py-1 text-xs text-slate-400 h-full flex items-center">—</div>;
        const allDone = done === total;
        return (
          <div className="px-2 py-1 h-full flex items-center">
            <span className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded',
              allDone
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            )}>
              {done}/{total}
            </span>
          </div>
        );
      },
    },
  ], [disciplines, coordGroups, permissions.can_edit_records, handleOpenPanel, selectedOpportunityId]);

  // ── TanStack Table ───────────────────────────────────────────────────────
  const table = useReactTable({
    data: opportunities,
    columns,
    state: {
      rowSelection,
      sorting,
      globalFilter,
      columnVisibility,
      columnOrder: columnOrder.length > 0 ? columnOrder : undefined,
      columnPinning: { left: ['select', 'expand', 'open_panel'] },
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVal = typeof updater === 'function' ? updater(columnVisibility) : updater;
      setColumnVisibility(projectId, newVal);
    },
    onColumnOrderChange: (updater) => {
      const newVal = typeof updater === 'function' ? updater(columnOrder) : updater;
      setColumnOrder(projectId, newVal);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: true,
    getRowId: (row) => row.id,
    columnResizeMode: 'onChange',
    meta: {
      projectId,
      disciplines,
      coordGroups,
      onGroupsChange,
    },
  });

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();

  // ── Virtualizer ──────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  if (isPermLoading) return null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Card wrapper — square top corners, rounded bottom per data-table-architecture §2 */}
      <div className="flex-1 min-h-0 rounded-b-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative flex flex-col">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50 z-20">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">
          Tasks Log
        </span>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mr-2" />

        {/* Search */}
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex-1" />

        {/* Filter button */}
        <button
          type="button"
          onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
            filterActiveCount > 0
              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          )}
        >
          <SlidersHorizontal size={14} />
          Filters
          {filterActiveCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-sky-500 text-white">
              {filterActiveCount}
            </span>
          )}
        </button>

        {/* Column chooser */}
        <ColumnChooser table={table} projectId={projectId} onReset={() => setColumnVisibility(projectId, {})} />
      </div>

      {/* Table area */}
      <div className="relative flex-1 min-h-0">
        <div ref={tableContainerRef} className="flex-1 min-h-0 overflow-auto rounded-b-xl">
          <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0" style={{ tableLayout: 'fixed', minWidth: table.getTotalSize() }}>
            {/* Column sizing */}
            <colgroup>
              {table.getVisibleFlatColumns().map(col => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>

            {/* Header */}
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
              {headerGroups.map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    const isPinned = header.column.getIsPinned() === 'left';
                    const isLastPinned = isPinned && header.column.getIsLastColumn('left');
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          'relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 select-none group bg-slate-100 dark:bg-slate-900 bg-clip-padding',
                          isPinned && 'sticky z-30 bg-slate-100 dark:bg-slate-900',
                          isLastPinned && 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2',
                          header.column.getCanSort() && 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800',
                        )}
                        style={{
                          width: header.column.getSize(),
                          ...(isPinned ? { left: header.column.getStart('left') } : {}),
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder ? null : (
                          <div className="flex items-center">
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {{
                              asc: <ChevronUp size={14} className="ml-1 inline-block shrink-0" />,
                              desc: <ChevronDown size={14} className="ml-1 inline-block shrink-0" />,
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        )}

                        {/* Resize handle */}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity ${
                              header.column.getIsResizing() ? 'opacity-100 bg-sky-600 w-[3px]' : ''
                            }`}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            {/* Body */}
            {rows.length === 0 ? (
              <TableEmptyState colSpan={columns.length} message="No coordination items match your filters." />
            ) : (
              <>
                {paddingTop > 0 && (
                  <tbody><tr><td style={{ height: `${paddingTop}px` }} colSpan={columns.length} /></tr></tbody>
                )}

                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  const visibleColumnIds = row.getVisibleCells().map(c => c.column.id).join(',');
                  const pinnedColumnOffsets = row.getVisibleCells()
                    .filter(c => c.column.getIsPinned())
                    .map(c => c.column.getStart('left'))
                    .join(',');
                  return (
                    <MemoizedTaskRow
                      key={row.id}
                      row={row}
                      visibleColumnIds={visibleColumnIds}
                      pinnedColumnOffsets={pinnedColumnOffsets}
                      isRowSelected={row.getIsSelected()}
                      isExpanded={row.getIsExpanded()}
                      selectedOpportunityId={selectedOpportunityId}
                      measureElement={virtualizer.measureElement}
                      disciplines={disciplines}
                      canEdit={permissions.can_edit_records}
                      onTaskStatusChange={handleTaskStatusChange}
                      onTaskAssigneeChange={handleTaskAssigneeChange}
                      onTaskDelete={handleTaskDelete}
                      onTaskCreate={handleTaskCreate}
                    />
                  );
                })}

                {paddingBottom > 0 && (
                  <tbody><tr><td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} /></tr></tbody>
                )}

                {/* Ghost Row */}
                <tbody>
                  {permissions.can_edit_records && (
                    <GhostRow
                      table={table as any}
                      createMutation={createMutation}
                      placeholder="+ Add Item..."
                      defaultValues={{
                        record_type: 'Coordination',
                        cost_impact: 0,
                        days_impact: 0,
                        status: 'Draft',
                        coordination_status: 'Draft',
                        priority: 'Set Priority',
                      }}
                      staticFields={[
                        { columnId: 'display_id', displayValue: '-' },
                        { columnId: 'expand', displayValue: '' },
                        { columnId: 'sub_task_summary', displayValue: '' },
                      ]}
                      onSubmit={(title) => {
                        const inheritedGroupId = activeGroupIds.length === 1 ? activeGroupIds[0] : undefined;
                        return {
                          title,
                          record_type: 'Coordination',
                          cost_impact: 0,
                          days_impact: 0,
                          status: 'Draft',
                          coordination_status: 'Draft',
                          priority: 'Set Priority',
                          ...(inheritedGroupId && inheritedGroupId !== UNASSIGNED_GROUP_ID ? { coord_group_id: inheritedGroupId } : {}),
                        };
                      }}
                    />
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>

        {/* Filter Drawer */}
        {isFilterDrawerOpen && filterSlot && (
          <GridFilterDrawer
            isOpen={isFilterDrawerOpen}
            onClose={() => setIsFilterDrawerOpen(false)}
            activeCount={filterActiveCount}
            onClearAll={onClearFilters || (() => {})}
          >
            {filterSlot}
          </GridFilterDrawer>
        )}
      </div>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedRows.length}
        entityLabel="Items"
        onClear={clearSelection}
        onDelete={() => setIsDeleteModalOpen(true)}
        canDelete={permissions.can_delete_records}
        extraActions={
          <>
            <BulkStatusChangeMenu
              selectedCount={selectedRows.length}
              onStatusSelect={handleBulkStatusChange}
              isUpdating={bulkStatusMutation.isPending}
            />
            <BulkGroupAssignMenu
              selectedCount={selectedRows.length}
              coordGroups={coordGroups}
              onGroupSelect={handleBulkGroupAssign}
              isUpdating={bulkGroupMutation.isPending}
            />
          </>
        }
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        isDeleting={deleteMutation.isPending}
        count={selectedRows.length}
        entityName="Items"
        description="Are you sure you want to delete these coordination items? This action will move them to the trash."
      />
    </div>
  );
}
