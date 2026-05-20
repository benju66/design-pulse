'use client';

import { CellContext } from '@tanstack/react-table';
import { PanelRight } from 'lucide-react';

/**
 * Generic OpenPanelCell — toggles a detail/split panel for a row.
 *
 * Eliminates 2 duplicate implementations:
 *   - CoordinationTable (lines 158-185) — uses setCoordinationViewMode
 *   - PermitTable (lines 433-456) — uses setPermitViewMode
 *
 * Consumer provides `onToggle` which handles view mode setting and
 * selectedOpportunityId updates. This component is purely presentational.
 */

export interface OpenPanelCellProps<TData> {
  info: CellContext<TData, unknown>;
  /** Called when the panel icon is clicked. Receives the row ID and current selection state. */
  onToggle: (id: string, isCurrentlySelected: boolean) => void;
  /** Whether this row's panel is currently open */
  isSelected: boolean;
  /** Accent color for the active state */
  activeColor?: string;
}

export function OpenPanelCell<TData>({
  info,
  onToggle,
  isSelected,
  activeColor = 'text-sky-500',
}: OpenPanelCellProps<TData>) {
  const id = (info.row.original as Record<string, unknown>).id as string;

  return (
    <div className="flex items-center justify-center h-full">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id, isSelected);
        }}
        className={`p-1 rounded transition-colors ${
          isSelected
            ? `${activeColor} bg-sky-50 dark:bg-sky-900/30`
            : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
        }`}
        title={isSelected ? 'Close panel' : 'Open panel'}
      >
        <PanelRight size={16} />
      </button>
    </div>
  );
}
