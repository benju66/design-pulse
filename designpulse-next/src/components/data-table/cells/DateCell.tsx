'use client';

import { useRef, memo, useEffect } from 'react';
import { CellContext } from '@tanstack/react-table';
import { CellWrapper } from './CellWrapper';
import { toDateInputValue, formatDate } from '@/lib/formatters';
import { useUIStore } from '@/stores/useUIStore';

/**
 * Generic DateCell — date picker with inline editing.
 *
 * Extracted from PermitTable.tsx PermitDateCell (lines 152-238).
 * Uses CellWrapper for consistent navigate/edit toggling.
 */

export interface DateCellProps<TData> extends CellContext<TData, unknown> {
  /** Field-level lock check */
  isLocked?: (row: TData) => boolean;
}

function DateCellInner<TData>({
  row,
  column,
  table,
  getValue,
  isLocked,
}: DateCellProps<TData>) {
  const currentValue = getValue() as string | null | undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  const isApproved =
    row.original &&
    typeof row.original === 'object' &&
    'status' in row.original &&
    (row.original as Record<string, unknown>).status === 'Approved';
  const locked = (isLocked?.(row.original) ?? false) || isApproved;

  const permissions = (table.options.meta as Record<string, unknown>)?.permissions as
    | { can_edit_records?: boolean }
    | undefined;
  const canEdit = permissions?.can_edit_records ?? false;
  const disabled = locked || !canEdit;

  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const gridMode = useUIStore(state => state.gridMode);
  const isEditing = isCellActive && gridMode === 'edit' && !disabled;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      try {
        inputRef.current.showPicker();
      } catch (err) {
        console.warn('showPicker not supported:', err);
      }
    }
  }, [isEditing]);

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
            onClick={(e) => {
              try {
                (e.target as HTMLInputElement).showPicker();
              } catch (err) {
                console.warn('showPicker on click failed:', err);
              }
            }}
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
            className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 px-2 py-1 text-sm text-slate-900 dark:text-slate-100 dark:bg-slate-800 rounded"
          />
        );
      }}
    />
  );
}

export const DateCell = memo(DateCellInner) as typeof DateCellInner;
