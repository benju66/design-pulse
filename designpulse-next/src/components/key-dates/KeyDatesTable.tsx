"use client";

import { useRef, useMemo, useState, KeyboardEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { TimelineEvent } from '@/types/models';
import { useUpdateKeyDate, useDeleteKeyDate } from '@/hooks/useKeyDateQueries';
import { useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { useUIStore } from '@/stores/useUIStore';
import { ColumnChooser } from '@/components/opportunities/ColumnChooser';
import { useGridNavigation } from '@/hooks/useGridNavigation';
import { CheckboxCell, CheckboxHeader } from '@/components/data-table/cells';
import { BulkActionBar, DataTable, GhostRow, TableToolbar } from '@/components/data-table';
import { DeleteConfirmModal } from '@/components/data-table/DeleteConfirmModal';
import { TextCell } from '@/components/data-table/cells/TextCell';
import { DateCell } from '@/components/data-table/cells/DateCell';
import { toast } from 'sonner';

const EMPTY_VISIBILITY: Record<string, boolean> = {};
const DEFAULT_COLUMN_ORDER = ['select', 'display_id', 'title', 'description', 'event_date', 'source_type'];

interface KeyDatesTableProps {
  projectId: string;
  keyDates: TimelineEvent[];
  createMutation: {
    mutate: (data: Record<string, unknown>) => void;
    isPending: boolean;
  };
}

export function KeyDatesTable({
  projectId,
  keyDates,
  createMutation,
}: KeyDatesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateKeyDate = useUpdateKeyDate(projectId);
  const deleteKeyDate = useDeleteKeyDate(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);

  // Column Visibility and Order Preferences from Zustand Store
  const columnVisibility = useUIStore(state => state.keyDatesColumnVisibility[projectId] || EMPTY_VISIBILITY);
  const setColumnVisibility = useUIStore(state => state.setKeyDatesColumnVisibility);
  const columnOrder = useUIStore(state => state.keyDatesColumnOrder[projectId] || DEFAULT_COLUMN_ORDER);
  const setColumnOrder = useUIStore(state => state.setKeyDatesColumnOrder);

  const moveActiveCellRef = useRef<any>(null);

  const isDeliverableRow = (row: TimelineEvent) => row.source_type === 'deliverable';

  const columns = useMemo<ColumnDef<TimelineEvent>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <CheckboxHeader table={table} />,
      cell: (info) => <CheckboxCell info={info} disabled={!permissions.can_edit_records} />,
      size: 45,
      enableSorting: false,
    },
    {
      accessorKey: 'display_id',
      header: 'ID',
      cell: ({ row }) => (
        <div className="flex items-center w-full h-full px-2">
          <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 rounded">
            {row.original.display_id || 'KD-???'}
          </span>
        </div>
      ),
      size: 90,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: (info) => <TextCell info={info} isLocked={isDeliverableRow} />,
      size: 280,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: (info) => <TextCell info={info} isLocked={isDeliverableRow} />,
      size: 350,
    },
    {
      id: 'event_date',
      accessorFn: (row: TimelineEvent) => row.timeline_date,
      header: 'Date',
      cell: (info) => <DateCell {...info} isLocked={isDeliverableRow} />,
      size: 130,
    },
    {
      accessorKey: 'source_type',
      header: 'Source',
      cell: ({ row }) => (
        <div className="flex items-center w-full h-full px-2">
          <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
            row.original.source_type === 'deliverable'
              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/60'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
          }`}>
            {row.original.source_type === 'deliverable' ? 'Deliverable' : 'Key Date'}
          </span>
        </div>
      ),
      size: 110,
      enableSorting: true,
    },
  ], [permissions.can_edit_records]);

  const table = useReactTable({
    data: keyDates,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      rowSelection,
      globalFilter,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => setColumnVisibility(projectId, updater as any),
    onColumnOrderChange: (updater) => setColumnOrder(projectId, updater as any),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    enableRowSelection: true,
    meta: {
      updateData: updateKeyDate,
      permissions,
      projectId,
      moveActiveCellRef,
    },
  });

  // Enable keyboard navigation
  const gridNav = useGridNavigation(table as any);

  moveActiveCellRef.current = gridNav.moveActiveCell;

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows
      .filter(row => row.original.source_type === 'key_date');
    if (selectedRows.length === 0) return;
    setIsDeleting(true);
    try {
      for (const row of selectedRows) {
        await deleteKeyDate.mutateAsync(row.original.id);
      }
      setRowSelection({});
      toast.success("Selected key dates successfully deleted");
    } catch (error: any) {
      toast.error("Failed to delete some key dates");
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleTableKeyDown = (e: KeyboardEvent<Element>) => {
    gridNav.handleKeyDown(e as unknown as KeyboardEvent<HTMLElement>);
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      {/* Toolbar */}
      <TableToolbar
        searchValue={globalFilter ?? ''}
        onSearchChange={setGlobalFilter}
        searchPlaceholder="Search key dates..."
        filterCount={0}
        onFilterToggle={() => {}}
        columnChooser={<ColumnChooser table={table as any} projectId={projectId} />}
      />

      {/* Main Grid Container */}
      <DataTable
        table={table}
        onKeyDown={handleTableKeyDown}
        emptyMessage="Get started by adding your first project key date using the button above."
        maxHeight="calc(100vh - 280px)"
        footerContent={
          permissions.can_edit_records && (
            <GhostRow
              table={table}
              createMutation={createMutation}
              defaultValues={{ project_id: projectId }}
              staticFields={[{ columnId: 'display_id', displayValue: 'KD-???' }]}
            />
          )
        }
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={table.getSelectedRowModel().rows.length}
        entityLabel="Key Dates"
        onDelete={() => setIsDeleteModalOpen(true)}
        onClear={() => setRowSelection({})}
        canDelete={permissions.can_delete_records}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        isDeleting={isDeleting}
        count={table.getSelectedRowModel().rows.length}
        entityName="Key Dates"
      />
    </div>
  );
}
