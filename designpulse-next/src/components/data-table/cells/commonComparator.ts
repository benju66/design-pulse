'use client';

import { useUIStore } from '@/stores/useUIStore';

/**
 * Shared cell memo comparator for all DataTable cell components.
 * Replaces the two separate implementations:
 *   - `commonComparator` in EditableCell.tsx (typed to Opportunity)
 *   - `commonCellComparator` in PermitTable.tsx (typed to Permit)
 *
 * Usage: `React.memo(MyCell, (prev, next) => commonCellComparator(prev, next))`
 */
export function commonCellComparator<TData>(
  prevProps: { getValue: () => unknown; row: { original: TData } },
  nextProps: { getValue: () => unknown; row: { original: TData } }
): boolean {
  if (prevProps.getValue() !== nextProps.getValue()) return false;
  if (prevProps.row.original !== nextProps.row.original) return false;
  return true;
}

/**
 * Helper to check if a specific cell is the active cell in a given table scope.
 * Centralizes the `activeCell?.rowIndex === row.index && activeCell?.columnId === column.id` check
 * used in CellWrapper, StatusCell, and all select-type cells.
 */
export function useIsCellActive(rowIndex: number, columnId: string): boolean {
  return useUIStore(
    (state) =>
      state.activeCell?.rowIndex === rowIndex &&
      state.activeCell?.columnId === columnId
  );
}
