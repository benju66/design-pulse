"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useUpdateOpportunity, useCreateOpportunity } from '@/hooks/useProjectQueries';
import { useUIStore } from '@/stores/useUIStore';

// Custom cell for inline editing (The "Excel" feel)
const EditableCell = ({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const updateMutation = table.options.meta?.updateData;

  const onBlur = () => {
    if (value !== initialValue) {
      updateMutation.mutate({
        id: row.original.id,
        updates: { [column.id]: value }
      });
    }
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (column.id === 'status') {
    return (
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          updateMutation.mutate({ id: row.original.id, updates: { status: e.target.value } });
        }}
        className="w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 rounded p-1 text-sm font-medium cursor-pointer"
      >
        <option value="Draft">Draft</option>
        <option value="Pending Review">Pending Review</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
      </select>
    );
  }

  return (
    <input
      value={value || ''}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      className={`w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 rounded p-1 text-sm ${
        column.id === 'cost_impact' && value < 0 ? 'text-emerald-600 font-bold' : ''
      }`}
      type={column.id === 'cost_impact' || column.id === 'days_impact' ? 'number' : 'text'}
    />
  );
};

const ExpandedCard = ({ row, updateData }) => {
  const fields = [
    { id: 'arch_plans_spec', label: 'Arch Plans/Spec' },
    { id: 'bok_standard', label: 'BOK Standard' },
    { id: 'existing_conditions', label: 'Existing Conditions' },
    { id: 'mep_impact', label: 'MEP Impact' },
    { id: 'owner_goals', label: 'Owner Goals' },
    { id: 'final_direction', label: 'Final Direction' },
    { id: 'backing_required', label: 'Backing Required' },
    { id: 'coordination_required', label: 'Coordination Required' },
    { id: 'design_lock_phase', label: 'Design Lock Phase' },
  ];

  return (
    <div className="p-4 bg-slate-100 dark:bg-slate-800/50 grid grid-cols-3 gap-4 border-l-2 border-slate-300 dark:border-slate-600 ml-8 mb-2 rounded-r-lg shadow-inner">
      {fields.map(f => (
        <div key={f.id} className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{f.label}</label>
          <input
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
            defaultValue={row.original[f.id] || ''}
            onBlur={(e) => {
              if (e.target.value !== (row.original[f.id] || '')) {
                updateData.mutate({ id: row.original.id, updates: { [f.id]: e.target.value } });
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          />
        </div>
      ))}
    </div>
  );
};

export default function OpportunityGrid({ projectId, data, viewMode = 'flat' }) {
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const { selectedOpportunityId, setSelectedOpportunityId } = useUIStore();

  useEffect(() => {
    if (selectedOpportunityId) {
      const element = document.getElementById(`row-${selectedOpportunityId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedOpportunityId]);

  const [expanded, setExpanded] = useState({});

  const flatColumns = useMemo(
    () => [
      { accessorKey: 'title', header: 'Title (Element)', cell: EditableCell },
      { accessorKey: 'location', header: 'Location', cell: EditableCell },
      { accessorKey: 'scope', header: 'Scope', cell: EditableCell },
      { accessorKey: 'arch_plans_spec', header: 'Arch Plans/Spec', cell: EditableCell },
      { accessorKey: 'bok_standard', header: 'BOK Standard', cell: EditableCell },
      { accessorKey: 'existing_conditions', header: 'Existing Conditions', cell: EditableCell },
      { accessorKey: 'mep_impact', header: 'MEP Impact', cell: EditableCell },
      { accessorKey: 'owner_goals', header: 'Owner Goals', cell: EditableCell },
      { accessorKey: 'backing_required', header: 'Backing Req.', cell: EditableCell },
      { accessorKey: 'coordination_required', header: 'Coord Req.', cell: EditableCell },
      { accessorKey: 'design_lock_phase', header: 'Design Lock Phase', cell: EditableCell },
      { accessorKey: 'final_direction', header: 'Final Direction', cell: EditableCell },
      { accessorKey: 'assignee', header: 'Assignee', cell: EditableCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: EditableCell },
      { accessorKey: 'status', header: 'Status', cell: EditableCell },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: EditableCell },
    ],
    []
  );

  const cardColumns = useMemo(
    () => [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
          >
            {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ),
      },
      { accessorKey: 'title', header: 'Title (Element)', cell: EditableCell },
      { accessorKey: 'location', header: 'Location', cell: EditableCell },
      { accessorKey: 'assignee', header: 'Assignee', cell: EditableCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: EditableCell },
      { accessorKey: 'status', header: 'Status', cell: EditableCell },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: EditableCell },
    ],
    []
  );

  const columns = viewMode === 'card' ? cardColumns : flatColumns;

  const table = useReactTable({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    meta: {
      updateData: updateMutation,
    },
  });

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {table.getRowModel().rows.map((row) => {
            const isSelected = selectedOpportunityId === row.original.id;
            return (
              <React.Fragment key={row.id}>
                <tr 
                  id={`row-${row.original.id}`}
                  onClick={() => setSelectedOpportunityId(row.original.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-sky-50 dark:bg-sky-900/20 border-l-2 border-sky-500' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {viewMode === 'card' && row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-slate-100 dark:border-slate-800/50">
                      <ExpandedCard row={row} updateData={updateMutation} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={15} className="px-4 py-8 text-center text-slate-500">
                No VE or Alternates logged yet. Start typing below to add one!
              </td>
            </tr>
          )}

          {/* Ghost Row for Quick Add */}
          <tr className="bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/50 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
            {table.getVisibleLeafColumns().map((column) => {
              if (column.id === 'expander') {
                return <td key={column.id} className="px-3 py-2 align-middle text-slate-400 text-center text-xs font-bold">+</td>;
              }
              if (column.id === 'status') {
                return <td key={column.id} className="px-3 py-2 align-middle"><span className="text-sm text-slate-400 px-1 italic">Draft</span></td>;
              }
              return (
                <td key={column.id} className="px-3 py-2 align-middle">
                  <input
                    type={column.id === 'cost_impact' || column.id === 'days_impact' ? 'number' : 'text'}
                    placeholder={`+ Add ${typeof column.columnDef.header === 'string' ? column.columnDef.header : 'Item'}...`}
                    className="w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 rounded p-1 text-sm text-slate-500 placeholder-slate-400/70 italic"
                    onBlur={(e) => {
                      if (e.target.value.trim() !== '') {
                        let val = e.target.value;
                        if (column.id === 'cost_impact' || column.id === 'days_impact') val = Number(val) || 0;
                        createMutation.mutate({ [column.id]: val });
                        e.target.value = '';
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim() !== '') {
                        let val = e.target.value;
                        if (column.id === 'cost_impact' || column.id === 'days_impact') val = Number(val) || 0;
                        createMutation.mutate({ [column.id]: val });
                        e.target.value = '';
                        e.target.blur();
                      }
                    }}
                  />
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
