"use client";
import React, { useState, useRef, useEffect } from 'react';
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
  getExpandedRowModel
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronUp, ChevronDown, PanelRight } from 'lucide-react';
import { Opportunity, DisciplineConfig } from '@/types/models';
import { useProjectSettings, useUpdateOpportunity, useCreateOpportunity } from '@/hooks/useProjectQueries';
import { CoordinationGhostRow } from './CoordinationGhostRow';
import { TextCell, PriorityCell, StatusCell } from '@/components/opportunities/EditableCell';
import { useUIStore } from '@/stores/useUIStore';
import { ColumnChooser } from '@/components/opportunities/ColumnChooser';
import { ExpandedCard } from '@/components/opportunities/ExpandedCard';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
  viewMode?: string;
}

// Custom Discipline Status Cell
const DisciplineStatusCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const projectId = (table.options.meta as any)?.projectId;
  const { data: settings } = useProjectSettings(projectId);
  const defaultDisciplines: DisciplineConfig[] = [
    { id: 'd_arch', label: 'Arch' },
    { id: 'd_civil', label: 'Civil' },
    { id: 'd_struct', label: 'Struct' },
    { id: 'd_mech', label: 'Mech' },
    { id: 'd_elec', label: 'Elec' },
    { id: 'd_plumb', label: 'Plumb' }
  ];
  const rawDisciplines = settings?.disciplines;
  const disciplines: DisciplineConfig[] = Array.isArray(rawDisciplines) 
    ? rawDisciplines.map((d: any) => typeof d === 'string' ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d } : d)
    : defaultDisciplines;
  const coordDetails = row.original.coordination_details || {};

  return (
    <div className="flex gap-1 items-center px-2 py-1 h-full cursor-default">
      {disciplines.map((d: DisciplineConfig) => {
        const status = coordDetails[d.id]?.status || 'Not Required';
        if (status === 'Not Required') return null;
        
        const isCompleted = status === 'Complete';
        const isPending = status === 'Pending' || status === 'Required';
        
        let colorClass = 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
        if (isCompleted) colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
        else if (isPending) colorClass = 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';

        return (
          <div 
            key={d.id} 
            title={`${d.label}: ${status}`} 
            className={`flex items-center justify-center w-5 h-5 rounded border text-[10px] font-bold ${colorClass}`}
          >
            {d.label.charAt(0).toUpperCase()}
          </div>
        );
      })}
      {disciplines.every((d: DisciplineConfig) => (coordDetails[d.id]?.status || 'Not Required') === 'Not Required') && (
        <span className="text-xs text-slate-400 italic">No tasks</span>
      )}
    </div>
  );
});

const OpenPanelCell = ({ row }: { row: Row<Opportunity> }) => {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const setCoordinationViewMode = useUIStore(state => state.setCoordinationViewMode);
  return (
    <div className="flex items-center justify-center p-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (selectedOpportunityId === row.original.id) {
            setSelectedOpportunityId(null);
          } else {
            setSelectedOpportunityId(row.original.id);
            setCoordinationViewMode('table-split');
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

export default function CoordinationTable({ projectId, opportunities, viewMode = 'flat' }: Props) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number | null, columnId: string | null }>({ rowIndex: null, columnId: null });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  
  const coordColumnVisibility = useUIStore(state => state.coordColumnVisibility);
  const setCoordColumnVisibility = useUIStore(state => state.setCoordColumnVisibility);
  const coordColumnOrder = useUIStore(state => state.coordColumnOrder);
  const setCoordColumnOrder = useUIStore(state => state.setCoordColumnOrder);

  useEffect(() => {
    if (selectedOpportunityId) {
      const element = document.getElementById(`row-${selectedOpportunityId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedOpportunityId]);

  const columns: ColumnDef<Opportunity, any>[] = [
    {
      accessorKey: 'display_id',
      header: 'ID',
      size: 80,
      cell: ({ getValue }) => <div className="px-2 py-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">{getValue<string>()}</div>,
    },
    {
      accessorKey: 'record_type',
      header: 'Type',
      size: 100,
      cell: ({ getValue }) => {
        const type = getValue<string>() || 'VE';
        return (
          <div className="px-2 py-1 h-full flex items-center">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              type === 'Coordination' 
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
            }`}>
              {type}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: 'title',
      header: 'Task / Item',
      size: 400,
      cell: TextCell,
    },
    {
      accessorKey: 'final_direction',
      header: 'Final Selection',
      size: 200,
      cell: ({ getValue }) => {
        const val = getValue<string>();
        if (!val) return <div className="px-2 py-1.5 text-xs text-slate-400">--</div>;
        const displayVal = val.startsWith('Locked: ') ? val.substring(8) : val;
        return (
          <div className="px-2 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 truncate" title={displayVal}>
            {displayVal}
          </div>
        );
      }
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      size: 100,
      cell: PriorityCell,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 140,
      cell: StatusCell,
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      size: 120,
      cell: TextCell,
    },
    {
      id: 'discipline_status',
      header: 'Disciplines',
      size: 150,
      cell: DisciplineStatusCell,
    },
    {
      id: 'open_panel',
      header: '',
      size: 40,
      cell: OpenPanelCell,
    }
  ];

  const table = useReactTable({
    data: opportunities,
    columns,
    state: { sorting, globalFilter, columnVisibility: coordColumnVisibility, columnOrder: coordColumnOrder },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setCoordColumnVisibility,
    onColumnOrderChange: setCoordColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    meta: {
      updateData: updateMutation,
      activeCell,
      setActiveCell,
      projectId,
    } as any
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44, // Base height
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-hidden">
      <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-t-xl z-20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">Coordination List</span>
            <input 
              type="text"
              placeholder="Search tasks..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 w-64"
            />
          </div>
          <ColumnChooser table={table as any} />
        </div>

        <div 
          ref={tableContainerRef} 
          className="flex-1 overflow-auto rounded-b-xl outline-none"
        >
          <table 
            className="text-left text-sm whitespace-nowrap" 
            style={{ tableLayout: 'fixed', width: table.getTotalSize() }}
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
                        className={`truncate flex items-center justify-between ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
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
            
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tbody 
                  key={row.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="border-b border-slate-100 dark:border-slate-800/50"
                >
                  <tr 
                    id={`row-${row.original.id}`}
                    onClick={() => setSelectedOpportunityId(row.original.id)}
                    className={`cursor-pointer transition-colors ${
                      row.original.id === selectedOpportunityId 
                        ? 'bg-sky-50 dark:bg-sky-900/20 border-l-2 border-sky-500' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {viewMode === 'card' && row.getIsExpanded() && (
                    <tr>
                      <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-slate-100 dark:border-slate-800/50">
                        <ExpandedCard row={row as any} />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
            
            {paddingBottom > 0 && (
              <tbody><tr><td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} /></tr></tbody>
            )}
            
            {opportunities.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                    No items in Coordination Tracker. Add one below!
                  </td>
                </tr>
              </tbody>
            )}

            <tbody>
              <CoordinationGhostRow table={table as any} createMutation={createMutation} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
