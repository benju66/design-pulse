"use client";
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, ExternalLink, PanelRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { ClientLesson } from '@/types/models';
import { ClientLessonDetailPanel } from './ClientLessonDetailPanel';
import { statusBadgeClass, severityBadgeClass } from '../lessons/lessonBadges';

interface ClientLessonsTabProps {
  lessons: ClientLesson[];
  isLoading: boolean;
}

const baseColumns: ColumnDef<ClientLesson>[] = [
  {
    accessorKey: 'project_name',
    header: 'Project',
    cell: ({ row }) => (
      <Link
        href={`/project/${row.original.project_id}`}
        className="group inline-flex items-center gap-1 font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate">{row.original.project_name}</span>
        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </Link>
    ),
    size: 200,
  },
  {
    accessorKey: 'display_id',
    header: 'ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
        {row.original.display_id || '---'}
      </span>
    ),
    size: 80,
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <span className="font-medium text-slate-800 dark:text-slate-200">
        {row.original.title}
      </span>
    ),
    size: 260,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <span className="text-sm text-slate-600 dark:text-slate-400">{row.original.category}</span>
    ),
    size: 120,
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadgeClass(row.original.severity)}`}>
        {row.original.severity}
      </span>
    ),
    size: 100,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(row.original.status)}`}>
        {row.original.status}
      </span>
    ),
    size: 100,
  },
  {
    accessorKey: 'phase',
    header: 'Phase',
    cell: ({ row }) => (
      <span className="text-sm text-slate-600 dark:text-slate-400">{row.original.phase}</span>
    ),
    size: 140,
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {format(new Date(row.original.created_at), 'MMM d, yyyy')}
      </span>
    ),
    size: 100,
  },
];

export function ClientLessonsTab({ lessons, isLoading }: ClientLessonsTabProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Append the "open details" affordance column; it closes over the selection state.
  const columns = useMemo<ColumnDef<ClientLesson>[]>(() => [
    ...baseColumns,
    {
      id: 'open',
      header: '',
      size: 44,
      cell: ({ row }) => {
        const active = row.original.id === selectedLessonId;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedLessonId(active ? null : row.original.id); }}
            className={`p-1.5 rounded-md transition-colors ${
              active
                ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/30'
                : 'text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30'
            }`}
            title="Open details"
          >
            <PanelRight size={16} />
          </button>
        );
      },
    },
  ], [selectedLessonId]);

  const table = useReactTable({
    data: lessons,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedLesson = useMemo(
    () => lessons.find(l => l.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId]
  );

  const verifiedCount = useMemo(
    () => lessons.filter(l => l.status === 'Verified').length,
    [lessons]
  );

  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <Lightbulb size={24} className="text-amber-500" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">No Lessons Learned Yet</p>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Lessons recorded on this client&apos;s projects will roll up here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="animate-in fade-in space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {lessons.length} Lesson{lessons.length !== 1 ? 's' : ''} Across Projects
            </h3>
            <div className="text-xs text-slate-500 tabular-nums">
              {verifiedCount} Verified
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="p-3 select-none" style={{ width: header.column.getSize() }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-700/50">
              {table.getRowModel().rows.map(row => {
                const isSelected = row.original.id === selectedLessonId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedLessonId(isSelected ? null : row.original.id)}
                    className={`group transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="p-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ClientLessonDetailPanel lesson={selectedLesson} onClose={() => setSelectedLessonId(null)} />
    </>
  );
}
