"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useUpdateOpportunity } from '@/hooks/useProjectQueries';
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
      type={column.id === 'cost_impact' ? 'number' : 'text'}
    />
  );
};

export default function OpportunityGrid({ projectId, data }) {
  const updateMutation = useUpdateOpportunity(projectId);
  const { selectedOpportunityId, setSelectedOpportunityId } = useUIStore();

  useEffect(() => {
    if (selectedOpportunityId) {
      const element = document.getElementById(`row-${selectedOpportunityId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedOpportunityId]);

  const columns = useMemo(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'type', header: 'Type' },
      { accessorKey: 'title', header: 'Title', cell: EditableCell },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: EditableCell },
      { accessorKey: 'status', header: 'Status', cell: EditableCell },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
            <tr 
              key={row.id} 
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
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No VE or Alternates logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
