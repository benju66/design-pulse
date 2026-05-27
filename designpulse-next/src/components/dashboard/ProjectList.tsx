import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';
import { Project } from '@/types/models';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';

interface ProjectListProps {
  projects: Project[];
  isSuperAdmin?: boolean;
  onOpenCreateProject?: () => void;
}

const columnHelper = createColumnHelper<Project>();

export default function ProjectList({ projects, isSuperAdmin, onOpenCreateProject }: ProjectListProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true }
  ]);

  const columns = useMemo(() => [
    columnHelper.accessor('id', {
      header: '',
      id: 'icon',
      cell: () => (
        <div className="bg-sky-100 dark:bg-sky-900/30 p-2.5 rounded-xl w-fit text-sky-600 dark:text-sky-400">
          <Building2 size={20} strokeWidth={1.5} />
        </div>
      ),
      enableSorting: false,
      size: 60,
    }),
    columnHelper.accessor(row => row.project_settings?.[0]?.project_name || row.name, {
      id: 'name',
      header: 'Project Name',
      cell: info => (
        <Link href={`/project/${info.row.original.id}`} className="font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('project_number', {
      header: 'Project Number',
      cell: info => info.getValue() ? (
        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
          {info.getValue()}
        </span>
      ) : <span className="text-slate-400 italic text-sm">Not set</span>,
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: info => (
        <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[400px]">
          {info.getValue() || <span className="italic text-slate-400">No description</span>}
        </div>
      ),
    }),
    columnHelper.accessor('created_at', {
      header: 'Created Date',
      cell: info => <span className="text-sm text-slate-500">{new Date(info.getValue()).toLocaleDateString()}</span>,
    }),
    columnHelper.display({
      id: 'action',
      header: '',
      cell: info => (
        <div className="flex justify-end pr-4">
          <Link href={`/project/${info.row.original.id}`} className="group relative">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all">
              <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            {/* Zero-JS Tooltip */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
              Open Project
            </div>
          </Link>
        </div>
      ),
      size: 80,
    })
  ], []);

  const table = useReactTable({
    data: projects,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (projects.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/50">
        <Building2 size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 mb-4 text-lg">No projects found.</p>
        {isSuperAdmin && onOpenCreateProject && (
          <button 
            onClick={onOpenCreateProject} 
            className="text-sky-500 font-bold hover:underline"
          >
            Spin up your first sandbox project
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm pb-8">
      <div className="overflow-x-auto">
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
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
