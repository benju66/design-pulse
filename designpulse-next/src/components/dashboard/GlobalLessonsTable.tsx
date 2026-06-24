"use client";
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, ExternalLink, PanelRight, Search } from 'lucide-react';
import { format } from 'date-fns';
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { DashboardLesson } from '@/types/models';
import { ClientLessonDetailPanel } from '@/components/clients/ClientLessonDetailPanel';
import { statusBadgeClass, severityBadgeClass } from '@/components/lessons/lessonBadges';

interface GlobalLessonsTableProps {
  lessons: DashboardLesson[];
  isLoading: boolean;
}

const NO_CLIENT = '__none__';

const baseColumns: ColumnDef<DashboardLesson>[] = [
  {
    accessorKey: 'client_name',
    header: 'Client',
    cell: ({ row }) => {
      const { client_id, client_name } = row.original;
      if (!client_name) return <span className="text-slate-400 dark:text-slate-600">—</span>;
      return client_id ? (
        <Link
          href={`/clients/${client_id}`}
          className="group inline-flex items-center gap-1 font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">{client_name}</span>
          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </Link>
      ) : (
        <span className="text-slate-600 dark:text-slate-300">{client_name}</span>
      );
    },
    size: 170,
  },
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
    size: 180,
  },
  {
    accessorKey: 'display_id',
    header: 'ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.original.display_id || '---'}</span>
    ),
    size: 80,
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <span className="font-medium text-slate-800 dark:text-slate-200">{row.original.title}</span>
    ),
    size: 240,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => <span className="text-sm text-slate-600 dark:text-slate-400">{row.original.category}</span>,
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

const SELECT_CLASS =
  'px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-900 dark:text-white';

export default function GlobalLessonsTable({ lessons, isLoading }: GlobalLessonsTableProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Derive filter options from the data so we never show empty buckets.
  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasNone = false;
    lessons.forEach(l => {
      if (l.client_id && l.client_name) map.set(l.client_id, l.client_name);
      else hasNone = true;
    });
    const opts = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    return { opts, hasNone };
  }, [lessons]);

  const categoryOptions = useMemo(() => [...new Set(lessons.map(l => l.category))].sort(), [lessons]);
  const severityOptions = useMemo(() => [...new Set(lessons.map(l => l.severity))].sort(), [lessons]);
  const statusOptions = useMemo(() => [...new Set(lessons.map(l => l.status))].sort(), [lessons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lessons.filter(l => {
      if (clientFilter !== 'all') {
        if (clientFilter === NO_CLIENT ? !!l.client_id : l.client_id !== clientFilter) return false;
      }
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && l.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (q) {
        const haystack = `${l.title} ${l.display_id ?? ''} ${l.project_name} ${l.client_name ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [lessons, search, clientFilter, categoryFilter, severityFilter, statusFilter]);

  const columns = useMemo<ColumnDef<DashboardLesson>[]>(() => [
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
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedLesson = useMemo(
    () => lessons.find(l => l.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <Lightbulb size={24} className="text-amber-500" />
        </div>
        <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">No Lessons Learned Yet</p>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Lessons recorded on your projects will appear here across your whole portfolio.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filter toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, ID, project, client…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-900 dark:text-white"
            />
          </div>

          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className={SELECT_CLASS}>
            <option value="all">All clients</option>
            {clientOptions.opts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            {clientOptions.hasNone && <option value={NO_CLIENT}>No client</option>}
          </select>

          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={SELECT_CLASS}>
            <option value="all">All categories</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className={SELECT_CLASS}>
            <option value="all">All severities</option>
            {severityOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={SELECT_CLASS}>
            <option value="all">All statuses</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {filtered.length} of {lessons.length} Lesson{lessons.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-sm text-slate-400">
                  No lessons match these filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => {
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
              })
            )}
          </tbody>
        </table>
      </div>

      <ClientLessonDetailPanel lesson={selectedLesson} onClose={() => setSelectedLessonId(null)} />
    </>
  );
}
