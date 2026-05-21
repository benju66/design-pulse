'use client';

import { CellContext, Table } from '@tanstack/react-table';
import { Check, Minus } from 'lucide-react';

/**
 * Generic CheckboxCell — standardizes on TanStack native `rowSelection`.
 *
 * Uses a custom visual checkbox (button + Lucide icon) instead of native
 * `<input type="checkbox">` to avoid Tailwind v4 preflight/utility conflicts
 * that strip native checkbox appearance without replacement styling.
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

  const isSelected = row.getIsSelected();

  return (
    <div className="flex items-center justify-center py-2 px-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        disabled={disabled}
        onClick={row.getToggleSelectedHandler()}
        className={`
          w-4 h-4 rounded flex items-center justify-center flex-shrink-0
          border transition-colors duration-100 cursor-pointer
          focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-1
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isSelected
            ? 'bg-sky-600 border-sky-600 text-white'
            : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
          }
        `}
      >
        {isSelected && <Check size={12} strokeWidth={3} />}
      </button>
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
  const isAllSelected = table.getIsAllPageRowsSelected();
  const isSomeSelected = table.getIsSomePageRowsSelected();

  return (
    <div className="w-full h-full flex items-center justify-center px-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={isAllSelected ? true : isSomeSelected ? 'mixed' : false}
        disabled={disabled}
        onClick={table.getToggleAllPageRowsSelectedHandler()}
        className={`
          w-4 h-4 rounded flex items-center justify-center flex-shrink-0
          border transition-colors duration-100 cursor-pointer
          focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-1
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isAllSelected || isSomeSelected
            ? 'bg-sky-600 border-sky-600 text-white'
            : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
          }
        `}
      >
        {isAllSelected && <Check size={12} strokeWidth={3} />}
        {!isAllSelected && isSomeSelected && <Minus size={12} strokeWidth={3} />}
      </button>
    </div>
  );
}
