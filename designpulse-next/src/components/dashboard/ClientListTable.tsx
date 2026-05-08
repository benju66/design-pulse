import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, ArrowRight, Users } from 'lucide-react';
import { Client } from '@/types/models';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';

interface ClientListTableProps {
  clients: Client[];
}

const columnHelper = createColumnHelper<Client>();

export default function ClientListTable({ clients }: ClientListTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'name', desc: false }
  ]);

  const columns = useMemo(() => [
    columnHelper.accessor('id', {
      header: '',
      id: 'icon',
      cell: () => (
        <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl w-fit text-slate-600 dark:text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-500 transition-colors">
          <Briefcase size={20} strokeWidth={1.5} />
        </div>
      ),
      enableSorting: false,
      size: 60,
    }),
    columnHelper.accessor('name', {
      id: 'name',
      header: 'Client Name',
      cell: info => (
        <Link href={`/clients/${info.row.original.id}`} className="font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: info => (
        <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[500px]">
          {info.getValue() || <span className="italic text-slate-400">No description</span>}
        </div>
      ),
    }),
    columnHelper.accessor('primary_contact_name', {
      header: 'Primary Contact',
      cell: info => {
        const val = info.getValue();
        if (!val) return <span className="text-slate-400 italic text-sm">Not provided</span>;
        return (
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Users size={14} />
            <span>{val}</span>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'action',
      header: '',
      cell: info => (
        <div className="flex justify-end pr-4">
          <Link href={`/clients/${info.row.original.id}`} className="group relative">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all">
              <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            {/* Zero-JS Tooltip */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
              Open Client
            </div>
          </Link>
        </div>
      ),
      size: 80,
    })
  ], []);

  const table = useReactTable({
    data: clients,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm pb-8 relative">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500 opacity-80" />
      
      <div className="overflow-x-auto mt-1">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    className="py-3 px-4 text-sm font-semibold text-slate-600 dark:text-slate-400 select-none cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : 'auto' }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <div className="w-4 flex items-center justify-center">
                          {{
                            asc: <span className="text-sky-500">↑</span>,
                            desc: <span className="text-sky-500">↓</span>,
                          }[header.column.getIsSorted() as string] ?? (
                            <span className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group/row">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="py-3 px-4 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
