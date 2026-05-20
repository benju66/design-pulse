'use client';

import { useRef, memo } from 'react';
import { CellContext } from '@tanstack/react-table';
import { CellWrapper } from './CellWrapper';
import { toDateInputValue, formatDate } from '@/lib/formatters';

/**
 * Generic DateCell — date picker with inline editing.
 *
 * Extracted from PermitTable.tsx PermitDateCell (lines 152-238).
 * Uses CellWrapper for consistent navigate/edit toggling.
 */

export interface DateCellProps<TData> {
  info: CellContext<TData, unknown>;
  /** Field-level lock check */
  isLocked?: (row: TData) => boolean;
}

function DateCellInner<TData>({ info, isLocked }: DateCellProps<TData>) {
  const { row, column, table, getValue } = info;
  const currentValue = getValue() as string | null | undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  const locked = isLocked?.(row.original) ?? false;
  const permissions = (table.options.meta as Record<string, unknown>)?.permissions as
    | { can_edit_records?: boolean }
    | undefined;
  const canEdit = permissions?.can_edit_records ?? false;
  const disabled = locked || !canEdit;

  const commitValue = (dateStr: string) => {
    const updateMutation = table.options.meta?.updateData;
    updateMutation?.mutate({
      id: (row.original as Record<string, unknown>).id as string,
      updates: { [column.id]: dateStr || null },
    });
  };

  return (
    <CellWrapper
      row={row}
      column={column}
      disabled={disabled}
      displayValue={
        <span className="block truncate">
          {currentValue ? (
            formatDate(currentValue)
          ) : (
            <span className="text-slate-300 dark:text-slate-600 italic">--</span>
          )}
        </span>
      }
      inputElement={(isActive, setGridMode) => {
        if (!isActive) return null;
        return (
          <input
            ref={inputRef}
            autoFocus
            type="date"
            defaultValue={toDateInputValue(currentValue)}
            onBlur={(e) => {
              commitValue(e.target.value);
              setGridMode('navigate');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setGridMode('navigate');
              } else if (e.key === 'Enter') {
                e.preventDefault();
                commitValue((e.target as HTMLInputElement).value);
                setGridMode('navigate');
                table.options.meta?.moveActiveCellRef?.current?.('down');
              }
            }}
            className="w-full h-full bg-transparent text-sm outline-none"
          />
        );
      }}
    />
  );
}

export const DateCell = memo(DateCellInner) as typeof DateCellInner;
