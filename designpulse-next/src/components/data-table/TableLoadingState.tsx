'use client';

/**
 * Shared loading state for DataTable grids.
 * Adopted from Permit Board's spinner pattern — the only table with a proper loading state.
 */

export interface TableLoadingStateProps {
  message?: string;
}

export function TableLoadingState({ message = 'Loading...' }: TableLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
