"use client";
import React, { useState, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  ExpandedState,
  ColumnDef,
  CellContext
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Opportunity, DisciplineConfig } from '@/types/models';
import { useProjectSettings, useUpdateOpportunity, useCreateOpportunity } from '@/hooks/useProjectQueries';
import { DisciplineAccordion } from './DisciplineAccordion';
import { CoordinationGhostRow } from './CoordinationGhostRow';
import { TextCell, PriorityCell, StatusCell } from '@/components/opportunities/EditableCell';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
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
  const disciplines: DisciplineConfig[] = (settings as any)?.disciplines || defaultDisciplines;
  const coordDetails = row.original.coordination_details || {};

  return (
    <div className="flex gap-1 items-center px-2 py-1 h-full cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={row.getToggleExpandedHandler()}>
      {disciplines.map((d: DisciplineConfig) => {
        const status = coordDetails[d.id]?.status || 'Not Required';
        if (status === 'Not Required') return null;
        if (status === 'Complete') return <span key={d.id} title={`${d.label}: Complete`}><CheckCircle2 size={14} className="text-emerald-500" /></span>;
        if (status === 'Pending' || status === 'Required') return <span key={d.id} title={`${d.label}: Pending`}><AlertCircle size={14} className="text-amber-500" /></span>;
        return <span key={d.id} title={d.label}><Circle size={14} className="text-slate-300" /></span>;
      })}
      {disciplines.every((d: DisciplineConfig) => (coordDetails[d.id]?.status || 'Not Required') === 'Not Required') && (
        <span className="text-xs text-slate-400 italic">No tasks</span>
      )}
    </div>
  );
});

export default function CoordinationTable({ projectId, opportunities }: Props) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number | null, columnId: string | null }>({ rowIndex: null, columnId: null });

  const columns: ColumnDef<Opportunity, any>[] = [
    {
      id: 'expander',
      header: () => null,
      size: 40,
      cell: ({ row }) => (
        <div className="flex items-center justify-center h-full px-2">
          <button
            onClick={row.getToggleExpandedHandler()}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      ),
    },
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
    }
  ];

  const table = useReactTable({
    data: opportunities,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
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
        
        <div 
          ref={tableContainerRef} 
          className="flex-1 overflow-auto rounded-xl outline-none"
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
                      className="px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
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
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr>
                      <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-slate-100 dark:border-slate-800/50">
                        <DisciplineAccordion row={row} projectId={projectId} />
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
