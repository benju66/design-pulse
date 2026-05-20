'use client';

import React from 'react';

/**
 * Shared empty state for DataTable grids.
 * Replaces 3 hardcoded empty state implementations with consistent dark mode support.
 *
 * Fixes:
 * - Hardcoded colSpan={15} in OpportunityGrid/V2 → uses dynamic colSpan prop
 * - Missing dark: variant on text-slate-500 → includes dark:text-slate-400
 */

export interface TableEmptyStateProps {
  colSpan: number;
  message?: string;
  icon?: React.ReactNode;
}

export function TableEmptyState({
  colSpan,
  message = 'No items found.',
  icon,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="dt-empty-state">
        {icon && <div className="mb-2 flex justify-center">{icon}</div>}
        <p className="text-sm">{message}</p>
      </td>
    </tr>
  );
}
