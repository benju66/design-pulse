"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ExpandedState,
  SortingState,
  VisibilityState,
  ColumnOrderState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useUpdateOpportunity, useCreateOpportunity, useAllProjectOptions, useProjectSettings } from '@/hooks/useProjectQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useUIStore } from '@/stores/useUIStore';

import { ExpandedCard } from './opportunities/ExpandedCard';
import { ColumnChooser } from './opportunities/ColumnChooser';
import { useOpportunityColumns } from './opportunities/columns';
import GhostRow from './opportunities/GhostRow';
import { Opportunity, OpportunityOption } from '@/types/models';

interface OpportunityGridProps {
  projectId: string;
  data: Opportunity[];
  viewMode?: string;
  onOpenCompare: () => void;
}

export default function OpportunityGrid({ projectId, data, viewMode = 'flat', onOpenCompare }: OpportunityGridProps) {
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const compareQueue = useUIStore(state => state.compareQueue);
  const clearCompareQueue = useUIStore(state => state.clearCompareQueue);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number | null, columnId: string | null }>({ rowIndex: null, columnId: null });

  const { data: rawCostCodes = [] } = useCostCodes();
  const { data: allOptions = [] } = useAllProjectOptions(projectId);
  const optionsMap = useMemo(() => {
    return allOptions.reduce((acc: Record<string, OpportunityOption[]>, option) => {
      if (!acc[option.opportunity_id]) {
        acc[option.opportunity_id] = [];
      }
      acc[option.opportunity_id].push(option);
      return acc;
    }, {});
  }, [allOptions]);

  useEffect(() => {
    if (selectedOpportunityId) {
      const element = document.getElementById(`row-${selectedOpportunityId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedOpportunityId]);

  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  
  const columnVisibility = useUIStore(state => state.gridColumnVisibility) as VisibilityState;
  const setColumnVisibility = useUIStore(state => state.setGridColumnVisibility);
  
  const columns = useOpportunityColumns(viewMode);
  const { data: settings } = useProjectSettings(projectId);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  useEffect(() => {
    if (settings?.ve_column_order && settings.ve_column_order.length > 0) {
      // Find the pinned columns that are not configurable and put them first
      const allColIds = columns.map(c => (c as any).accessorKey || c.id).filter(Boolean);
      const configuredIds = settings.ve_column_order;
      const pinnedIds = allColIds.filter(id => !configuredIds.includes(id as string));
      setColumnOrder([...pinnedIds, ...configuredIds] as string[]);
    }
  }, [settings?.ve_column_order, columns]);

  const table = useReactTable<Opportunity>({
    data,
    columns,
    state: { expanded, columnVisibility, columnOrder, sorting, globalFilter },
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    meta: {
      updateData: updateMutation,
      optionsMap,
      activeCell,
      setActiveCell,
      rawCostCodes,
    },
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44, // Base height
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative">
      <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-t-xl z-20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">Matrix View</span>
          <input 
            type="text"
            placeholder="Search items..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 w-64"
          />
        </div>
        <ColumnChooser table={table} />
      </div>

      <div 
        ref={tableContainerRef} 
        className="flex-1 overflow-auto rounded-b-xl outline-none"
        tabIndex={0}
        onKeyDown={(e) => {
          const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
          if (!keys.includes(e.key)) return;
          
          const state = useUIStore.getState();
          const gridMode = state.gridMode;
          
          if (e.key === 'Enter') {
            if (gridMode === 'navigate') {
               e.preventDefault();
               state.setGridMode('edit');
            }
            return;
          }

          if (gridMode === 'edit') return;

          if (activeCell.rowIndex === null || activeCell.columnId === null) return;

          e.preventDefault();

          const visibleCols = table.getVisibleLeafColumns().filter(c => 
            c.id !== 'select' && c.id !== 'open_panel' && c.id !== 'expander' && c.id !== 'options'
          );
          
          let { rowIndex, columnId } = activeCell;
          let colIndex = visibleCols.findIndex(c => c.id === columnId);
          if (colIndex === -1) colIndex = 0;

          if (e.key === 'ArrowUp') rowIndex = Math.max(0, rowIndex - 1);
          if (e.key === 'ArrowDown') rowIndex = Math.min(rows.length - 1, rowIndex + 1);
          if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
            if (colIndex > 0) colIndex -= 1;
            else if (rowIndex > 0) { rowIndex -= 1; colIndex = visibleCols.length - 1; }
          }
          if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
            if (colIndex < visibleCols.length - 1) colIndex += 1;
            else if (rowIndex < rows.length - 1) { rowIndex += 1; colIndex = 0; }
          }

          const newColumnId = visibleCols[colIndex]?.id;
          if (newColumnId) {
            virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
            setActiveCell({ rowIndex, columnId: newColumnId });
          }
        }}
      >
        <table 
          className="text-left text-sm whitespace-nowrap" 
          style={{ tableLayout: 'fixed', width: table.getTotalSize() }}
        >
          <thead className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th 
                  key={header.id} 
                  className="relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 select-none group bg-slate-100 dark:bg-slate-900"
                  style={{ width: header.getSize() }}
                >
                  <div 
                    className={`truncate flex items-center justify-between ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white' : ''}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                    {{
                      asc: <ChevronUp size={14} className="ml-1 inline-block shrink-0" />,
                      desc: <ChevronDown size={14} className="ml-1 inline-block shrink-0" />,
                    }[header.column.getIsSorted() as string] ?? null}
                  </div>
                  
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize user-select-none touch-none bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity ${
                        header.column.getIsResizing() ? 'opacity-100 bg-sky-600 w-2' : ''
                      }`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        
          {paddingTop > 0 && (
            <tbody>
              <tr>
                <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
              </tr>
            </tbody>
          )}
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            const isSelected = selectedOpportunityId === row.original.id;
            return (
              <tbody 
                key={row.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="border-b border-slate-100 dark:border-slate-800/50"
              >
                <tr 
                  id={`row-${row.original.id}`}
                  className={`transition-colors ${
                    isSelected 
                      ? 'bg-sky-50/50 dark:bg-sky-900/10 border-l-2 border-sky-500' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {viewMode === 'card' && row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-slate-100 dark:border-slate-800/50">
                      <ExpandedCard row={row as any} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
          {paddingBottom > 0 && (
            <tbody>
              <tr>
                <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
              </tr>
            </tbody>
          )}
          {data.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-slate-500">
                  No VE or Alternates logged yet. Start typing below to add one!
                </td>
              </tr>
            </tbody>
          )}

          {/* Ghost Row for Quick Add */}
          <tbody>
            <GhostRow table={table as any} createMutation={createMutation as any} />
          </tbody>
        </table>

      {compareQueue.length > 0 && (
        <div className="sticky bottom-0 w-full bg-slate-900 text-white p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 rounded-b-xl border-t border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-sky-500 text-white text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">
              {compareQueue.length}
            </div>
            <span className="font-medium text-sm text-slate-200">Options Selected</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={clearCompareQueue}
              className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Clear
            </button>
            <button 
              onClick={onOpenCompare}
              className="px-6 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
            >
              Compare Options
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
