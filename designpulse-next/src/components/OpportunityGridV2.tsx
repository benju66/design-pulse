"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
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
  Row,
  Cell,
} from '@tanstack/react-table';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { AlertTriangle, ChevronDown, ChevronUp, Map as MapIcon, SlidersHorizontal, GitCompare } from 'lucide-react';
import {
  useUpdateOpportunity,
  useCreateOpportunity,
  useDeleteOpportunity,
  useAllProjectOptions,
  useCreateOption,
  useUpdateOption
} from '@/hooks/useOpportunityQueries';
import { useProjectSettings, useProjectMembers, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { useProjectCsiSpecs } from '@/hooks/useCsiQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useUIStore } from '@/stores/useUIStore';


import { ExpandedCard } from './opportunities/ExpandedCard';
import { ColumnChooser } from './opportunities/ColumnChooser';
import { useOpportunityColumnsV2 } from './opportunities/columns-v2';
import GhostRow from './opportunities/GhostRow';
import { GridFilterDrawer } from '@/components/ui/GridFilterDrawer';
import { Opportunity, OpportunityOption, EstimateComparisonRow, ProjectEstimateVersion } from '@/types/models';

// IDs of the three version-compare overlay columns.
// Used to exclude them from ve_column_order persistence and column ordering logic (Bug #5).
const COMPARE_COLUMN_IDS = ['compare_version_a', 'compare_version_b', 'compare_delta'] as const;


interface OpportunityGridProps {
  projectId: string;
  data: Opportunity[];
  viewMode?: string;
  onOpenCompare?: () => void;
  isolateState?: boolean;
  hideGhostRow?: boolean;
  filterSlot?: ReactNode;
  filterActiveCount?: number;
  onClearFilters?: () => void;
  // Version Compare Overlay props (data)
  comparisonMap?: Record<string, EstimateComparisonRow[]>;  // Bug #8: array per cost_code
  divisionDeltaMap?: Record<string, number>;
  compareVersionALabel?: string;
  compareVersionBLabel?: string;
  // Version Compare Overlay props (controls — lifted to grid toolbar)
  estimateVersions?: ProjectEstimateVersion[];
  compareVersionA?: string | null;
  compareVersionB?: string | null;
  isCompareActive?: boolean;
  onSetCompareVersionA?: (id: string | null) => void;
  onSetCompareVersionB?: (id: string | null) => void;
  onSetIsCompareActive?: React.Dispatch<React.SetStateAction<boolean>>;
}

interface GroupedRowProps {
  row: Row<Opportunity>;
  virtualRow: VirtualItem;
  measureElement: (el: Element | null) => void;
  visibleColumnIds: string;
  rawCostCodes?: any[];
  isExpanded: boolean;
  divisionDeltaMap?: Record<string, number>; // Bug #9: passed as explicit prop, not via table.options.meta
}

const MemoizedGroupedRow = React.memo(({ row, virtualRow, measureElement, rawCostCodes = [], isExpanded, divisionDeltaMap }: GroupedRowProps) => {
  const divisionVal = row.getValue('division') as string;
  let divisionLabel = divisionVal ? `${divisionVal}` : 'Uncategorized';
  
  if (divisionVal === 'Uncategorized') {
    divisionLabel = 'Uncategorized';
  } else if (divisionVal && rawCostCodes.length > 0) {
    const match = rawCostCodes.find(c => c.code === divisionVal || c.code.startsWith(divisionVal));
    const divNum = divisionVal.substring(0, 2);
    if (match && match.description) {
      divisionLabel = `DIVISION ${divNum} — ${match.description.toUpperCase()}`;
    } else {
      divisionLabel = `DIVISION ${divNum}`;
    }
  }

  // Bug #4 + #9: divisionDeltaMap is pre-computed in page.tsx (O(1) lookup per division)
  const divisionPrefix = divisionVal?.substring(0, 2);
  const divisionDelta = (divisionPrefix && divisionDeltaMap)
    ? (divisionDeltaMap[divisionPrefix] ?? null)
    : null;

  return (
    <tbody 
      ref={measureElement}
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
              <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
              {divisionLabel}
              <span className="ml-2 text-sm text-slate-500 font-normal group relative cursor-help">
                ({row.subRows.length} items)
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-max bg-slate-900 dark:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl z-[100] pointer-events-none font-medium tracking-wide">
                  {(() => {
                    const veCount = row.subRows.filter((r) => !r.original.is_budget_line).length;
                    const budgetCount = row.subRows.filter((r) => r.original.is_budget_line).length;
                    return `${veCount} VE Opportunities • ${budgetCount} Budget Lines`;
                  })()}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900 dark:border-t-slate-800"></div>
                </div>
              </span>
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
              {divisionDelta !== null && (
                <div className="flex flex-col items-end border-l border-amber-300 dark:border-amber-700 pl-4">
                  <span className="text-xs text-amber-500 dark:text-amber-400 font-normal uppercase tracking-wide">Δ Version Delta</span>
                  <span className={`text-sm font-semibold ${
                    divisionDelta < 0 ? 'text-emerald-600 dark:text-emerald-400'
                    : divisionDelta > 0 ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500'
                  }`}>
                    {(divisionDelta >= 0 ? '+' : '') + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(divisionDelta)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  );
}, (prev: GroupedRowProps, next: GroupedRowProps) => {
  return (
    prev.isExpanded === next.isExpanded &&
    prev.row.getValue('cost_impact') === next.row.getValue('cost_impact') &&
    prev.row.getValue('days_impact') === next.row.getValue('days_impact') &&
    prev.visibleColumnIds === next.visibleColumnIds &&
    prev.virtualRow.index === next.virtualRow.index &&
    prev.divisionDeltaMap === next.divisionDeltaMap  // stable reference comparison (Bug #9)
  );
});


interface GridRowV2Props {
  row: Row<Opportunity>;
  virtualRow: VirtualItem;
  isSelected: boolean;
  viewMode: string;
  measureElement: (el: Element | null) => void;
  visibleColumnIds: string;
  pinnedColumnOffsets: string;
  isExpanded: boolean;
}

const MemoizedGridRowV2 = React.memo(({ row, virtualRow, isSelected, viewMode, measureElement, isExpanded }: GridRowV2Props) => {
  const isSubRow = row.original && !('project_id' in row.original) && 'opportunity_id' in row.original;

  return (
    <tbody 
      ref={measureElement}
      data-index={virtualRow.index}
      className={`border-b border-slate-100 dark:border-slate-800/50 ${isSubRow ? 'bg-sky-50/10 dark:bg-sky-900/5' : ''}`}
    >
      <tr 
        id={`row-${row.original.id}`}
        className={`group transition-colors ${
          isSelected 
            ? (isSubRow 
                ? 'bg-sky-50/60 dark:bg-sky-900/40 border-l border-sky-400' 
                : 'bg-sky-50/80 dark:bg-sky-900/40 border-l-2 border-sky-500')
            : (isSubRow 
                ? 'border-l border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-900/20' 
                : row.original.is_budget_line
                   ? 'bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/60 dark:hover:bg-amber-900/20 border-l-[3px] border-amber-400' 
                   : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')
        }`}
      >
        {row.getVisibleCells().map((cell: Cell<Opportunity, unknown>) => {
          const isPinned = cell.column.getIsPinned() === 'left';
          const isLastPinned = isPinned && cell.column.getIsLastColumn('left');
          
          if (cell.getIsGrouped() || cell.getIsPlaceholder()) return <td key={cell.id} className="p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800" />;
          
          if (isSubRow) {
            let content = null;
            if (cell.column.id === 'title') {
              content = <div className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 pl-8 truncate">↳ {row.original.title}</div>;
            } else if (cell.column.id === 'cost_impact') {
              content = <div className="px-3 py-2 text-sm text-right text-slate-600 dark:text-slate-400 truncate">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(row.original.cost_impact) || 0)}</div>;
            } else if (cell.column.id === 'days_impact') {
              content = <div className="px-3 py-2 text-sm text-center text-slate-600 dark:text-slate-400 truncate">{row.original.days_impact || 0}</div>;
            } else if (cell.column.id === 'options') {
              content = <div className="px-3 py-2 text-xs font-bold text-sky-500 truncate">{'is_locked' in row.original && row.original.is_locked ? 'LOCKED' : ''}</div>;
            }

            return (
              <td 
                key={cell.id} 
                className={`p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800 align-middle bg-clip-padding ${
                  isPinned 
                    ? `sticky z-10 ${
                        isSelected 
                          ? 'bg-sky-50 dark:bg-slate-800' 
                          : 'bg-[#f4f8fa] dark:bg-[#151e2e] group-hover:bg-sky-50 dark:group-hover:bg-slate-800'
                      }` 
                    : ''
                } ${isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2' : ''}`}
                style={isPinned ? { left: cell.column.getStart('left') } : {}}
              >
                {content}
              </td>
            );
          }

          return (
            <td 
              key={cell.id} 
              className={`p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800 align-top bg-clip-padding ${
                isPinned 
                  ? `sticky z-10 ${
                      isSelected 
                        ? 'bg-sky-50 dark:bg-slate-800' 
                        : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800'
                    }` 
                  : ''
              } ${isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2' : ''}`}
              style={isPinned ? { left: cell.column.getStart('left') } : {}}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
      {viewMode === 'card' && isExpanded && !isSubRow && (
        <tr>
          <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-slate-100 dark:border-slate-800/50">
            <ExpandedCard row={row as Row<Opportunity>} />
          </td>
        </tr>
      )}
    </tbody>
  );
}, (prev: GridRowV2Props, next: GridRowV2Props) => {
  return (
    prev.row.original === next.row.original &&
    prev.isSelected === next.isSelected &&
    prev.viewMode === next.viewMode &&
    prev.isExpanded === next.isExpanded &&
    prev.virtualRow.index === next.virtualRow.index &&
    prev.visibleColumnIds === next.visibleColumnIds &&
    prev.pinnedColumnOffsets === next.pinnedColumnOffsets
  );
});

export default function OpportunityGridV2({ projectId, data, viewMode = 'flat', onOpenCompare, isolateState = false, hideGhostRow = false, filterSlot, filterActiveCount = 0, onClearFilters, comparisonMap = {}, divisionDeltaMap = {}, estimateVersions = [], compareVersionA = null, compareVersionB = null, isCompareActive = false, onSetCompareVersionA, onSetCompareVersionB, onSetIsCompareActive }: OpportunityGridProps) {
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const deleteMutation = useDeleteOpportunity(projectId);
  const createOptionMutation = useCreateOption(projectId);
  const updateOptionMutation = useUpdateOption(projectId);
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
  const { data: csiSpecs = [] } = useProjectCsiSpecs(projectId);
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

  const maxOptionCount = useMemo(() => {
    let max = -1;
    for (const opts of Object.values(optionsMap)) {
      for (const opt of opts) {
        if (typeof opt.order_index === 'number' && opt.order_index > max) {
          max = opt.order_index;
        }
      }
    }
    return max + 1;
  }, [optionsMap]);



  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: 'division', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [grouping, setGrouping] = useState<GroupingState>(['division']);
  
const EMPTY_VISIBILITY: VisibilityState = {};

  const globalColumnVisibility = useUIStore(state => state.gridColumnVisibility[projectId] || EMPTY_VISIBILITY) as VisibilityState;
  const _setGridColumnVisibility = useUIStore(state => state.setGridColumnVisibility);
  
  const [localColumnVisibility, setLocalColumnVisibility] = useState<VisibilityState>({});
  
  const globalColumnVisibilitySetter = React.useCallback(
    (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => 
      _setGridColumnVisibility(projectId, updater), 
    [projectId, _setGridColumnVisibility]
  );
  
  const columnVisibility = isolateState ? localColumnVisibility : globalColumnVisibility;
  const setColumnVisibility = isolateState ? setLocalColumnVisibility : globalColumnVisibilitySetter;
  
  const columns = useOpportunityColumnsV2(viewMode, maxOptionCount);
  const { data: settings } = useProjectSettings(projectId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  const activeColumns = useMemo(() => {
    if (!settings?.ve_column_order || typeof settings.ve_column_order[0] === 'string') return columns;
    const hiddenIds = settings.ve_column_order.filter((c: any) => c.visible === false).map((c: any) => c.id);
    return columns.filter((c: any) => {
      const id = c.accessorKey || c.id;
      // Bug #5: always keep compare overlay cols in the active set regardless of ve_column_order
      if ((COMPARE_COLUMN_IDS as readonly string[]).includes(id)) return true;
      return !hiddenIds.includes(id);
    });
  }, [columns, settings?.ve_column_order]);

  useEffect(() => {
    if (!isolateState && settings?.ve_column_order && settings.ve_column_order.length > 0) {
      const savedOrder = settings.ve_column_order;
      const configuredIds = typeof savedOrder[0] === 'string' ? savedOrder : savedOrder.map((c: any) => c.id);
      
      // Bug #5: exclude overlay column IDs from the order-managed set so they never
      // enter ve_column_order persistence and cause stale visibility on page reload.
      const allColIds = activeColumns
        .map(c => (c as any).accessorKey || c.id)
        .filter((id): id is string => !!id && !(COMPARE_COLUMN_IDS as readonly string[]).includes(id));
      
      // Explicitly pin UI columns to the front
      const pinnedFront = ['select', 'open_panel', 'display_id', 'title'].filter(id => allColIds.includes(id));
      
      // Dynamic Matrix columns should be placed immediately after the pinned columns
      const dynamicOptionIds = allColIds.filter(id => typeof id === 'string' && id.startsWith('opt_'));
      
      // Filter out configuredIds that are no longer active, and ignore pinned/dynamic to avoid duplicates
      const activeConfiguredIds = configuredIds.filter((id: string) => 
        allColIds.includes(id) && !pinnedFront.includes(id) && !dynamicOptionIds.includes(id)
      );
      
      // Any new columns that aren't in the config, pinned, or dynamic go to the back
      const unconfiguredIds = allColIds.filter(id => 
        !configuredIds.includes(id as string) && 
        !pinnedFront.includes(id as string) && 
        !dynamicOptionIds.includes(id as string)
      );
      
      setColumnOrder([...pinnedFront, ...dynamicOptionIds, ...activeConfiguredIds, ...unconfiguredIds] as string[]);
    }
  }, [settings?.ve_column_order, activeColumns, isolateState]);

  const userPinningOverrides = useUIStore(state => state.gridColumnPinningOverrides[projectId]) || { pinned: [], unpinned: [] };
  const columnPinning = useMemo(() => {
    const defaultPinned = ['select', 'open_panel'];
    const globalPinned = settings?.ve_column_order?.filter((c: any) => c.pinned).map((c: any) => c.id) || ['display_id', 'title'];
    const allPinned = new Set([...defaultPinned, ...globalPinned, ...userPinningOverrides.pinned]);
    userPinningOverrides.unpinned.forEach(id => allPinned.delete(id));
    return { left: Array.from(allPinned) };
  }, [settings?.ve_column_order, userPinningOverrides]);

  const table = useReactTable<Opportunity>({
    data,
    columns: activeColumns,
    state: { expanded, columnVisibility, columnOrder, sorting, globalFilter, grouping, columnPinning },
    getSubRows: (row) => {
      // Disable subrows completely in Flat (Matrix) View to render contenders horizontally
      if (viewMode === 'flat') return [];
      
      // Only return subrows for parent rows (Opportunities)
      if ('project_id' in row) {
        return (optionsMap[row.id] as unknown as Opportunity[]) || [];
      }
      return [];
    },
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    columnResizeMode: 'onChange',
    enableRowSelection: (row) => !row.original.is_budget_line,
    getRowId: (row) => row.id,
    meta: {
      updateData: updateMutation,
      optionsMap,
      createOption: createOptionMutation.mutate,
      updateOption: updateOptionMutation.mutate,
      rawCostCodes,
      csiSpecs,
      projectMembers,
      permissions,
      // Bug #3: route through meta, never prop-drill into cell renderers
      comparisonMap,
      divisionDeltaMap,
    },
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  // Bug #1: activate/deactivate overlay columns via TanStack visibility API (no structural change)
  useEffect(() => {
    const isActive = Object.keys(comparisonMap).length > 0;
    setColumnVisibility(prev => ({
      ...prev,
      compare_version_a: isActive,
      compare_version_b: isActive,
      compare_delta: isActive,
    }));
  }, [comparisonMap]); // comparisonMap is a stable useMemo reference from page.tsx


  const toggleMapVisibility = useUIStore(state => state.toggleMapVisibility);
  const isMapVisible = useUIStore(state => state.isMapVisible);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44, // Base height
    overscan: 5,
  });

  useEffect(() => {
    if (selectedOpportunityId) {
      const index = rows.findIndex(r => r.original.id === selectedOpportunityId);
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'center' });
        // Deferred DOM flash after virtualizer renders the row
        requestAnimationFrame(() => {
          const el = document.getElementById(`row-${selectedOpportunityId}`);
          if (el) {
            el.classList.add('bg-sky-100/50', 'dark:bg-sky-900/50', 'transition-colors', 'duration-500');
            setTimeout(() => el.classList.remove('bg-sky-100/50', 'dark:bg-sky-900/50'), 1000);
          }
        });
      }
    }
  }, [selectedOpportunityId, rows, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;
  // Budget Ledger metric pills - computed from the data prop
  const budgetMetrics = useMemo(() => {
    const budgetLines = data.filter(r => r.is_budget_line);
    const veRows = data.filter(r => !r.is_budget_line);
    const totalBudget = budgetLines.reduce((s, r) => s + (Number(r.cost_impact) || 0), 0);
    const netVeImpact = veRows.reduce((s, r) => s + (Number(r.cost_impact) || 0), 0);
    const potentialExposure = veRows
      .filter(r => r.status !== 'Approved' && r.status !== 'Rejected')
      .reduce((s, r) => s + Math.max(0, Number(r.cost_impact) || 0), 0);
    return { totalBudget, netVeImpact, potentialExposure };
  }, [data]);
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative">
      {/* no overflow-hidden: MultiSelectFilter popover is z-[100] and must escape this container */}
      <div className="flex items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-t-xl z-20 flex-wrap">
        {/* Left: label + search + metric pills */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-2">Budget Ledger</span>
          <input 
            type="text"
            placeholder="Search items..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 w-48"
          />
        </div>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />
        {/* Metric pills */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-start px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">Budget Total</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums leading-tight mt-0.5">{fmt(budgetMetrics.totalBudget)}</span>
          </div>
          <div className="flex flex-col items-start px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">VE Impact</span>
            <span className={`text-sm font-bold tabular-nums leading-tight mt-0.5 ${
              budgetMetrics.netVeImpact < 0 ? 'text-emerald-600 dark:text-emerald-400'
              : budgetMetrics.netVeImpact > 0 ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-700 dark:text-slate-200'
            }`}>{budgetMetrics.netVeImpact >= 0 ? '+' : ''}{fmt(budgetMetrics.netVeImpact)}</span>
          </div>
          <div className="flex flex-col items-start px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800">
            <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider leading-none">Exposure</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums leading-tight mt-0.5">{fmt(budgetMetrics.potentialExposure)}</span>
          </div>
        </div>
        {/* Right: actions + compare strip */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Compare strip */}
          {onSetIsCompareActive && (
            isCompareActive ? (
              <>
                <select
                  value={compareVersionA ?? ''}
                  onChange={e => onSetCompareVersionA?.(e.target.value || null)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">Version A…</option>
                  {estimateVersions.map(v => (
                    <option key={v.id} value={v.id}>{v.version_name}{v.is_active ? ' ★' : ''}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-400 select-none px-0.5">vs</span>
                <select
                  value={compareVersionB ?? ''}
                  onChange={e => onSetCompareVersionB?.(e.target.value || null)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">Version B…</option>
                  {estimateVersions.map(v => (
                    <option key={v.id} value={v.id}>{v.version_name}{v.is_active ? ' ★' : ''}</option>
                  ))}
                </select>
                <button
                  disabled={!compareVersionA || !compareVersionB || compareVersionA === compareVersionB}
                  onClick={() => onSetIsCompareActive(true)}
                  title={compareVersionA === compareVersionB ? 'Select two different versions to compare' : 'Activate comparison'}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Compare
                </button>
                <button
                  onClick={() => { onSetIsCompareActive(false); onSetCompareVersionB?.(null); }}
                  className="text-xs text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 px-1 transition-colors"
                  title="Exit Compare Mode"
                >
                  ✕ Exit
                </button>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />
              </>
            ) : (
              <>
                <button
                  onClick={() => onSetIsCompareActive(prev => !prev)}
                  disabled={estimateVersions.length < 2}
                  title={estimateVersions.length < 2 ? 'Import at least two estimate versions to compare' : 'Compare estimate versions'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <GitCompare size={13} /> Compare Versions
                </button>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />
              </>
            )
          )}
          {filterSlot && (
            <button
              onClick={() => setIsFilterOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isFilterOpen || filterActiveCount > 0
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
              {filterActiveCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 text-xs font-bold text-white bg-sky-500 rounded-full">
                  {filterActiveCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={toggleMapVisibility}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isMapVisible
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <MapIcon size={16} /> Drawings
          </button>
          <ColumnChooser table={table} projectId={projectId} />
        </div>
      </div>

      {filterSlot && (
        <GridFilterDrawer
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          activeCount={filterActiveCount}
          onClearAll={() => onClearFilters?.()}
        >
          {filterSlot}
        </GridFilterDrawer>
      )}

      <div 
        ref={tableContainerRef} 
        className="flex-1 overflow-auto rounded-b-xl outline-none"
        tabIndex={0}
      >
        <table 
          className="text-left text-sm whitespace-nowrap border-separate border-spacing-0" 
          style={{ tableLayout: 'fixed', width: table.getTotalSize() }}
        >
          <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-20">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isPinned = header.column.getIsPinned() === 'left';
                const isLastPinned = isPinned && header.column.getIsLastColumn('left');
                return (
                <th 
                  key={header.id} 
                  className={`relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-b-2 border-slate-300 dark:border-slate-700 select-none group bg-slate-100 dark:bg-slate-900 bg-clip-padding ${
                    isPinned ? 'sticky z-30' : ''
                  } ${isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2' : ''}`}
                  style={{ width: header.getSize(), ...(isPinned ? { left: header.column.getStart('left') } : {}) }}
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
              )})}
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
            const visibleColumnIds = row.getVisibleCells().map((c: any) => c.column.id).join(',');
            const pinnedColumnOffsets = row.getVisibleCells()
              .filter((c: any) => c.column.getIsPinned())
              .map((c: any) => c.column.getStart('left'))
              .join(',');
            
            if (row.getIsGrouped()) {
              return (
                <MemoizedGroupedRow 
                  key={row.id}
                  row={row}
                  virtualRow={virtualRow}
                  measureElement={virtualizer.measureElement}
                  visibleColumnIds={visibleColumnIds}
                  rawCostCodes={(table.options.meta as any)?.rawCostCodes || []}
                  isExpanded={row.getIsExpanded()}
                  divisionDeltaMap={divisionDeltaMap}
                />
              );
            }

            return (
              <MemoizedGridRowV2 
                key={row.id}
                row={row}
                virtualRow={virtualRow}
                isSelected={isSelected}
                viewMode={viewMode}
                measureElement={virtualizer.measureElement}
                visibleColumnIds={visibleColumnIds}
                pinnedColumnOffsets={pinnedColumnOffsets}
                isExpanded={row.getIsExpanded()}
              />
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
