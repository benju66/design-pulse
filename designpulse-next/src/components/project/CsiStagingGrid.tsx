import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { CsiSpecItem } from '@/types/models';
import { SmartCostCodeCombobox } from '@/components/ui/SmartCostCodeCombobox';
import { CostCode } from '@/types/models';
import { Sparkles, Trash2 } from 'lucide-react';

interface CsiStagingGridProps {
  data: CsiSpecItem[];
  setData: React.Dispatch<React.SetStateAction<CsiSpecItem[]>>;
  costCodes: CostCode[];
}

export function CsiStagingGrid({ data, setData, costCodes }: CsiStagingGridProps) {
  // Memoize column definitions to prevent re-renders
  const columns = useMemo<ColumnDef<CsiSpecItem>[]>(
    () => [
      {
        accessorKey: 'csi_number',
        header: 'CSI Code',
        cell: (info) => (
          <div className="px-3 py-2 font-mono text-sm text-slate-700 dark:text-slate-300">
            {info.getValue() as string}
          </div>
        ),
        size: 120,
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: (info) => (
          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 truncate" title={info.getValue() as string}>
            {info.getValue() as string}
          </div>
        ),
      },
      {
        accessorKey: 'cost_code',
        header: 'Mapped Cost Code',
        cell: (info) => {
          const row = info.row.original;
          const isSuggested = (row as CsiSpecItem & { is_suggested?: boolean }).is_suggested;
          
          return (
            <div className="relative group w-full h-full">
              <SmartCostCodeCombobox
                value={info.getValue() as string | null}
                onChange={(updates) => {
                  setData((old) =>
                    old.map((item) =>
                      item.id === row.id
                        ? { ...item, cost_code: updates.cost_code, is_suggested: false }
                        : item
                    )
                  );
                }}
                rawCostCodes={costCodes}
                showCostTypeSegment={false} // Only need base code mapping for Specs
              />
              {/* Zero-JS Tooltip for Suggestions */}
              {isSuggested && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  <div className="absolute bottom-full right-0 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-[100]">
                    Suggested by ML Flywheel
                  </div>
                </div>
              )}
            </div>
          );
        },
        size: 250,
      },
      {
        id: 'actions',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-end px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setData(old => old.filter(item => item.id !== row.id))}
                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1.5 rounded-md transition-colors"
                title="Remove Spec"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        },
        size: 50,
      },
    ],
    [costCodes, setData]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 flex flex-col min-h-[300px] max-h-[600px]">
      <div className="overflow-auto flex-1 relative">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-[0_1px_0_var(--tw-shadow-color)] shadow-slate-200 dark:shadow-slate-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
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
            {table.getRowModel().rows.map((row) => (
              <MemoizedRow key={row.original.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Rule C10: Strict Row Memoization with visibleColumnIds structural hash
import { Row } from '@tanstack/react-table';

const MemoizedRow = React.memo(
  function MemoizedRow({ row }: { row: Row<CsiSpecItem> }) {
    return (
      <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
        {row.getVisibleCells().map((cell) => (
          <td
            key={cell.id}
            className="border-r border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-800/50 last:border-r-0 relative"
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  },
  (prev, next) => {
    // Structural share comparison
    const prevVisible = prev.row.getVisibleCells().map((c) => c.column.id).join(',');
    const nextVisible = next.row.getVisibleCells().map((c) => c.column.id).join(',');
    return prev.row.original === next.row.original && prevVisible === nextVisible;
  }
);
