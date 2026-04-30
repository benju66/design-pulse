"use client";
import React, { useRef, useMemo, useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  CellContext,
  SortingState,
  Row,
} from '@tanstack/react-table';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { ChevronUp, ChevronDown, PanelRight } from 'lucide-react';
import { Permit, PermitTypeConfig, PermitAHJConfig } from '@/types/models';
import { useUpdatePermit, useDeletePermit } from '@/hooks/usePermitQueries';
import { useProjectSettings } from '@/hooks/useProjectQueries';
import { useUIStore } from '@/stores/useUIStore';

interface PermitTableMeta {
  projectId: string;
  updateData?: ReturnType<typeof useUpdatePermit>;
}

// Common styling for cells to match CoordinationTable/OpportunityGrid
const cellClass = "w-full h-full px-2 py-1.5 text-xs bg-transparent outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-sky-500 rounded border border-transparent focus:border-sky-500 text-slate-900 dark:text-slate-100 transition-all";
const headerClass = "flex items-center gap-2 p-2 text-xs font-semibold text-slate-500 dark:text-slate-400 select-none whitespace-nowrap";

const TextCell = React.memo(({ getValue, row, column, table }: CellContext<Permit, unknown>) => {
  const initialValue = getValue() as string;
  const meta = table.options.meta as PermitTableMeta | undefined;
  const updateData = meta?.updateData;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);

  if (isCellActive) {
    return (
      <div className="w-full h-full p-0 flex">
        <input
          autoFocus
          defaultValue={initialValue || ''}
          onBlur={e => {
            if (e.target.value !== initialValue && updateData) {
              updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value } });
            }
            if (isCellActive) setActiveCell(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              if (e.currentTarget.value !== initialValue && updateData) {
                updateData.mutate({ id: row.original.id, updates: { [column.id]: e.currentTarget.value } });
              }
              setActiveCell(null);
            }
          }}
          className={`${cellClass} bg-white dark:bg-slate-800 border-sky-500 ring-2 ring-sky-500/20`}
        />
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full px-2 py-1.5 flex items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 group truncate"
      onClick={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      title={initialValue || ''}
    >
      <span className="truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
        {initialValue || <span className="text-slate-300 dark:text-slate-600 italic">--</span>}
      </span>
    </div>
  );
});

const DateCell = React.memo(({ getValue, row, column, table }: CellContext<Permit, unknown>) => {
  const initialValue = getValue() as string;
  const meta = table.options.meta as PermitTableMeta | undefined;
  const updateData = meta?.updateData;
  
  return (
    <div className="w-full h-full p-0 flex">
      <input
        type="date"
        value={initialValue || ''}
        onChange={e => {
          if (updateData) {
            updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value || null } });
          }
        }}
        className={cellClass}
      />
    </div>
  );
});

const StatusCell = React.memo(({ getValue, row, column, table }: CellContext<Permit, unknown>) => {
  const initialValue = getValue() as string;
  const meta = table.options.meta as PermitTableMeta | undefined;
  const updateData = meta?.updateData;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);

  if (isCellActive) {
    return (
      <div className="w-full h-full p-0 flex">
        <select
          value={initialValue || 'Preparing'}
          onChange={e => {
            if (updateData && e.target.value !== initialValue) {
              updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value } });
            }
            setActiveCell(null);
          }}
          onBlur={() => {
            if (isCellActive) setActiveCell(null);
          }}
          autoFocus
          className="w-full h-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-sky-500 rounded outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100"
        >
          <option value="Preparing">Preparing</option>
          <option value="Submitted">Submitted</option>
          <option value="Under Review">Under Review</option>
          <option value="Comments Received">Comments Received</option>
          <option value="Approved">Approved</option>
        </select>
      </div>
    );
  }

  let colorClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  if (initialValue === 'Submitted' || initialValue === 'Under Review') colorClass = 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
  else if (initialValue === 'Comments Received') colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  else if (initialValue === 'Approved') colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';

  return (
    <div 
      className="w-full h-full px-2 py-1.5 flex items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 group"
      onClick={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
    >
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass} group-hover:ring-1 group-hover:ring-slate-300 dark:group-hover:ring-slate-600`}>
        {initialValue || 'Preparing'}
      </span>
    </div>
  );
});

const DropdownCell = React.memo(({ getValue, row, column, table, options }: CellContext<Permit, unknown> & { options: {id: string, label: string}[] }) => {
  const initialValue = getValue() as string;
  const meta = table.options.meta as PermitTableMeta | undefined;
  const updateData = meta?.updateData;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);

  if (isCellActive) {
    return (
      <div className="w-full h-full p-0 flex">
        <select
          value={initialValue || ''}
          onChange={e => {
            if (updateData && e.target.value !== initialValue) {
              updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value || null } });
            }
            setActiveCell(null);
          }}
          onBlur={() => {
            if (isCellActive) setActiveCell(null);
          }}
          autoFocus
          className="w-full h-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-sky-500 rounded outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100"
        >
          <option value="">-- None --</option>
          {options.map(opt => (
            <option key={opt.id} value={opt.label}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full px-2 py-1.5 flex items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 group truncate"
      onClick={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
    >
      <span className="truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
        {initialValue || <span className="text-slate-300 dark:text-slate-600 italic">--</span>}
      </span>
    </div>
  );
});

const OpenPanelCell = ({ row }: { row: Row<Permit> }) => {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const setPermitViewMode = useUIStore(state => state.setPermitViewMode);

  return (
    <div className="flex items-center justify-center p-1 w-full h-full">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (selectedOpportunityId === row.original.id) {
            setSelectedOpportunityId(null);
          } else {
            setSelectedOpportunityId(row.original.id);
            setPermitViewMode('table-split');
          }
        }}
        className={`p-1 rounded transition-colors ${
          selectedOpportunityId === row.original.id 
            ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' 
            : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30'
        }`}
        title="Open Details Panel"
      >
        <PanelRight size={20} />
      </button>
    </div>
  );
};

const MemoizedPermitRow = React.memo(({ 
  row, 
  virtualRow, 
  measureElement
}: { 
  row: Row<Permit>; 
  virtualRow: VirtualItem; 
  measureElement: (element: Element | null) => void;
  visibleColumnIds: string;
}) => {
  return (
    <tbody 
      ref={measureElement}
      data-index={virtualRow.index}
      className="border-b border-slate-100 dark:border-slate-800/50"
    >
      <tr 
        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className="p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800 align-top bg-white dark:bg-slate-900">
            <div 
              className="h-full min-h-[38px] w-full"
              style={{ 
                width: cell.column.getSize(),
                maxWidth: cell.column.getSize(),
              }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </td>
        ))}
      </tr>
    </tbody>
  );
}, (prev, next) => {
  return prev.row.original === next.row.original && prev.visibleColumnIds === next.visibleColumnIds;
});

export default function PermitTable({ projectId, permits }: { projectId: string, permits: Permit[] }) {
  const updateData = useUpdatePermit(projectId);
  const deleteData = useDeletePermit(projectId);
  const { data: settings } = useProjectSettings(projectId);
  
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const permitTypes = (settings?.permit_types as PermitTypeConfig[]) || [];
  const permitAHJs = (settings?.permit_ahjs as PermitAHJConfig[]) || [];

  const columns = useMemo<ColumnDef<Permit>[]>(() => [
    {
      id: 'open_panel',
      header: () => <div className={headerClass}></div>,
      cell: OpenPanelCell,
      size: 40,
    },
    {
      id: 'display_id',
      accessorKey: 'display_id',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          ID
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: info => <div className="px-3 py-2 text-xs font-medium text-slate-500 whitespace-nowrap">{info.getValue() as string}</div>,
      size: 100,
    },
    {
      id: 'title',
      accessorKey: 'title',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          Permit Name
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: TextCell,
      size: 300,
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          Status
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: StatusCell,
      size: 160,
    },
    {
      id: 'permit_type',
      accessorKey: 'permit_type',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          Type
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: (props) => <DropdownCell {...props} options={permitTypes} />,
      size: 180,
    },
    {
      id: 'ahj',
      accessorKey: 'ahj',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          AHJ
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: (props) => <DropdownCell {...props} options={permitAHJs} />,
      size: 180,
    },
    {
      id: 'assignee',
      accessorKey: 'assignee',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          Assignee
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: TextCell,
      size: 200,
    },
    {
      id: 'date_submitted',
      accessorKey: 'date_submitted',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          Date Submitted
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: DateCell,
      size: 140,
    },
    {
      id: 'target_approval_date',
      accessorKey: 'target_approval_date',
      header: ({ column }) => (
        <div className={headerClass} onClick={column.getToggleSortingHandler()} style={{ cursor: 'pointer' }}>
          Target Approval
          {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[column.getIsSorted() as string] ?? null}
        </div>
      ),
      cell: DateCell,
      size: 140,
    },
    {
      id: 'actions',
      header: () => <div className={headerClass}>Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center p-1">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this permit?')) {
                deleteData.mutate(row.original.id);
              }
            }}
            className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1 rounded"
          >
            Delete
          </button>
        </div>
      ),
      size: 80,
    }
  ], [permitTypes, permitAHJs, deleteData]);

  const metaRef = useRef({ projectId, updateData });
  useEffect(() => {
    metaRef.current = { projectId, updateData };
  }, [projectId, updateData]);

  const table = useReactTable({
    data: permits,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    meta: metaRef.current,
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 dark:bg-slate-950">
      <div 
        ref={parentRef}
        className="flex-1 overflow-auto custom-scrollbar bg-slate-50 dark:bg-slate-900 border-x border-b border-slate-200 dark:border-slate-800"
      >
        <div style={{ width: table.getTotalSize() }}>
          <table className="w-full border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 shadow-sm border-b border-slate-300 dark:border-slate-700">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id}
                      className="p-0 border-r border-slate-300 dark:border-slate-700 last:border-r-0 relative group"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none bg-sky-500/0 hover:bg-sky-500/50 transition-colors ${
                            header.column.getIsResizing() ? 'bg-sky-500 w-1' : ''
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
            
            {virtualItems.map(virtualRow => {
              const row = table.getRowModel().rows[virtualRow.index];
              const visibleColumnIds = row.getVisibleCells().map(c => c.column.id).join(',');
              return (
                <MemoizedPermitRow 
                  key={row.id}
                  row={row} 
                  virtualRow={virtualRow}
                  measureElement={rowVirtualizer.measureElement}
                  visibleColumnIds={visibleColumnIds}
                />
              );
            })}
            
            {paddingBottom > 0 && (
              <tbody><tr><td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} /></tr></tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
