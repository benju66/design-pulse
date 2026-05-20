'use client';

import React, { useRef, useEffect } from 'react';
import { Row, Column } from '@tanstack/react-table';
import { useUIStore } from '@/stores/useUIStore';

/**
 * Generic CellWrapper — handles navigate/edit mode toggling for editable cells.
 *
 * Extracted from `EditableCell.tsx` CellWrapper (lines 16-71).
 * The original is typed to `Opportunity` but only uses generic `row.index` and `column.id`.
 *
 * Behavior preserved exactly:
 * - Click → sets activeCell + navigate mode
 * - Double-click → sets edit mode (unless disabled)
 * - Active navigate → ring-2 ring-sky-400 highlight
 * - Auto-focus div on navigate activation (with setTimeout(0))
 * - Disabled cells bounce back from edit to navigate
 */

export interface CellWrapperProps<TData> {
  row: Row<TData>;
  column: Column<TData, unknown>;
  /** What to display when not editing */
  displayValue: React.ReactNode;
  /** Render prop for the editing UI. Receives whether cell is active and a function to set grid mode. */
  inputElement: (
    isActive: boolean,
    setGridMode: (mode: 'navigate' | 'edit') => void
  ) => React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function CellWrapper<TData>({
  row,
  column,
  displayValue,
  inputElement,
  className = '',
  disabled = false,
}: CellWrapperProps<TData>) {
  const divRef = useRef<HTMLDivElement>(null);

  const isCellActive = useUIStore(
    (state) =>
      state.activeCell?.rowIndex === row.index &&
      state.activeCell?.columnId === column.id
  );
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const gridMode = useUIStore((state) => state.gridMode);
  const setGridMode = useUIStore((state) => state.setGridMode);

  const isEditing = isCellActive && gridMode === 'edit' && !disabled;

  // Bounce-back: if active + edit mode + disabled, revert to navigate
  useEffect(() => {
    if (isCellActive && gridMode === 'edit' && disabled) {
      setGridMode('navigate');
    }
  }, [isCellActive, gridMode, disabled, setGridMode]);

  // Auto-focus the div when navigating to this cell
  useEffect(() => {
    if (isCellActive && gridMode === 'navigate') {
      setTimeout(() => divRef.current?.focus(), 0);
    }
  }, [isCellActive, gridMode]);

  return (
    <div
      ref={divRef}
      tabIndex={-1}
      className={`h-full w-full px-2 py-1.5 text-sm cursor-default outline-none ${
        isCellActive && gridMode === 'navigate'
          ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20'
          : ''
      } ${className}`}
      onClick={() => {
        setActiveCell({ rowIndex: row.index, columnId: column.id });
        setGridMode('navigate');
      }}
      onDoubleClick={() => {
        if (!disabled) {
          setActiveCell({ rowIndex: row.index, columnId: column.id });
          setGridMode('edit');
        }
      }}
    >
      {isEditing
        ? inputElement(isCellActive, setGridMode)
        : displayValue}
    </div>
  );
}
