'use client';

import { memo } from 'react';
import { Row, flexRender } from '@tanstack/react-table';

/**
 * Generic MemoizedRow — renders a single <tr> with proper memo comparison.
 *
 * Extracted from the identical row memoization pattern in all three tables.
 * Uses `row.original` identity + optional `getIsSelected()` for memo comparison,
 * matching the permitComparator pattern from PermitTable.tsx.
 */

export interface MemoizedRowProps<TData> {
  row: Row<TData>;
  /** Whether this row is currently selected (for checkbox highlight) */
  isSelected?: boolean;
  /** Optional additional class for the <tr> */
  className?: string;
  /** Callback when the row is clicked */
  onClick?: (row: Row<TData>) => void;
  /** Virtual row index for positioning (when using @tanstack/react-virtual) */
  virtualRowIndex?: number;
}

function MemoizedRowInner<TData>({
  row,
  isSelected = false,
  className = '',
  onClick,
}: MemoizedRowProps<TData>) {
  return (
    <tr
      className={`border-b border-slate-200 dark:border-slate-800 transition-colors
                  hover:bg-slate-50 dark:hover:bg-slate-800/50
                  ${isSelected ? 'dt-row-selected' : ''}
                  ${className}`}
      onClick={() => onClick?.(row)}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className="dt-cell-base"
          style={{ width: cell.column.getSize() }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

/**
 * Default memo comparator — checks row.original identity and selection state.
 * Matches the permitComparator pattern from PermitTable.tsx.
 */
function defaultRowComparator<TData>(
  prev: MemoizedRowProps<TData>,
  next: MemoizedRowProps<TData>
): boolean {
  if (prev.row.original !== next.row.original) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.className !== next.className) return false;
  return true;
}

export const MemoizedRow = memo(MemoizedRowInner, defaultRowComparator) as typeof MemoizedRowInner;
