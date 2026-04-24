"use client";
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown, ChevronUp, GripVertical, Settings, Paperclip, List, MessageSquare, Plus, X, Check, PanelRight, Star } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUpdateOpportunity, useCreateOpportunity, useCreateOption, useUpdateOption, useLockOption, useDeleteOption } from '@/hooks/useProjectQueries';
import { useUIStore } from '@/stores/useUIStore';

import { TextCell, StatusCell, ScopeCell, ImpactCell } from './opportunities/EditableCell';
import { ExpandedCard } from './opportunities/ExpandedCard';
import { OptionsCell } from './opportunities/OptionsCell';
import { ColumnChooser } from './opportunities/ColumnChooser';

import { useOpportunityColumns } from './opportunities/columns';

const EMPTY_ROW = {};

export default function OpportunityGrid({ projectId, data, viewMode = 'flat', onOpenCompare }) {
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const compareQueue = useUIStore(state => state.compareQueue);
  const clearCompareQueue = useUIStore(state => state.clearCompareQueue);
  const pendingRow = useUIStore(state => state.pendingRows[projectId] || EMPTY_ROW);
  const setPendingRow = (updater) => useUIStore.getState().setPendingRow(projectId, updater);
  const clearPendingRow = () => useUIStore.getState().clearPendingRow(projectId);
  const [ghostError, setGhostError] = useState(false);

  useEffect(() => {
    // Force wipe any corrupted draft data that might be stuck in Local Storage
    clearPendingRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const submitGhostRow = () => {
    if (!pendingRow.title?.trim()) {
      setGhostError(true);
      setTimeout(() => setGhostError(false), 2000);
      return;
    }
    createMutation.mutate(pendingRow, { onSuccess: () => clearPendingRow() });
  };

  useEffect(() => {
    if (selectedOpportunityId) {
      const element = document.getElementById(`row-${selectedOpportunityId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedOpportunityId]);

  const [expanded, setExpanded] = useState({});
  const columnVisibility = useUIStore(state => state.gridColumnVisibility);
  const setColumnVisibility = useUIStore(state => state.setGridColumnVisibility);
  const columnOrder = useUIStore(state => state.gridColumnOrder);
  const setColumnOrder = useUIStore(state => state.setGridColumnOrder);

  const columns = useOpportunityColumns(viewMode);

  const table = useReactTable({
    data,
    columns,
    state: { expanded, columnVisibility, columnOrder },
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    columnResizeMode: 'onChange',
    meta: {
      updateData: updateMutation,
    },
  });

  const tableContainerRef = useRef(null);
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
      {/* Table Header Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-t-xl z-20">
        <div className="flex items-center gap-2">
          {/* We can add filters or other controls here later */}
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2">Matrix View</span>
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
          
          // Enter key enters edit mode natively if navigating
          if (e.key === 'Enter') {
            if (gridMode === 'navigate') {
               e.preventDefault();
               useUIStore.getState().setGridMode('edit');
            }
            return;
          }

          // If we are actively typing, never steal arrow keys
          if (gridMode === 'edit') return;

          const activeCell = state.activeCell;
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
            state.setActiveCell({ rowIndex, columnId: newColumnId });
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
                  <div className="truncate">
                    {flexRender(header.column.columnDef.header, header.getContext())}
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
                      <ExpandedCard row={row} updateData={updateMutation} />
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
            <tr className="bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/50 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
              {table.getVisibleLeafColumns().map((column) => {
                if (column.id === 'select' || column.id === 'open_panel') return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800" />;
                
                if (column.id === 'options') {
                  const hasPendingData = Object.keys(pendingRow).length > 0;
                  return (
                    <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={submitGhostRow}
                          className="p-1 bg-sky-500 hover:bg-sky-600 text-white rounded shadow-sm transition-colors"
                          title="Add Opportunity"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={clearPendingRow}
                          disabled={!hasPendingData}
                          className={`p-1 rounded shadow-sm transition-colors ${
                            hasPendingData 
                              ? 'bg-slate-200 hover:bg-rose-500 text-slate-500 hover:text-white cursor-pointer' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                          }`}
                          title="Clear Row"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  );
                }
                if (column.id === 'expander') {
                  return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle text-slate-400 text-center text-xs font-bold">+</td>;
                }
                if (column.id === 'status') {
                  return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle"><span className="text-sm text-slate-400 px-2 py-1 italic block w-full h-full">Draft</span></td>;
                }
                if (column.id === 'display_id') {
                  return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle"><span className="text-sm text-slate-400 px-2 py-1 italic block w-full h-full opacity-60">Auto-ID</span></td>;
                }
                if (column.id === 'priority') {
                  return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle"><span className="text-sm text-slate-400 px-2 py-1 italic block w-full h-full opacity-60">Medium</span></td>;
                }
                if (column.id === 'scope') {
                  return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle"><span className="text-sm text-slate-400 px-2 py-1 italic block w-full h-full opacity-60">General</span></td>;
                }
                return (
                  <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-top">
                    <input
                      type={column.id === 'cost_impact' || column.id === 'days_impact' ? 'number' : 'text'}
                      placeholder={`+ Add ${typeof column.columnDef.header === 'string' ? column.columnDef.header : 'Item'}...`}
                      value={pendingRow[column.id] === undefined ? '' : pendingRow[column.id]}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (column.id === 'cost_impact' || column.id === 'days_impact') {
                          val = val === '' ? '' : Number(val);
                        }
                        setPendingRow(prev => ({ ...prev, [column.id]: val }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitGhostRow();
                        }
                      }}
                      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400/70 dark:placeholder-slate-500/70 italic ${column.id === 'title' && ghostError ? 'ring-2 ring-rose-500 animate-pulse' : ''}`}
                    />
                  </td>
                );
              })}
            </tr>
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
