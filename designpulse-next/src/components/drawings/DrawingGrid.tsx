"use client";
import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  RowSelectionState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ProjectSheet } from '@/types/map.types';
import { DisciplineConfig } from '@/types/models';
import { FileImage, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { useUpdateProjectSheet } from '@/hooks/useMapQueries';

const columnHelper = createColumnHelper<ProjectSheet>();

export function suggestDiscipline(sheetName: string, disciplines: DisciplineConfig[]): DisciplineConfig | null {
  if (!sheetName) return null;
  const match = sheetName.match(/^[A-Za-z]+/);
  if (!match) return null;
  const prefix = match[0].toUpperCase();
  
  if (prefix === 'A') return disciplines.find(d => d.label === 'Architectural') || null;
  if (prefix === 'S') return disciplines.find(d => d.label === 'Structural') || null;
  if (prefix === 'C') return disciplines.find(d => d.label === 'Civil') || null;
  if (prefix === 'L') return disciplines.find(d => d.label === 'Landscape') || null;
  if (prefix === 'M') return disciplines.find(d => d.label === 'Mechanical') || null;
  if (prefix === 'E') return disciplines.find(d => d.label === 'Electrical') || null;
  if (prefix === 'P') return disciplines.find(d => d.label === 'Plumbing') || null;
  if (prefix === 'FP') return disciplines.find(d => d.label === 'Fire Protection') || null;
  if (prefix === 'G') return disciplines.find(d => d.label === 'General') || null;
  
  return null;
}

interface DrawingGridProps {
  projectId: string;
  sheets: ProjectSheet[];
  disciplines: DisciplineConfig[];
  onOpenViewer: (sheetId: string) => void;
}

export function DrawingGrid({ projectId, sheets, disciplines, onOpenViewer }: DrawingGridProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const updateSheetMutation = useUpdateProjectSheet();
  
  const [bulkDisciplineId, setBulkDisciplineId] = useState<string>('');

  const handleBulkAssign = () => {
    if (!bulkDisciplineId) return;
    const selectedIds = Object.keys(rowSelection);
    selectedIds.forEach((indexStr) => {
      const idx = parseInt(indexStr, 10);
      const sheet = sheets[idx];
      if (sheet) {
        updateSheetMutation.mutate({
          projectId,
          sheetId: sheet.id,
          updates: { discipline_id: bulkDisciplineId }
        });
      }
    });
    setRowSelection({});
    setBulkDisciplineId('');
  };

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'selection',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 40,
    }),
    columnHelper.accessor('staged_key', {
      header: 'Preview',
      size: 60,
      cell: (info) => {
        const val = info.getValue();
        if (!val) return <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center"><FileImage size={16} className="text-slate-400" /></div>;
        
        // Thumbnail is stored next to the tiles: /tiles/{staged_key}/thumb.webp
        const { data: publicUrlData } = supabase.storage.from('project_drawings').getPublicUrl(`tiles/${val}/thumb.webp`);
        return (
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicUrlData.publicUrl} alt="Thumbnail" className="w-full h-full object-cover" onError={(e) => {
               (e.target as HTMLImageElement).style.display = 'none';
            }} />
          </div>
        );
      }
    }),
    columnHelper.accessor('sheet_name', {
      header: 'Sheet Name',
      cell: (info) => <span className="font-semibold text-slate-900 dark:text-slate-100">{info.getValue() || 'Unnamed'}</span>,
    }),
    columnHelper.accessor('discipline_id', {
      header: 'Discipline',
      cell: (info) => {
        const val = info.getValue();
        const sheet = info.row.original;
        const suggested = suggestDiscipline(sheet.sheet_name, disciplines);
        const hasSuggestion = !val && suggested;
        
        return (
          <div className="relative group" onClick={e => e.stopPropagation()}>
            <select
              value={val || ''}
              onChange={(e) => {
                updateSheetMutation.mutate({
                  projectId,
                  sheetId: sheet.id,
                  updates: { discipline_id: e.target.value || null }
                });
              }}
              className={`w-full bg-transparent text-sm font-medium border-0 focus:ring-0 cursor-pointer ${
                hasSuggestion ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <option value="">{hasSuggestion ? `Suggested: ${suggested.label}` : 'Select Discipline...'}</option>
              {disciplines.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
            {hasSuggestion && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <span className="text-[10px] uppercase bg-amber-100 text-amber-800 px-1 rounded font-bold">Auto</span>
              </div>
            )}
          </div>
        );
      }
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const val = info.getValue();
        if (val === 'ready') return <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded w-fit"><CheckCircle2 size={14} /> Ready</span>;
        if (val === 'processing') return <span className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-2 py-1 rounded w-fit"><Loader2 size={14} className="animate-spin" /> Processing</span>;
        return <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded w-fit" title={info.row.original.status_message || ''}><AlertCircle size={14} /> Error</span>;
      }
    }),
    columnHelper.accessor('created_at', {
      header: 'Uploaded Date',
      cell: (info) => <span className="text-slate-500 text-sm">{format(new Date(info.getValue()), 'MMM d, yyyy')}</span>,
    }),
  ], [disciplines, projectId, updateSheetMutation]);

  const table = useReactTable({
    data: sheets,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 relative">
      {/* Bulk Actions Header */}
      {selectedCount > 0 && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-sky-50 dark:bg-sky-900/30 border-b border-sky-200 dark:border-sky-800 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-sky-800 dark:text-sky-200">
            {selectedCount} sheet{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <select
              value={bulkDisciplineId}
              onChange={e => setBulkDisciplineId(e.target.value)}
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none"
            >
              <option value="">Assign Discipline...</option>
              {disciplines.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkDisciplineId || updateSheetMutation.isPending}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              Apply
            </button>
            <button
              onClick={() => setRowSelection({})}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-semibold ml-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950/50 sticky top-0 z-0">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {table.getRowModel().rows.map(row => (
              <tr 
                key={row.id} 
                onClick={() => {
                  if (row.original.status === 'ready') {
                    onOpenViewer(row.original.id);
                  }
                }}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${row.original.status === 'ready' ? 'cursor-pointer' : 'opacity-80'}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {sheets.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <ImageIcon size={48} strokeWidth={1} className="mb-4 text-slate-300 dark:text-slate-700" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No drawings uploaded yet</p>
                    <p className="text-sm mt-1">Click "Import Drawings" to upload a PDF set.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
