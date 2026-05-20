'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CellContext } from '@tanstack/react-table';
import { useUIStore } from '@/stores/useUIStore';
import { CellWrapper } from './CellWrapper';

/**
 * Generic TextCell — inline text editing with keyboard support.
 *
 * Extracted from EditableCell.tsx TextCell (lines 73-139) and
 * PermitTable.tsx PermitTextCell (lines 60-149), merging the best of both:
 * - CellWrapper composition (from Opportunities)
 * - isSubmitting ref guard (from Opportunities)
 * - Empty value display with dash (from Permits)
 *
 * Keyboard contract:
 * - Enter → commit + move down
 * - Tab → commit + move right
 * - Shift+Tab → commit + move left
 * - Escape → revert + navigate
 */

export interface TextCellProps<TData> {
  info: CellContext<TData, unknown>;
  /** Field-level lock check — replaces hardcoded Opportunity.status === 'Approved' */
  isLocked?: (row: TData) => boolean;
  /** Custom display formatter */
  formatDisplay?: (value: unknown) => string;
  /** Placeholder for empty values */
  emptyPlaceholder?: React.ReactNode;
}

function TextCellInner<TData>({ info, isLocked, formatDisplay, emptyPlaceholder }: TextCellProps<TData>) {
  const { row, column, table, getValue } = info;
  const initialValue = (getValue() as string) ?? '';
  const [editValue, setEditValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);

  const locked = isLocked?.(row.original) ?? false;
  const permissions = (table.options.meta as Record<string, unknown>)?.permissions as
    | { can_edit_records?: boolean }
    | undefined;
  const canEdit = permissions?.can_edit_records ?? false;
  const disabled = locked || !canEdit;

  // Sync local state when external value changes
  useEffect(() => {
    setEditValue((getValue() as string) ?? '');
  }, [getValue]);

  const commitValue = () => {
    if (isSubmitting.current) return;
    const trimmed = editValue.trim();
    if (trimmed !== initialValue) {
      isSubmitting.current = true;
      const updateMutation = table.options.meta?.updateData;
      if (updateMutation) {
        updateMutation.mutate(
          { id: (row.original as Record<string, unknown>).id as string, updates: { [column.id]: trimmed } },
          { onSettled: () => { isSubmitting.current = false; } }
        );
      } else {
        isSubmitting.current = false;
      }
    }
  };

  const moveActiveCell = table.options.meta?.moveActiveCellRef?.current;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const setGridMode = useUIStore.getState().setGridMode;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      setGridMode('navigate');
      moveActiveCell?.('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitValue();
      setGridMode('navigate');
      moveActiveCell?.(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(initialValue);
      setGridMode('navigate');
    }
  };

  const displayContent = formatDisplay
    ? formatDisplay(initialValue)
    : initialValue;

  const defaultEmpty = emptyPlaceholder ?? (
    <span className="text-slate-300 dark:text-slate-600 italic">--</span>
  );

  return (
    <CellWrapper
      row={row}
      column={column}
      disabled={disabled}
      displayValue={
        <span className="block truncate">
          {displayContent || defaultEmpty}
        </span>
      }
      inputElement={(isActive, setGridMode) => {
        if (!isActive) return null;
        return (
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              commitValue();
              setGridMode('navigate');
            }}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent outline-none text-sm"
          />
        );
      }}
    />
  );
}

export const TextCell = React.memo(TextCellInner) as typeof TextCellInner;
