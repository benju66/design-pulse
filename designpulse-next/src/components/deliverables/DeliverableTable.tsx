"use client";
import React, { useRef, useMemo, useState, useEffect, KeyboardEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  CellContext,
  SortingState,
} from '@tanstack/react-table';
import { PanelRight } from 'lucide-react';
import { ProjectDeliverable, Permit } from '@/types/models';
import { useUpdateDeliverable, useDeleteDeliverable } from '@/hooks/useDeliverableQueries';
import { useProjectMembers, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { usePermits } from '@/hooks/usePermitQueries';
import { useUIStore } from '@/stores/useUIStore';
import { ColumnChooser } from '@/components/opportunities/ColumnChooser';
import { useGridNavigation } from '@/hooks/useGridNavigation';
import { AssigneeSelect } from '@/components/opportunities/AssigneeSelect';
import { CheckboxCell, CheckboxHeader, commonCellComparator } from '@/components/data-table/cells';
import { DataTable, GhostRow, BulkActionBar, MemoizedRow, TableToolbar } from '@/components/data-table';
import { DeleteConfirmModal } from '@/components/data-table/DeleteConfirmModal';
import { Button } from '@/components/ui/Button';
import { formatDate, toDateInputValue } from '@/lib/formatters';
import { toast } from 'sonner';
import { GridFilterDrawer } from '@/components/ui/GridFilterDrawer';

const cellClass = "w-full h-full px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-sky-500 rounded text-slate-900 dark:text-slate-100 transition-all";

{/* eslint-disable-next-line react/display-name */}
const DeliverableTextCell = React.memo(({ getValue, row, column, table }: CellContext<ProjectDeliverable, unknown>) => {
  const initialValue = getValue() as string;
  const [value, setValue] = useState(initialValue);
  const updateData = table.options.meta?.updateData;
  const permissions = table.options.meta?.permissions || { can_edit_records: false };
  const disabled = !permissions.can_edit_records;

  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const gridMode = useUIStore(state => state.gridMode);
  const setGridMode = useUIStore(state => state.setGridMode);
  const isEditing = isCellActive && gridMode === 'edit' && !disabled;

  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isCellActive && gridMode === 'edit' && disabled) {
      setGridMode('navigate');
    }
  }, [isCellActive, gridMode, disabled, setGridMode]);

  useEffect(() => {
    if (isCellActive && !isEditing && divRef.current) {
      setTimeout(() => divRef.current?.focus(), 0);
    }
  }, [isCellActive, isEditing]);

  const onBlur = () => {
    if (value !== initialValue && updateData) {
      updateData.mutate({ id: row.original.id, updates: { [column.id]: value } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const moveActiveCell = table.options.meta?.moveActiveCellRef?.current;
    if (e.key === 'Enter') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setValue(initialValue);
      setGridMode('navigate');
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={value || ''}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={`${cellClass} bg-transparent border-none focus:z-10 relative`}
        type="text"
      />
    );
  }

  return (
    <div
      ref={divRef}
      tabIndex={0}
      onClick={() => {
        setActiveCell({ rowIndex: row.index, columnId: column.id });
        setGridMode('navigate');
      }}
      onDoubleClick={() => {
        if (!disabled) setGridMode('edit');
      }}
      className={`w-full h-full px-2 py-1 text-sm min-h-[28px] outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 truncate cursor-text text-slate-900 dark:text-slate-100 ${isCellActive && !isEditing ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      {value || <span className="text-slate-300 dark:text-slate-600 italic">--</span>}
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const DeliverableDateCell = React.memo(({ getValue, row, column, table }: CellContext<ProjectDeliverable, unknown>) => {
  const initialValue = getValue() as string;
  const updateData = table.options.meta?.updateData;
  const permissions = table.options.meta?.permissions || { can_edit_records: false };
  const disabled = !permissions.can_edit_records;

  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const gridMode = useUIStore(state => state.gridMode);
  const setGridMode = useUIStore(state => state.setGridMode);
  const isEditing = isCellActive && gridMode === 'edit' && !disabled;

  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCellActive && gridMode === 'edit' && disabled) {
      setGridMode('navigate');
    }
  }, [isCellActive, gridMode, disabled, setGridMode]);

  useEffect(() => {
    if (isCellActive && !isEditing && divRef.current) {
      setTimeout(() => divRef.current?.focus(), 0);
    }
  }, [isCellActive, isEditing]);

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value !== initialValue && updateData) {
      updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value || null } });
    }
    setGridMode('navigate');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const moveActiveCell = table.options.meta?.moveActiveCellRef?.current;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.currentTarget.value !== initialValue && updateData) {
        updateData.mutate({ id: row.original.id, updates: { [column.id]: e.currentTarget.value || null } });
      }
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.currentTarget.value !== initialValue && updateData) {
        updateData.mutate({ id: row.original.id, updates: { [column.id]: e.currentTarget.value || null } });
      }
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setGridMode('navigate');
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        defaultValue={toDateInputValue(initialValue) || ''}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={`${cellClass} bg-transparent border-none focus:z-10 relative`}
        type="date"
      />
    );
  }

  return (
    <div
      ref={divRef}
      tabIndex={0}
      onClick={() => {
        setActiveCell({ rowIndex: row.index, columnId: column.id });
        setGridMode('navigate');
      }}
      onDoubleClick={() => {
        if (!disabled) setGridMode('edit');
      }}
      className={`w-full h-full px-2 py-1 text-sm min-h-[28px] outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 truncate cursor-text text-slate-900 dark:text-slate-100 ${isCellActive && !isEditing ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      {initialValue ? formatDate(initialValue) : <span className="text-slate-300 dark:text-slate-600 italic">--</span>}
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const DeliverableStatusCell = React.memo(({ getValue, row, column, table }: CellContext<ProjectDeliverable, unknown>) => {
  const initialValue = getValue() as string;
  const updateData = table.options.meta?.updateData;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const setGridMode = useUIStore(state => state.setGridMode);
  const permissions = table.options.meta?.permissions || { can_edit_records: false };
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  return (
    <div className="w-full h-full p-0 flex items-center relative focus-within:ring-2 focus-within:ring-sky-400 focus-within:bg-sky-50/50 dark:focus-within:bg-sky-900/20 focus-within:z-10">
      <select
        ref={selectRef}
        onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
        value={initialValue || 'Open'}
        disabled={!permissions.can_edit_records}
        onChange={e => {
          if (updateData && e.target.value !== initialValue) {
            updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value } });
          }
          setGridMode('navigate');
        }}
        className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 px-2 py-1 text-sm cursor-pointer text-slate-900 dark:text-slate-100"
      >
        <option value="Open">Open</option>
        <option value="In Progress">In Progress</option>
        <option value="Under Review">Under Review</option>
        <option value="Closed">Closed</option>
        <option value="Not Applicable">Not Applicable</option>
      </select>
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const DeliverableAssigneeCell = React.memo(({ getValue, row, column, table }: CellContext<ProjectDeliverable, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateData = table.options.meta?.updateData;
  const permissions = table.options.meta?.permissions || { can_edit_records: false };
  const projectMembers = table.options.meta?.projectMembers || [];
  const disabled = !permissions.can_edit_records;

  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const gridMode = useUIStore(state => state.gridMode);
  const setGridMode = useUIStore(state => state.setGridMode);
  const isEditing = isCellActive && gridMode === 'edit' && !disabled;

  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCellActive && gridMode === 'edit' && disabled) {
      setGridMode('navigate');
    }
  }, [isCellActive, gridMode, disabled, setGridMode]);

  useEffect(() => {
    if (isCellActive && !isEditing && divRef.current) {
      setTimeout(() => divRef.current?.focus(), 0);
    }
  }, [isCellActive, isEditing]);

  const emails = initialValue ? initialValue.split(',').map(e => e.trim()).filter(Boolean) : [];
  const assignedMembers = emails.map(email => {
    const matched = projectMembers.find((m: any) => m.email === email || m.name === email);
    return {
      email: matched?.email || email,
      displayName: matched ? (matched.name || matched.email) : email
    };
  });

  const displayElement = assignedMembers.length > 0 ? (
    <div className="flex items-center w-full h-full cursor-pointer overflow-hidden gap-1">
      {assignedMembers.slice(0, 3).map((m, i) => (
        <div key={i} title={m.displayName} className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm border border-white dark:border-slate-800 -ml-2 first:ml-0">
          {m.displayName.substring(0, 2).toUpperCase()}
        </div>
      ))}
      {assignedMembers.length > 3 && (
        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm border border-white dark:border-slate-800 -ml-2">
          +{assignedMembers.length - 3}
        </div>
      )}
    </div>
  ) : (
    <div className="w-full h-full flex items-center text-slate-300 dark:text-slate-600">--</div>
  );

  if (isEditing) {
    return (
      <div className="w-full h-full flex items-center px-1 bg-white dark:bg-slate-900" onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}>
        <AssigneeSelect
          value={initialValue || ''}
          members={projectMembers}
          autoFocus={true}
          onChange={(newValue) => {
            if (updateData) {
              updateData.mutate({ id: row.original.id, updates: { [column.id]: newValue || null } });
            }
            setGridMode('navigate');
          }}
          onClose={() => setGridMode('navigate')}
        />
      </div>
    );
  }

  return (
    <div
      ref={divRef}
      tabIndex={0}
      onClick={() => {
        setActiveCell({ rowIndex: row.index, columnId: column.id });
        setGridMode('navigate');
      }}
      onDoubleClick={() => {
        if (!disabled) setGridMode('edit');
      }}
      className={`w-full h-full px-2 py-1 text-sm min-h-[28px] outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 truncate cursor-text text-slate-900 dark:text-slate-100 ${isCellActive && !isEditing ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      {displayElement}
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const DeliverableKeyDateCell = React.memo(({ getValue, row, column, table }: CellContext<ProjectDeliverable, unknown>) => {
  const initialValue = getValue() as boolean;
  const updateData = table.options.meta?.updateData;
  const permissions = table.options.meta?.permissions || { can_edit_records: false };
  const disabled = !permissions.can_edit_records;

  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);

  const handleToggle = () => {
    if (disabled) return;
    if (updateData) {
      updateData.mutate({ id: row.original.id, updates: { [column.id]: !initialValue } });
    }
  };

  return (
    <div
      tabIndex={0}
      onClick={() => {
        setActiveCell({ rowIndex: row.index, columnId: column.id });
      }}
      className={`w-full h-full flex items-center justify-center min-h-[28px] outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 ${isCellActive ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        disabled={disabled}
        className={`w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${initialValue ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${initialValue ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const DeliverablePermitCell = React.memo(({ getValue, row, column, table }: CellContext<ProjectDeliverable, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateData = table.options.meta?.updateData;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const setGridMode = useUIStore(state => state.setGridMode);
  const permissions = table.options.meta?.permissions || { can_edit_records: false };
  const permits = table.options.meta?.permits || [];
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  return (
    <div className="w-full h-full p-0 flex items-center relative focus-within:ring-2 focus-within:ring-sky-400 focus-within:bg-sky-50/50 dark:focus-within:bg-sky-900/20 focus-within:z-10">
      <select
        ref={selectRef}
        onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
        value={initialValue || ''}
        disabled={!permissions.can_edit_records}
        onChange={e => {
          if (updateData && e.target.value !== initialValue) {
            updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value || null } });
          }
          setGridMode('navigate');
        }}
        className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 px-2 py-1 text-sm cursor-pointer text-slate-900 dark:text-slate-100"
      >
        <option value="">None</option>
        {permits.map((p: Permit) => (
          <option key={p.id} value={p.id}>
            {p.display_id ? `${p.display_id} - ${p.title}` : p.title}
          </option>
        ))}
      </select>
    </div>
  );
}, commonCellComparator);

const EMPTY_VISIBILITY: Record<string, boolean> = {};
const DEFAULT_COLUMN_ORDER = [
  'select', 'open_panel', 'display_id', 'title', 'due_date', 'status', 'assignee', 'is_elevated_key_date', 'permit_id'
];

interface DeliverableTableProps {
  projectId: string;
  deliverables: ProjectDeliverable[];
  filterSlot?: React.ReactNode;
  filterActiveCount?: number;
  onClearFilters?: () => void;
  createMutation: any;
}

export function DeliverableTable({
  projectId,
  deliverables,
  filterSlot,
  filterActiveCount = 0,
  onClearFilters,
  createMutation
}: DeliverableTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateDeliverable = useUpdateDeliverable(projectId);
  const deleteDeliverable = useDeleteDeliverable(projectId);
  const { data: permits = [] } = usePermits(projectId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);

  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);

  // Column Visibility and Order Preferences from Zustand Store
  const columnVisibility = useUIStore(state => state.deliverablesColumnVisibility[projectId] || EMPTY_VISIBILITY);
  const setColumnVisibility = useUIStore(state => state.setDeliverablesColumnVisibility);
  const columnOrder = useUIStore(state => state.deliverablesColumnOrder[projectId] || DEFAULT_COLUMN_ORDER);
  const setColumnOrder = useUIStore(state => state.setDeliverablesColumnOrder);

  const moveActiveCellRef = useRef<any>(null);

  const columns = useMemo<ColumnDef<ProjectDeliverable>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <CheckboxHeader table={table} />,
      cell: (info) => <CheckboxCell info={info} disabled={!permissions.can_edit_records} />,
      size: 45,
      enableSorting: false,
    },
    {
      id: 'open_panel',
      header: '',
      cell: ({ row }) => (
        <div className="w-full h-full flex items-center justify-center px-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOpportunityId(row.original.id);
            }}
            className={`p-1 rounded-md transition-colors ${
              selectedOpportunityId === row.original.id
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
            }`}
            title="Open detail panel"
          >
            <PanelRight size={16} />
          </button>
        </div>
      ),
      size: 40,
      enableSorting: false,
    },
    {
      accessorKey: 'display_id',
      header: 'ID',
      cell: ({ row }) => (
        <div className="flex items-center w-full min-h-[28px] px-2">
          <span className="px-1.5 py-0.5 text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/60 rounded">
            {row.original.display_id || 'DE-???'}
          </span>
        </div>
      ),
      size: 90,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: DeliverableTextCell,
      size: 280,
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: DeliverableDateCell,
      size: 130,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: DeliverableStatusCell,
      size: 160,
    },
    {
      accessorKey: 'assignee',
      header: 'Assignee',
      cell: DeliverableAssigneeCell,
      size: 150,
    },
    {
      accessorKey: 'is_elevated_key_date',
      header: 'Key Date',
      cell: DeliverableKeyDateCell,
      size: 100,
    },
    {
      accessorKey: 'permit_id',
      header: 'Parent Permit',
      cell: DeliverablePermitCell,
      size: 200,
    }
  ], [setSelectedOpportunityId, permissions.can_edit_records]);

  const table = useReactTable({
    data: deliverables,
    columns,
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
    getRowId: (row) => row.id,
    meta: {
      updateData: updateDeliverable,
      permissions,
      projectMembers,
      permits,
      projectId,
      moveActiveCellRef,
    },
  });

  // Enable keyboard navigation
  const gridNav = useGridNavigation(table as any);

  moveActiveCellRef.current = gridNav.moveActiveCell;

  // Type-safe wrapper matching KeyDatesTable reference pattern
  const handleTableKeyDown = (e: KeyboardEvent<Element>) => {
    gridNav.handleKeyDown(e as unknown as KeyboardEvent<HTMLElement>);
  };

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    setIsDeleting(true);
    try {
      for (const row of selectedRows) {
        await deleteDeliverable.mutateAsync(row.original.id);
      }
      setRowSelection({});
      toast.success("Selected deliverables successfully deleted");
    } catch (error: any) {
      toast.error("Failed to delete some deliverables");
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      {/* Toolbar */}
      <TableToolbar
        searchValue={globalFilter ?? ''}
        onSearchChange={setGlobalFilter}
        searchPlaceholder="Search deliverables..."
        filterCount={filterActiveCount}
        onFilterToggle={() => setIsFilterOpen(o => !o)}
        columnChooser={<ColumnChooser table={table as any} projectId={projectId} />}
      />

      {filterSlot && (
        <GridFilterDrawer
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          activeCount={filterActiveCount}
          onClearAll={() => onClearFilters?.()}
        >
          {filterSlot}
        </GridFilterDrawer>
      )}

      {/* Main Grid — shared DataTable wrapper handles virtualization, header, and empty state */}
      <DataTable
        table={table}
        estimateSize={36}
        maxHeight="100%"
        onKeyDown={handleTableKeyDown}
        emptyMessage="Get started by adding your first pre-construction deliverable item using the button above."
        footerContent={
          permissions.can_edit_records && (
            <GhostRow
              table={table}
              createMutation={createMutation}
              placeholder="Type new deliverable title and press Enter..."
              defaultValues={{
                project_id: projectId,
                status: 'Open',
                is_elevated_key_date: false,
                is_deleted: false,
              }}
              staticFields={[
                { columnId: 'display_id', displayValue: 'DE-???' },
              ]}
            />
          )
        }
      >
        {(row) => (
          <MemoizedRow
            key={row.id}
            row={row}
            isSelected={row.getIsSelected()}
            className={
              selectedOpportunityId === row.original.id
                ? 'bg-sky-50 dark:bg-sky-900/20 shadow-[inset_2px_0_0_0_#0ea5e9]'
                : ''
            }
            onClick={(r) => useUIStore.getState().setActiveCell({ rowIndex: r.index, columnId: '' })}
          />
        )}
      </DataTable>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={table.getSelectedRowModel().rows.length}
        entityLabel="Deliverables"
        onDelete={() => setIsDeleteModalOpen(true)}
        onClear={() => setRowSelection({})}
        canDelete={permissions.can_edit_records}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        isDeleting={isDeleting}
        count={table.getSelectedRowModel().rows.length}
        entityName="Deliverables"
      />
    </div>
  );
}
