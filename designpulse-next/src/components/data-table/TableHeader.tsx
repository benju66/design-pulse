'use client';

import { flexRender, HeaderGroup } from '@tanstack/react-table';

/**
 * Shared TableHeader — renders the <thead> section with sort indicators and resize handles.
 *
 * Extracted from the identical header rendering in all three tables.
 * Uses the standardized dt-* CSS classes.
 */

export interface TableHeaderProps<TData> {
  headerGroups: HeaderGroup<TData>[];
  /** Enable column resize handle rendering */
  enableResize?: boolean;
}

export function TableHeader<TData>({
  headerGroups,
  enableResize = true,
}: TableHeaderProps<TData>) {
  return (
    <thead>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id} className="dt-header-row">
          {headerGroup.headers.map((header) => {
            const isPinned = header.column.getIsPinned() === 'left';
            const isLastPinned = isPinned && header.column.getIsLastColumn('left');
            return (
              <th
                key={header.id}
                className={`dt-header-cell group relative ${
                  header.column.getCanSort() ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800' : ''
                } ${isPinned ? 'sticky z-30 bg-slate-100 dark:bg-slate-900 bg-clip-padding' : ''} ${
                  isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)] border-r-2 border-slate-200 dark:border-slate-700' : ''
                }`}
                style={{ 
                  width: header.getSize(),
                  ...(isPinned ? { left: header.column.getStart('left') } : {})
                }}
                onClick={header.column.getToggleSortingHandler()}
                colSpan={header.colSpan}
              >
                <div className="flex items-center gap-1">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}

                  {/* Sort indicator */}
                  {header.column.getIsSorted() === 'asc' && (
                    <span className="text-sky-500 text-[10px]">▲</span>
                  )}
                  {header.column.getIsSorted() === 'desc' && (
                    <span className="text-sky-500 text-[10px]">▼</span>
                  )}
                </div>

                {/* Resize handle */}
                {enableResize && header.column.getCanResize() && (
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`dt-resize-handle ${
                      header.column.getIsResizing() ? 'dt-resize-handle-active' : ''
                    }`}
                  />
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
