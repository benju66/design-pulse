import { ColumnDef } from '@tanstack/react-table';
import { ProjectLesson } from '@/types/models';
import { format } from 'date-fns';

export const lessonColumns: ColumnDef<ProjectLesson>[] = [
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
    size: 250,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      let colorClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      
      if (status === 'Verified') colorClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
      else if (status === 'Submitted') colorClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
      else if (status === 'Draft') colorClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
      
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
          {status}
        </span>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => {
      const severity = row.original.severity;
      let colorClass = 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
      
      if (severity === 'Critical') colorClass = 'text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400';
      if (severity === 'High') colorClass = 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
      if (severity === 'Medium') colorClass = 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      if (severity === 'Low') colorClass = 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
          {severity}
        </span>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {row.original.category}
      </span>
    ),
    size: 120,
  },
  {
    accessorKey: 'cost_code',
    header: 'Cost Code',
    cell: ({ row }) => {
      const { meta } = row.getAllCells()[0].getContext().table.options;
      const costCodeStr = row.original.cost_code;
      if (!costCodeStr) return <span className="text-slate-400 dark:text-slate-600">—</span>;
      
      // Attempt to resolve cost code description
      const resolved = meta?.rawCostCodes?.find(c => c.code === costCodeStr);
      
      return (
        <div className="flex flex-col">
          <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{costCodeStr}</span>
          {resolved && (
            <span className="text-[10px] text-slate-500 truncate">{resolved.description}</span>
          )}
        </div>
      );
    },
    size: 150,
  },
  {
    accessorKey: 'phase',
    header: 'Phase',
    cell: ({ row }) => (
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {row.original.phase}
      </span>
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
  }
];
