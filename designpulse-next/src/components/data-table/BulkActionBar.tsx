'use client';

import React from 'react';
import { Trash2, X } from 'lucide-react';

/**
 * Shared bulk action bar for DataTable grids.
 * Extracted from the identical sticky bottom bar (~60 lines × 3).
 *
 * Renders as a sticky bottom bar with selection count, delete button,
 * clear button, and an extra actions slot for domain-specific buttons
 * (e.g., "Compare Options" in Value Matrix).
 */

export interface BulkActionBarProps {
  selectedCount: number;
  /** Entity label displayed (e.g., "Items", "Tasks", "Permits") */
  entityLabel: string;
  onClear: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  /** Additional action buttons (e.g., Compare Options for Value Matrix) */
  extraActions?: React.ReactNode;
}

export function BulkActionBar({
  selectedCount,
  entityLabel,
  onClear,
  onDelete,
  canDelete = true,
  extraActions,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="dt-bulk-action-bar">
      {/* Selection count badge */}
      <div className="flex items-center gap-2">
        <span className="bg-sky-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {selectedCount}
        </span>
        <span className="text-sm font-medium">
          {entityLabel} Selected
        </span>
      </div>

      <div className="flex-1" />

      {/* Extra actions slot */}
      {extraActions}

      {/* Delete button */}
      {canDelete && onDelete && (
        <button
          onClick={onDelete}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium
                     bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          Delete ({selectedCount})
        </button>
      )}

      {/* Clear selection */}
      <button
        onClick={onClear}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium
                   text-slate-300 hover:text-white transition-colors"
      >
        <X size={14} />
        Clear
      </button>
    </div>
  );
}
