import { LessonStatus, LessonSeverity } from '@/types/models';

// Shared badge styling for read-only lesson views (client profile + dashboard).
// Mirrors the inline styling in LessonColumns.tsx (project-level editable table).

export function statusBadgeClass(status: LessonStatus): string {
  if (status === 'Verified') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
  if (status === 'Submitted') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
}

export function severityBadgeClass(severity: LessonSeverity): string {
  if (severity === 'Critical') return 'text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400';
  if (severity === 'High') return 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
  if (severity === 'Medium') return 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
  if (severity === 'Low') return 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
  return 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
}
