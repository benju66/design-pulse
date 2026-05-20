'use client';

import React, { useRef, useEffect } from 'react';
import { CellContext } from '@tanstack/react-table';
import { useUIStore } from '@/stores/useUIStore';

/**
 * Generic SelectCell — dropdown selection with inline editing.
 *
 * Unifies 6 near-identical implementations:
 *   - StatusCell (Opportunities)
 *   - CoordinationStatusCell (Opportunities)
 *   - PriorityCell (Opportunities)
 *   - BuildingAreaCell (Opportunities)
 *   - PermitStatusCell (Permits)
 *   - PermitDropdownCell (Permits)
 *
 * Pattern: All use raw <select>, useUIStore for activeCell/gridMode,
 * selectRef + auto-focus on activation, onChange → mutate + navigate.
 */

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface SelectCellProps<TData> {
  info: CellContext<TData, unknown>;
  options: SelectOption[];
  /** Field-level lock check */
  isLocked?: (row: TData) => boolean;
  /** Optional custom commit handler (e.g., Permit's updateStatusWithLog) */
  onCommit?: (row: TData, value: string) => void;
  /** Show colored pill or plain text when not active */
  variant?: 'pill' | 'text';
  /** Custom color map for pill variant */
  colorMap?: Record<string, string>;
}

function SelectCellInner<TData>({
  info,
  options,
  isLocked,
  onCommit,
  variant = 'text',
  colorMap,
}: SelectCellProps<TData>) {
  const { row, column, table, getValue } = info;
  const currentValue = (getValue() as string) ?? '';
  const selectRef = useRef<HTMLSelectElement>(null);

  const isCellActive = useUIStore(
    (state) =>
      state.activeCell?.rowIndex === row.index &&
      state.activeCell?.columnId === column.id
  );
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const setGridMode = useUIStore((state) => state.setGridMode);

  const locked = isLocked?.(row.original) ?? false;
  const permissions = (table.options.meta as Record<string, unknown>)?.permissions as
    | { can_edit_records?: boolean }
    | undefined;
  const canEdit = permissions?.can_edit_records ?? false;
  const disabled = locked || !canEdit;

  // Auto-focus select when cell becomes active
  useEffect(() => {
    if (isCellActive && !disabled) {
      setTimeout(() => selectRef.current?.focus(), 0);
    }
  }, [isCellActive, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (newValue === currentValue) {
      setGridMode('navigate');
      return;
    }

    if (onCommit) {
      onCommit(row.original, newValue);
    } else {
      const updateMutation = table.options.meta?.updateData;
      updateMutation?.mutate({
        id: (row.original as Record<string, unknown>).id as string,
        updates: { [column.id]: newValue },
      });
    }
    setGridMode('navigate');
  };

  // Display mode — pill or text
  if (!isCellActive || disabled) {
    const matchingOption = options.find((o) => o.value === currentValue);
    const displayLabel = matchingOption?.label ?? currentValue ?? '';

    const pillColor =
      colorMap?.[currentValue] ??
      matchingOption?.color ??
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

    return (
      <div
        className={`h-full w-full px-2 py-1.5 text-sm cursor-default ${
          disabled ? 'opacity-60' : ''
        }`}
        onClick={() => {
          if (!disabled) {
            setActiveCell({ rowIndex: row.index, columnId: column.id });
            setGridMode('navigate');
          }
        }}
      >
        {variant === 'pill' && displayLabel ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pillColor}`}
          >
            {displayLabel}
          </span>
        ) : (
          <span className="block truncate">
            {displayLabel || (
              <span className="text-slate-300 dark:text-slate-600 italic">--</span>
            )}
          </span>
        )}
      </div>
    );
  }

  // Edit mode — inline select
  return (
    <div className="h-full w-full px-1 py-0.5 ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20">
      <select
        ref={selectRef}
        value={currentValue}
        onChange={handleChange}
        onBlur={() => {
          setActiveCell(null);
          setGridMode('navigate');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setActiveCell(null);
            setGridMode('navigate');
          }
        }}
        className="w-full h-full bg-transparent text-sm outline-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export const SelectCell = React.memo(SelectCellInner) as typeof SelectCellInner;
