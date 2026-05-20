/**
 * DataTable Component System
 *
 * A unified, composable table architecture extracted from the
 * Value Matrix, Coordination Board, and Permit Board tables.
 *
 * Usage:
 *   import { DataTable, TableToolbar, BulkActionBar } from '@/components/data-table';
 *   import { TextCell, SelectCell, CheckboxCell } from '@/components/data-table/cells';
 */

// Core table components
export { DataTable } from './DataTable';
export type { DataTableProps } from './DataTable';

export { TableHeader } from './TableHeader';
export type { TableHeaderProps } from './TableHeader';

export { MemoizedRow } from './MemoizedRow';
export type { MemoizedRowProps } from './MemoizedRow';

export { GhostRow } from './GhostRow';
export type { GhostRowProps, GhostRowField } from './GhostRow';

// UI components
export { BulkActionBar } from './BulkActionBar';
export type { BulkActionBarProps } from './BulkActionBar';

export { DeleteConfirmModal } from './DeleteConfirmModal';
export type { DeleteConfirmModalProps } from './DeleteConfirmModal';

export { TableToolbar } from './TableToolbar';
export type { TableToolbarProps } from './TableToolbar';

export { TableEmptyState } from './TableEmptyState';
export type { TableEmptyStateProps } from './TableEmptyState';

export { TableLoadingState } from './TableLoadingState';
export type { TableLoadingStateProps } from './TableLoadingState';
