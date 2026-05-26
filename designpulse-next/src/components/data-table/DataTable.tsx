'use client';

import { useRef, type ReactNode } from 'react';
import { Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableHeader } from './TableHeader';
import { MemoizedRow } from './MemoizedRow';
import { TableEmptyState } from './TableEmptyState';

/**
 * DataTable — Core composable table wrapper.
 *
 * This is NOT a monolithic "everything" component. It provides the shared
 * structural rendering (scrollable container, virtualized rows, header, empty state)
 * while allowing consumers to compose their own toolbars, bulk action bars,
 * ghost rows, and filter drawers around it.
 *
 * Usage:
 *   <TableToolbar ... />
 *   <DataTable table={table}>
 *     {(row) => <MemoizedRow row={row} isSelected={row.getIsSelected()} />}
 *   </DataTable>
 *   <BulkActionBar ... />
 */

export interface DataTableProps<TData> {
  table: Table<TData>;
  /** Optional container element ID for focus targeting */
  id?: string;
  /** Estimated row height for virtualizer (default: 40) */
  estimateSize?: number;
  /** Maximum height of the scrollable area */
  maxHeight?: string;
  /** Enable column resizing handles */
  enableResize?: boolean;
  /** Custom row renderer — receives the row, return a <tr>. If not provided, uses MemoizedRow. */
  children?: (row: import('@tanstack/react-table').Row<TData>, virtualRowIndex: number) => ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Content to render after the body rows (e.g., GhostRow) */
  footerContent?: ReactNode;
  /** Additional keyboard handler for the container */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Container className override */
  className?: string;
}

export function DataTable<TData>({
  table,
  id,
  estimateSize = 40,
  maxHeight = 'calc(100vh - 280px)',
  enableResize = true,
  children,
  emptyMessage = 'No items found.',
  footerContent,
  onKeyDown,
  className = '',
}: DataTableProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Padding for virtual scroll
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div
      ref={parentRef}
      id={id}
      className={`overflow-auto rounded-xl border border-slate-200 dark:border-slate-800
                  bg-white dark:bg-slate-900 ${className}`}
      style={{ maxHeight }}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        {/* Column widths */}
        <colgroup>
          {table.getVisibleLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>

        {/* Header */}
        <TableHeader
          headerGroups={table.getHeaderGroups()}
          enableResize={enableResize}
        />

        {/* Body */}
        <tbody>
          {/* Virtual top padding */}
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: paddingTop }} colSpan={columnCount} />
            </tr>
          )}

          {/* Rows */}
          {virtualRows.length > 0 ? (
            virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              if (children) {
                return children(row, virtualRow.index);
              }

              return (
                <MemoizedRow
                  key={row.id}
                  row={row}
                  isSelected={row.getIsSelected()}
                />
              );
            })
          ) : (
            <TableEmptyState colSpan={columnCount} message={emptyMessage} />
          )}

          {/* Virtual bottom padding */}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: paddingBottom }} colSpan={columnCount} />
            </tr>
          )}

          {/* Footer content (GhostRow, etc.) */}
          {footerContent}
        </tbody>
      </table>
    </div>
  );
}
