"use client";
import React, { useState, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  CellContext
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Opportunity, DisciplineConfig } from '@/types/models';
import { useProjectSettings, useUpdateOpportunity, useCreateOpportunity } from '@/hooks/useProjectQueries';
import { CoordinationGhostRow } from './CoordinationGhostRow';
import { TextCell, PriorityCell, StatusCell } from '@/components/opportunities/EditableCell';
import { useUIStore } from '@/stores/useUIStore';

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
  const rawDisciplines = (settings as any)?.disciplines;
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

export default function CoordinationTable({ projectId, opportunities }: Props) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number | null, columnId: string | null }>({ rowIndex: null, columnId: null });

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
    getCoreRowModel: getCoreRowModel(),
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
                  <tr 
                    onClick={() => setSelectedOpportunityId(row.original.id)}
                    className={`cursor-pointer transition-colors ${
                      row.original.id === selectedOpportunityId 
                        ? 'bg-sky-50 dark:bg-sky-900/20 border-l-2 border-sky-500' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-0 border-r border-slate-200 dark:border-slate-800 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
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
