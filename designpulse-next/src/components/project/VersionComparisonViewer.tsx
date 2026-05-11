'use client';
import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { useCompareEstimateVersions } from '@/hooks/useEstimateQueries';
import { EstimateComparisonRow } from '@/types/models';
import { AlertCircle, Loader2 } from 'lucide-react';

const columnHelper = createColumnHelper<EstimateComparisonRow>();

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function VersionComparisonViewer({
  projectId,
  versionAId,
  versionBId,
}: {
  projectId: string;
  versionAId: string;
  versionBId: string;
}) {
  const { data: rows, isLoading, error } = useCompareEstimateVersions(projectId, versionAId, versionBId);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'cost_code', desc: false }]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('cost_code', {
        header: 'Code',
        cell: (info) => (
          <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: (info) => (
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('cost_type', {
        header: 'Type',
        cell: (info) => {
          const type = info.getValue();
          if (!type) return null;
          return (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {type}
            </span>
          );
        },
      }),
      columnHelper.accessor('old_amount', {
        header: 'Old Budget',
        cell: (info) => (
          <span className="font-mono text-sm text-slate-500 line-through decoration-slate-300 dark:decoration-slate-600">
            {formatCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('new_amount', {
        header: 'New Budget',
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
            {formatCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('delta_amount', {
        header: 'Variance',
        cell: (info) => {
          const delta = info.getValue();
          if (delta === 0) {
            return (
              <span className="font-mono text-sm text-slate-400 dark:text-slate-500">
                $0.00
              </span>
            );
          }
          if (delta < 0) {
            return (
              <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(delta)}
              </span>
            );
          }
          return (
            <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-500">
              +{formatCurrency(delta)}
            </span>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: rows ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (error) {
    return (
      <div className="p-12 text-center text-rose-500 flex flex-col items-center">
        <AlertCircle size={32} className="mb-4 opacity-50" />
        <p className="font-medium">Failed to compare versions.</p>
        <p className="text-sm opacity-70 mt-1">{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-12 text-center flex flex-col items-center text-slate-500">
        <Loader2 size={32} className="animate-spin mb-4 text-sky-500" />
        <p>Crunching variances...</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors ${
                row.original.delta_amount > 0
                  ? 'bg-rose-50/30 dark:bg-rose-900/10'
                  : row.original.delta_amount < 0
                  ? 'bg-emerald-50/30 dark:bg-emerald-900/10'
                  : ''
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500 italic">
                No budget data found for these versions.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
