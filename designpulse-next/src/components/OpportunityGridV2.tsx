"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  flexRender,
  ExpandedState,
  SortingState,
  VisibilityState,
  ColumnOrderState,
  GroupingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useUpdateOpportunity, useCreateOpportunity, useDeleteOpportunity, useAllProjectOptions, useProjectSettings, useProjectMembers, useCurrentUserPermissions } from '@/hooks/useProjectQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useUIStore } from '@/stores/useUIStore';
import { useGridNavigation } from '@/hooks/useGridNavigation';

import { ExpandedCard } from './opportunities/ExpandedCard';
import { ColumnChooser } from './opportunities/ColumnChooser';
import { useOpportunityColumnsV2 } from './opportunities/columns-v2';
import GhostRow from './opportunities/GhostRow';
import { Opportunity, OpportunityOption } from '@/types/models';

interface OpportunityGridProps {
  projectId: string;
  data: Opportunity[];
  viewMode?: string;
  onOpenCompare?: () => void;
  isolateState?: boolean;
  hideGhostRow?: boolean;
}

export default function OpportunityGridV2({ projectId, data, viewMode = 'flat', onOpenCompare, isolateState = false, hideGhostRow = false }: OpportunityGridProps) {
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const deleteMutation = useDeleteOpportunity(projectId);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const compareQueue = useUIStore(state => state.compareQueue);
  const clearCompareQueue = useUIStore(state => state.clearCompareQueue);
  const setCompareQueue = useUIStore(state => state.setCompareQueue);

  // Auto-remove deleted items from the compare queue
  useEffect(() => {
    if (compareQueue.length > 0) {
      const validQueue = compareQueue.filter(id => data.some(opp => opp.id === id));
      if (validQueue.length !== compareQueue.length) {
        setCompareQueue(validQueue);
      }
    }
  }, [data, compareQueue, setCompareQueue]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      for (const id of compareQueue) {
        await deleteMutation.mutateAsync(id);
      }
      clearCompareQueue();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to bulk delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

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
  const [grouping, setGrouping] = useState<GroupingState>(['division']);
  
  const globalColumnVisibility = useUIStore(state => state.gridColumnVisibility) as VisibilityState;
  const setGlobalColumnVisibility = useUIStore(state => state.setGridColumnVisibility);
  
  const [localColumnVisibility, setLocalColumnVisibility] = useState<VisibilityState>({});
  
  const columnVisibility = isolateState ? localColumnVisibility : globalColumnVisibility;
  const setColumnVisibility = isolateState ? setLocalColumnVisibility : setGlobalColumnVisibility as any;
  
  const columns = useOpportunityColumnsV2(viewMode);
  const { data: settings } = useProjectSettings(projectId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const permissions = useCurrentUserPermissions(projectId);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  useEffect(() => {
    if (!isolateState && settings?.ve_column_order && settings.ve_column_order.length > 0) {
      // Find the pinned columns that are not configurable and put them first
      const allColIds = columns.map(c => (c as any).accessorKey || c.id).filter(Boolean);
      const configuredIds = settings.ve_column_order;
      const pinnedIds = allColIds.filter(id => !configuredIds.includes(id as string));
      setColumnOrder([...pinnedIds, ...configuredIds] as string[]);
    }
  }, [settings?.ve_column_order, columns, isolateState]);

  const table = useReactTable<Opportunity>({
    data,
    columns,
    state: { expanded, columnVisibility, columnOrder, sorting, globalFilter, grouping },
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    meta: {
      updateData: updateMutation,
      optionsMap,
      rawCostCodes,
      projectMembers,
      permissions,
    } as any,
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44, // Base height
    overscan: 5,
  });

  const { handleKeyDown, moveActiveCell } = useGridNavigation(table as any, virtualizer);
  (table.options.meta as any).moveActiveCell = moveActiveCell;

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative">
      <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-t-xl z-20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">Grid V2 View</span>
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
          if (handleKeyDown) handleKeyDown(e as any);
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
            
            if (row.getIsGrouped()) {
              return (
                <tbody 
                  key={row.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="border-b-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                >
                  <tr>
                    <td 
                      colSpan={row.getVisibleCells().length} 
                      className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={row.getToggleExpandedHandler()}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="flex items-center">
                          <span className="mr-2">{row.getIsExpanded() ? '▼' : '▶'}</span>
                          {row.getValue('division') ? `${row.getValue('division')}` : 'Uncategorized / No Division'}
                          <span className="ml-2 text-sm text-slate-500 font-normal">({row.subRows.length} items)</span>
                        </span>
                        
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-slate-500 font-normal uppercase">Cost Impact</span>
                            <span className={`text-sm ${Number(row.getValue('cost_impact')) > 0 ? 'text-rose-600' : Number(row.getValue('cost_impact')) < 0 ? 'text-emerald-600' : ''}`}>
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(row.getValue('cost_impact')) || 0)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-slate-500 font-normal uppercase">Days Impact</span>
                            <span className="text-sm">{row.getValue('days_impact') || 0}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              );
            }

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
                  {row.getVisibleCells().map((cell) => {
                    if (cell.getIsGrouped()) return <td key={cell.id} className="p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800" />;
                    if (cell.getIsPlaceholder()) return <td key={cell.id} className="p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800" />;
                    return (
                      <td key={cell.id} className="p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
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
                  {hideGhostRow ? "No tasks assigned to you right now." : "No VE or Alternates logged yet. Start typing below to add one!"}
                </td>
              </tr>
            </tbody>
          )}

          {/* Ghost Row for Quick Add */}
          {!hideGhostRow && permissions.can_edit_records && (
            <tbody>
              <GhostRow table={table as any} createMutation={createMutation as any} />
            </tbody>
          )}
        </table>

      {compareQueue.length > 0 && onOpenCompare && (
        <div className="sticky bottom-0 w-full bg-slate-900 text-white p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 rounded-b-xl border-t border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-sky-500 text-white text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">
              {compareQueue.length}
            </div>
            <span className="font-medium text-sm text-slate-200">Options Selected</span>
          </div>
          <div className="flex gap-3">
            {permissions.can_delete_records && (
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 text-sm font-semibold text-rose-400 hover:text-rose-300 transition-colors"
              >
                Delete ({compareQueue.length})
              </button>
            )}
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

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete {compareQueue.length} Items?</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Are you sure you want to delete these items? This action will move them to the trash.
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : 'Delete Items'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
