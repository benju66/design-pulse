'use client';

import { CellContext, Table } from '@tanstack/react-table';

/**
 * Generic CheckboxCell — standardizes on TanStack native `rowSelection`.
 *
 * Replaces:
 *   - columns.tsx CheckboxCell (Zustand compareQueue)
 *   - columns-v2.tsx CheckboxCell (Zustand compareQueue)
 *   - CoordinationTable CheckboxCell (Zustand compareQueue)
 *   - PermitTable PermitCheckboxCell (TanStack — reference implementation)
 *
 * ⚠️ IMPORTANT: When used with tables that have sub-rows (Value Matrix),
 * the table MUST be configured with:
 *   enableRowSelection: (row) => 'project_id' in row.original
 *   enableSubRowSelection: false
 * to prevent Option sub-rows from being selectable.
 */

export interface CheckboxCellProps<TData> {
  info: CellContext<TData, unknown>;
  disabled?: boolean;
}

export function CheckboxCell<TData>({ info, disabled }: CheckboxCellProps<TData>) {
  const { row } = info;

  // If row selection is disabled for this row, render nothing
  if (!row.getCanSelect()) return null;

  return (
    <div className="flex items-center justify-center py-2 px-1">
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        disabled={disabled}
        onChange={row.getToggleSelectedHandler()}
        className="w-4 h-4 rounded border-slate-300 text-sky-600
                   focus:ring-sky-500 cursor-pointer disabled:opacity-50
                   dark:border-slate-600 dark:bg-slate-800"
      />
    </div>
  );
}

/**
 * Header checkbox for select-all functionality.
 * Uses TanStack's built-in page-level selection.
 */
export interface CheckboxHeaderProps<TData> {
  table: Table<TData>;
  disabled?: boolean;
}

export function CheckboxHeader<TData>({ table, disabled }: CheckboxHeaderProps<TData>) {
  return (
    <div className="w-full h-full flex items-center justify-center px-1">
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        disabled={disabled}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="w-4 h-4 rounded border-slate-300 text-sky-600
                   focus:ring-sky-500 disabled:opacity-50
                   dark:border-slate-600 dark:bg-slate-800"
      />
    </div>
  );
}
