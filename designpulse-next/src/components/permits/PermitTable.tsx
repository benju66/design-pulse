"use client";
import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  CellContext,
  SortingState,
  Row,
  FilterFn,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronUp, ChevronDown, PanelRight, MapIcon, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { Permit, PermitTypeConfig, PermitAHJConfig } from '@/types/models';
import { useUpdatePermit, useDeletePermit, useCreatePermit, usePermitComments, useUpdatePermitStatusWithLog } from '@/hooks/usePermitQueries';
import { useProjectSettings, useProjectMembers } from '@/hooks/useProjectCoreQueries';
import { useUIStore } from '@/stores/useUIStore';
import { useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { GridFilterDrawer } from '@/components/ui/GridFilterDrawer';
import { ColumnChooser } from '@/components/opportunities/ColumnChooser';
import { PermitGhostRow } from './PermitGhostRow';
import { useGridNavigation } from '@/hooks/useGridNavigation';
import { AssigneeSelect } from '@/components/opportunities/AssigneeSelect';

// Common comparator for deep row memoization
const permitComparator = (prevProps: { row: Row<Permit> }, nextProps: { row: Row<Permit> }) => {
  return prevProps.row.original === nextProps.row.original && 
         prevProps.row.getIsSelected() === nextProps.row.getIsSelected();
};

const commonCellComparator = (prevProps: CellContext<Permit, unknown>, nextProps: CellContext<Permit, unknown>) => {
  if (prevProps.getValue() !== nextProps.getValue()) return false;
  if (prevProps.row.original !== nextProps.row.original) return false;
  return true;
};

// --- Cell Components ---
const cellClass = "w-full h-full px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-sky-500 rounded text-slate-900 dark:text-slate-100 transition-all";

{/* eslint-disable-next-line react/display-name */}
const PermitCheckboxCell = React.memo(({ row, table }: CellContext<Permit, unknown>) => {
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  return (
    <div className="w-full h-full flex items-center justify-center px-1">
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        disabled={!permissions.can_edit_records}
        onChange={row.getToggleSelectedHandler()}
        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50"
      />
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const PermitTextCell = React.memo(({ getValue, row, column, table }: CellContext<Permit, unknown>) => {
  const initialValue = getValue() as string;
  const [value, setValue] = useState(initialValue);
  const updateData = table.options.meta?.updateData;
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const disabled = !permissions.can_edit_records;

  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const gridMode = useUIStore(state => state.gridMode);
  const setGridMode = useUIStore(state => state.setGridMode);
  const isEditing = isCellActive && gridMode === 'edit' && !disabled;

  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const moveActiveCell = (table.options.meta as any)?.moveActiveCellRef?.current;
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
const PermitDateCell = React.memo(({ getValue, row, column, table }: CellContext<Permit, unknown>) => {
  const initialValue = getValue() as string;
  const updateData = table.options.meta?.updateData;
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
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
    const moveActiveCell = (table.options.meta as any)?.moveActiveCellRef?.current;
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
        defaultValue={initialValue || ''}
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
      {initialValue ? new Date(initialValue).toLocaleDateString() : <span className="text-slate-300 dark:text-slate-600 italic">--</span>}
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const OpenCommentsCell = React.memo(({ row, table }: CellContext<Permit, unknown>) => {
  const projectId = (table.options.meta as any)?.projectId;
  const { data: comments } = usePermitComments(projectId);
  const openCount = comments?.filter(c => c.permit_id === row.original.id && c.status === 'Open').length || 0;
  
  if (openCount === 0) return <div className="w-full h-full px-2 py-1 text-slate-400 text-sm flex items-center">--</div>;
  
  return (
    <div className="w-full h-full px-2 py-1 flex items-center">
      <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
        {openCount} Open
      </span>
    </div>
  );
});

{/* eslint-disable-next-line react/display-name */}
const PermitStatusCell = React.memo(({ getValue, row, column, table }: CellContext<Permit, unknown>) => {
  const initialValue = getValue() as string;
  const updateStatusWithLog = (table.options.meta as any)?.updateStatusWithLog;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const setGridMode = useUIStore(state => state.setGridMode);
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  let colorClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  if (initialValue === 'Submitted' || initialValue === 'Under Review') colorClass = 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
  else if (initialValue === 'Comments Received') colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  else if (initialValue === 'Approved') colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';

  return (
    <div className={`w-full h-full p-0 flex items-center relative ${isCellActive ? 'ring-2 ring-sky-400 z-10' : ''}`}>
      <select
        ref={selectRef}
        onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
        value={initialValue || 'Preparing'}
        disabled={!permissions.can_edit_records}
        onChange={e => {
          if (updateStatusWithLog && e.target.value !== initialValue) {
            updateStatusWithLog(row.original.id, e.target.value);
          }
          setGridMode('navigate');
        }}
        className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 px-2 py-1 text-sm font-medium cursor-pointer ${colorClass}`}
      >
        <option value="None">None</option>
        <option value="Preparing">Preparing</option>
        <option value="Submitted">Submitted</option>
        <option value="Comments Received">Comments Received</option>
        <option value="Approved">Approved</option>
      </select>
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const PermitDropdownCell = React.memo(({ getValue, row, column, table, options }: CellContext<Permit, unknown> & { options: {id: string, label: string}[] }) => {
  const initialValue = getValue() as string;
  const updateData = table.options.meta?.updateData;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const setGridMode = useUIStore(state => state.setGridMode);
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  return (
    <div className={`w-full h-full p-0 flex items-center relative ${isCellActive ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20 z-10' : ''}`}>
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
        className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 px-2 py-1 text-sm cursor-pointer text-slate-900 dark:text-slate-100`}
      >
      <option value="" className="text-slate-400">None</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.label}>{opt.label}</option>
      ))}
    </select>
    </div>
  );
}, commonCellComparator);

{/* eslint-disable-next-line react/display-name */}
const PermitAssigneeCell = React.memo(({ getValue, row, column, table }: CellContext<Permit, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateData = table.options.meta?.updateData;
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const projectMembers = (table.options.meta as any)?.projectMembers || [];
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
              updateData.mutate({ id: row.original.id, updates: { [column.id]: newValue } });
            }
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
      className={`w-full h-full px-2 py-1 min-h-[28px] outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 ${isCellActive && !isEditing ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      {displayElement}
    </div>
  );
}, commonCellComparator);

const OpenPanelCell = ({ row }: { row: Row<Permit> }) => {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const setPermitViewMode = useUIStore(state => state.setPermitViewMode);

  return (
    <div className="w-full h-full flex items-center justify-center px-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSelectedOpportunityId(row.original.id);
          setPermitViewMode('table-split');
        }}
        className={`p-1 rounded-md transition-colors ${
          selectedOpportunityId === row.original.id
            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
        }`}
      >
        <PanelRight size={16} />
      </button>
    </div>
  );
};

// --- Custom Filter Functions ---
const multiSelectFilter: FilterFn<any> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const cellValue = row.getValue(columnId) as string;
  return filterValue.includes(cellValue);
};

const assigneeFilter: FilterFn<any> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const cellValue = row.getValue(columnId) as string;
  if (!cellValue) return false;
  const emails = cellValue.split(',').map(e => e.trim());
  return emails.some(e => filterValue.includes(e));
};

interface PermitTableProps {
  projectId: string;
  permits: Permit[];
  filterSlot?: React.ReactNode;
  filterActiveCount?: number;
  onClearFilters?: () => void;
  createMutation: ReturnType<typeof useCreatePermit>;
}

const EMPTY_VISIBILITY = {};
const EMPTY_ORDER: string[] = [];

export const PermitTable = ({ projectId, permits, filterSlot, filterActiveCount = 0, onClearFilters, createMutation }: PermitTableProps) => {
  const updateData = useUpdatePermit(projectId);
  const deletePermit = useDeletePermit(projectId);
  const { permissions: rawPermissions } = useCurrentUserPermissions(projectId);
  const permissions = rawPermissions || { can_edit_records: false, can_delete_records: false };
  const updateStatusWithLog = useUpdatePermitStatusWithLog(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { data: members } = useProjectMembers(projectId);

  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const permitColumnVisibility = useUIStore(state => state.permitColumnVisibility[projectId] || EMPTY_VISIBILITY);
  const setPermitColumnVisibility = useUIStore(state => state.setPermitColumnVisibility);
  const permitColumnOrder = useUIStore(state => state.permitColumnOrder[projectId] || EMPTY_ORDER);
  const setPermitColumnOrder = useUIStore(state => state.setPermitColumnOrder);
  
  const isMapVisible = useUIStore(state => state.isMapVisible);
  const toggleMapVisibility = useUIStore(state => state.toggleMapVisibility);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Column definitions matching the implementation plan
  const columns = useMemo<ColumnDef<Permit, any>[]>(() => {
    const permitTypes = (settings?.permit_types as PermitTypeConfig[]) || [];
    const permitAHJs = (settings?.permit_ahjs as PermitAHJConfig[]) || [];

    return [
      {
        id: 'select',
        header: ({ table }) => {
          const perms = (table.options.meta as any)?.permissions || { can_edit_records: false };
          return (
            <div className="w-full h-full flex items-center justify-center px-1">
              <input
                type="checkbox"
                checked={table.getIsAllPageRowsSelected()}
                disabled={!perms.can_edit_records}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50"
              />
            </div>
          );
        },
        cell: PermitCheckboxCell,
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'open_panel',
        header: '',
        cell: (info) => <OpenPanelCell row={info.row} />,
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'display_id',
        header: 'ID',
        cell: (info) => (
          <div className="w-full h-full px-2 py-1 flex items-center">
            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {info.getValue() || '--'}
            </span>
          </div>
        ),
        size: 80,
      },
      {
        accessorKey: 'title',
        header: 'Permit Title',
        cell: PermitTextCell,
        size: 250,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: PermitStatusCell,
        size: 150,
        filterFn: multiSelectFilter,
      },
      {
        accessorKey: 'permit_type',
        header: 'Permit Type',
        cell: (props) => <PermitDropdownCell {...props} options={permitTypes} />,
        size: 150,
        filterFn: multiSelectFilter,
      },
      {
        accessorKey: 'ahj',
        header: 'AHJ',
        cell: (props) => <PermitDropdownCell {...props} options={permitAHJs} />,
        size: 150,
        filterFn: multiSelectFilter,
      },
      {
        accessorKey: 'assignee',
        header: 'Assignee',
        cell: PermitAssigneeCell,
        size: 120,
        filterFn: assigneeFilter,
      },
      {
        accessorKey: 'date_submitted',
        header: 'Submitted',
        cell: PermitDateCell,
        size: 120,
      },
      {
        accessorKey: 'target_approval_date',
        header: 'Target Approval',
        cell: PermitDateCell,
        size: 120,
      },
      {
        id: 'open_comments',
        header: 'Open Comments',
        cell: OpenCommentsCell,
        size: 120,
        enableSorting: false,
      },
      {
        accessorKey: 'revision_number',
        header: 'Rev #',
        cell: (info) => (
          <div className="w-full h-full px-2 py-1 text-sm flex items-center text-slate-600 dark:text-slate-400">
            {info.getValue() ?? '--'}
          </div>
        ),
        size: 80,
        enableSorting: false,
      },
    ];
  }, [settings?.permit_types, settings?.permit_ahjs]);

  const [rowSelection, setRowSelection] = useState({});

  const moveActiveCellRef = useRef<any>(null);

  const table = useReactTable({
    data: permits,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility: permitColumnVisibility,
      columnOrder: permitColumnOrder.length > 0 ? permitColumnOrder : columns.map(c => c.id as string),
      rowSelection,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => setPermitColumnVisibility(projectId, updater as any),
    onColumnOrderChange: (updater) => setPermitColumnOrder(projectId, updater as any),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    meta: {
      projectId,
      updateData,
      updateStatusWithLog,
      permissions,
      projectMembers: members || [],
      moveActiveCellRef,
    },
  });

  const { rows } = table.getRowModel();
  
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // Dense table sizing
    overscan: 10,
  });

  // Handle selected items for bulk actions
  const compareQueue = table.getSelectedRowModel().rows;
  
  const clearCompareQueue = () => table.toggleAllPageRowsSelected(false);

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    for (const row of compareQueue) {
      await deletePermit.mutateAsync(row.original.id);
    }
    clearCompareQueue();
    setIsDeleting(false);
    setIsDeleteModalOpen(false);
  };

  useEffect(() => {
    if (selectedOpportunityId) {
      const index = rows.findIndex(r => r.original.id === selectedOpportunityId);
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'center' });
      }
    }
  }, [selectedOpportunityId, rows, virtualizer]);

  const { handleKeyDown, moveActiveCell } = useGridNavigation(table as any, virtualizer);
  moveActiveCellRef.current = moveActiveCell;

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative flex flex-col">
        
        <div className="flex items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-t-xl z-20">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">Permit Log</span>
            <input 
              type="text"
              placeholder="Search permits..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 w-64"
            />
          </div>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {filterSlot && (
              <button
                onClick={() => setIsFilterOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isFilterOpen || filterActiveCount > 0
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal size={15} />
                <span>Filters</span>
                {filterActiveCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 text-xs font-bold text-white bg-sky-500 rounded-full">
                    {filterActiveCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={toggleMapVisibility}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isMapVisible
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <MapIcon size={16} /> Drawings
            </button>
            <ColumnChooser table={table as any} projectId={projectId} />
          </div>
        </div>

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

        <div 
          ref={parentRef} 
          className="flex-1 min-h-0 overflow-auto rounded-b-xl outline-none"
          tabIndex={0}
          onKeyDown={(e) => {
            if (handleKeyDown) handleKeyDown(e as any);
          }}
        >
          <table 
            className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0" 
            style={{ tableLayout: 'fixed', minWidth: table.getTotalSize() }}
          >
            <thead className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th 
                      key={header.id} 
                      className="relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 select-none group bg-slate-100 dark:bg-slate-900"
                      style={{ width: header.getSize() }}
                    >
                      <div 
                        className={`min-w-0 flex items-center justify-between ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {{
                          asc: <ChevronUp size={14} className="ml-1 inline-block shrink-0" />,
                          desc: <ChevronDown size={14} className="ml-1 inline-block shrink-0" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                      
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize user-select-none touch-none bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity ${
                            header.column.getIsResizing() ? 'opacity-100 bg-sky-600 w-2' : ''
                          }`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            
            {paddingTop > 0 && (
              <tbody><tr><td style={{ height: `${paddingTop}px` }} colSpan={columns.length} /></tr></tbody>
            )}
            
            <tbody>
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <MemoizedPermitRow
                    key={row.id}
                    row={row}
                    virtualRow={virtualRow}
                    selectedOpportunityId={selectedOpportunityId}
                    measureElement={virtualizer.measureElement}
                  />
                );
              })}
              {permissions.can_edit_records && (
                <PermitGhostRow table={table} createMutation={createMutation} />
              )}
            </tbody>
            
            {paddingBottom > 0 && (
              <tbody><tr><td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} /></tr></tbody>
            )}
            
            {permits.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                    No permits found. Add one below!
                  </td>
                </tr>
              </tbody>
            )}
          </table>

          {compareQueue.length > 0 && (
            <div className="sticky bottom-0 w-full bg-slate-900 text-white p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 rounded-b-xl border-t border-slate-800">
              <div className="flex items-center gap-4">
                <div className="bg-sky-500 text-white text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">
                  {compareQueue.length}
                </div>
                <span className="font-medium text-sm text-slate-200">Permits Selected</span>
              </div>
              <div className="flex gap-3">
                {permissions.can_delete_records && (
                  <button 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-4 py-2 text-sm font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Delete ({compareQueue.length})
                  </button>
                )}
                <button 
                  onClick={clearCompareQueue}
                  className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete {compareQueue.length} Permits?</h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Are you sure you want to delete these permits? This action cannot be undone.
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : 'Delete Permits'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

{/* eslint-disable-next-line react/display-name */}
const MemoizedPermitRow = React.memo(({ row, virtualRow, selectedOpportunityId, measureElement }: {
  row: Row<Permit>;
  virtualRow: any;
  selectedOpportunityId: string | null;
  measureElement: (element: HTMLElement | null) => void;
}) => {
  const isSelected = selectedOpportunityId === row.original.id;
  const isChecked = row.getIsSelected();

  return (
    <tr
      ref={measureElement}
      data-index={virtualRow.index}
      className={`group border-b border-slate-200 dark:border-slate-800 transition-colors ${
        isSelected 
          ? 'bg-sky-50 dark:bg-sky-900/20 shadow-[inset_2px_0_0_0_#0ea5e9]' 
          : isChecked
            ? 'bg-sky-50/50 dark:bg-sky-900/10'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900'
      }`}
    >
      {row.getVisibleCells().map(cell => (
        <td
          key={cell.id}
          className="p-0 border-r border-b border-slate-200 dark:border-slate-800 relative align-middle"
          style={{ width: cell.column.getSize() }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}, permitComparator);
