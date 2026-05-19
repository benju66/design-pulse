"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { AlertTriangle, ChevronDown, ChevronUp, Map as MapIcon, SlidersHorizontal } from 'lucide-react';
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
import { Opportunity, OpportunityOption } from '@/types/models';
import { useVirtualGridKeyboardNavigation } from '@/hooks/useVirtualGridKeyboardNavigation';
import { formatCostCode } from '@/lib/formatCostCode';

// IDs of the five ledger financial narrative columns.
// Excluded from ve_column_order persistence — ledger column order is fixed by design.
const LEDGER_COLUMN_IDS = ['baseline_budget', 'approved_changes', 'revised_budget', 'pending_changes', 'projected_final'] as const;

// Phase 2: Compound cells (ledger-only, hidden in matrix)
const COMPOUND_COLUMN_IDS = ['item_definition', 'cost_classification', 'management'] as const;

// Combined set for all non-persistable column IDs
const EXCLUDED_COLUMN_IDS = [...LEDGER_COLUMN_IDS, ...COMPOUND_COLUMN_IDS] as const;

// Narrow type for ve_column_order items (replaces `any` casts — AGENTS.md C1)
interface VeColumnConfig { id: string; visible?: boolean; pinned?: boolean }


interface OpportunityGridProps {
  projectId: string;
  data: Opportunity[];
  viewMode?: string;
  onOpenCompare?: () => void;
  isolateState?: boolean;
  hideGhostRow?: boolean;
  isLedgerView?: boolean;
  filterSlot?: ReactNode;
  filterActiveCount?: number;
  onClearFilters?: () => void;
  // Phase 2: pre-computed variance note lookup (cost_code → note text)
  varianceNoteMap?: Record<string, string>;
  // Phase 2: active estimate version ID for version-scoped note editing
  activeVersionId?: string | null;
  /** Fires when the internal filter drawer opens/closes — lets parent views react (e.g. auto-collapse analytics) */
  onFilterDrawerToggle?: (isOpen: boolean) => void;
}

interface GroupedRowProps {
  row: Row<Opportunity>;
  virtualRow: VirtualItem;
  measureElement: (el: Element | null) => void;
  visibleColumnIds: string;
  rawCostCodes?: unknown[];
  isExpanded: boolean;
  isLedgerView: boolean;
  isStickyClone?: boolean;
}

const MemoizedGroupedRow = React.memo(function MemoizedGroupedRow({ row, virtualRow, measureElement, rawCostCodes = [], isExpanded, isLedgerView, isStickyClone = false }: GroupedRowProps) {
  const divisionVal = row.getValue('division') as string;
  let divisionLabel = divisionVal ? `${divisionVal}` : 'UNCATEGORIZED';
  
  if (divisionVal === 'Uncategorized') {
    divisionLabel = 'UNCATEGORIZED';
  } else if (divisionVal && rawCostCodes.length > 0) {
    const divNum = divisionVal.substring(0, 2);
    // Guard: if division prefix is non-numeric (e.g. 'Un' from 'Un0000'), treat as Uncategorized
    const isNumericDiv = divNum.length === 2 && divNum[0] >= '0' && divNum[0] <= '9' && divNum[1] >= '0' && divNum[1] <= '9';
    if (!isNumericDiv) {
      divisionLabel = 'UNCATEGORIZED';
    } else {
      const match = (rawCostCodes as Array<{ code: string; description?: string }>).find(c => c.code === divisionVal || c.code.startsWith(divisionVal));
      if (match && match.description) {
        divisionLabel = `DIVISION ${divNum} — ${match.description.toUpperCase()}`;
      } else {
        divisionLabel = `DIVISION ${divNum}`;
      }
    }
  }



  // ── Ledger Mode: Hybrid ColSpan Layout ──────────────────────────────────────
  // Split visible cells into "label" (non-financial) and "financial" (aggregated).
  // The label portion gets a single colSpan td with the group key; each financial
  // cell renders individually under its header. This eliminates the staircase effect.
  if (isLedgerView) {
    const isDivisionLevel = row.depth === 0;
    const groupKey = isDivisionLevel ? divisionLabel : (() => {
      const costCodeVal = row.getValue('cost_code') as string;
      if (!costCodeVal) return 'Uncategorized';
      // Strip cost_type suffix (.M/.S/.L) before lookup (iOS-safe — no regex, AGENTS.md A)
      const dotIdx = costCodeVal.indexOf('.');
      const baseCode = dotIdx !== -1 ? costCodeVal.slice(0, dotIdx) : costCodeVal;
      const padded = baseCode.padStart(6, '0');
      const match = (rawCostCodes as Array<{ code: string; description?: string }>).find(c => c.code === padded);
      return match?.description
        ? `${formatCostCode(padded)} \u2014 ${match.description}`
        : formatCostCode(padded);
    })();

    const depthStyles = isDivisionLevel
      ? 'bg-slate-200/80 dark:bg-slate-800'
      : 'bg-slate-100/60 dark:bg-slate-800/60';

    // Partition cells by POSITION: find the first financial column and split there.
    // Label colSpan covers everything before the first financial cell.
    // Each cell from the first financial onward gets its own <td>.
    const allCells = row.getVisibleCells();
    const financialCellIds = new Set(['cost_impact', 'days_impact', 'baseline_budget', 'approved_changes', 'revised_budget', 'pending_changes', 'projected_final']);
    const firstFinancialIdx = allCells.findIndex(c => financialCellIds.has(c.column.id));
    const labelColSpan = firstFinancialIdx > 0 ? firstFinancialIdx : 1;
    const trailingCells = firstFinancialIdx > 0 ? allCells.slice(firstFinancialIdx) : allCells.slice(1);

    const labelWidth = allCells.slice(0, labelColSpan).reduce((acc, c) => acc + c.column.getSize(), 0);

    return (
      <tbody
        ref={measureElement}
        data-index={virtualRow.index}
        className={`${depthStyles}`}
      >
        <tr>
          {/* Label: single colSpan td covering everything before the first financial column */}
          <td
            colSpan={labelColSpan}
            data-row-index={virtualRow.index}
            data-col-id={allCells[0]?.column.id}
            style={isStickyClone ? { width: labelWidth } : undefined}
            className={`max-w-0 px-4 py-2.5 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 overflow-hidden border-b border-slate-200 dark:border-slate-700 bg-clip-padding ${isStickyClone ? (isDivisionLevel ? 'bg-slate-200 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800') : ''}`}
            onClick={row.getToggleExpandedHandler()}
            title={groupKey}
          >
            <span className="flex items-center gap-2 min-w-0" style={{ paddingLeft: row.depth * 20 }}>
              <span className="text-slate-400 text-xs shrink-0">{isExpanded ? '▼' : '▶'}</span>
              <span className={`truncate ${isDivisionLevel ? 'font-bold text-sm text-slate-800 dark:text-slate-200' : 'font-semibold text-sm text-slate-700 dark:text-slate-300'}`}>
                {groupKey}
              </span>
              <span className="text-xs text-slate-500 font-normal shrink-0">
                {isDivisionLevel
                  ? `(${row.subRows.length})`
                  : (() => {
                      const bl = row.subRows.filter(r => r.original.is_budget_line).length;
                      const ve = row.subRows.length - bl;
                      if (bl > 0 && ve > 0) return `(${bl} BL · ${ve} VE)`;
                      if (bl > 0) return `(${bl} BL)`;
                      return `(${ve} VE)`;
                    })()
                }
              </span>
              {/* Phase 4: Division-level summary chips */}
              {isDivisionLevel && isLedgerView && (() => {
                // Collect all leaf rows across nested sub-groups
                const leaves: Row<Opportunity>[] = [];
                const collectLeaves = (rows: Row<Opportunity>[]) => {
                  for (const r of rows) {
                    if (r.subRows.length > 0) collectLeaves(r.subRows);
                    else leaves.push(r);
                  }
                };
                collectLeaves(row.subRows);
                const baseline = leaves
                  .filter(r => r.original.is_budget_line)
                  .reduce((s, r) => s + (Number(r.original.baseline_budget) || 0), 0);
                const variance = leaves
                  .filter(r => !r.original.is_budget_line)
                  .reduce((s, r) => s + (Number(r.original.cost_impact) || 0), 0);
                const fmtDiv = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(n);
                if (baseline === 0 && variance === 0) return null;
                return (
                  <span className="flex items-center gap-1.5 ml-2 shrink-0">
                    {baseline > 0 && (
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">{fmtDiv(baseline)}</span>
                    )}
                    {Math.abs(variance) > 0.001 && (
                      <span className={`text-[10px] font-bold tabular-nums ${variance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {variance >= 0 ? '+' : ''}{fmtDiv(variance)}
                      </span>
                    )}
                  </span>
                );
              })()}
            </span>
          </td>
          {/* Remaining cells: financial ones render aggregated values, others render empty */}
          {trailingCells.map(cell => (
            <td key={cell.id} data-row-index={virtualRow.index} data-col-id={cell.column.id} style={isStickyClone ? { width: cell.column.getSize() } : undefined} className={`px-0 py-0 border-b border-slate-200 dark:border-slate-700 bg-clip-padding ${isStickyClone ? (isDivisionLevel ? 'bg-slate-200 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800') : ''}`}>
              {financialCellIds.has(cell.column.id)
                ? flexRender(
                    cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                    cell.getContext()
                  )
                : null}
            </td>
          ))}
        </tr>
      </tbody>
    );
  }

  // ── Value Matrix Mode: Original Colspan Layout ────────────────────────────
  const totalWidth = row.getVisibleCells().reduce((acc, c) => acc + c.column.getSize(), 0);
  
  return (
    <tbody 
      ref={measureElement}
      data-index={virtualRow.index}
      className={isStickyClone ? '' : "bg-slate-100 dark:bg-slate-800"}
    >
      <tr>
        <td 
          colSpan={row.getVisibleCells().length} 
          data-row-index={virtualRow.index}
          data-col-id={row.getVisibleCells()[0]?.column.id}
          style={isStickyClone ? { width: totalWidth } : undefined}
          className={`px-4 py-3 font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 border-b-2 border-slate-300 dark:border-slate-600 bg-clip-padding ${isStickyClone ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
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
                <span className={`text-sm ${
                  Math.abs(Number(row.getValue('cost_impact')) || 0) < 0.001 ? 'text-slate-400 dark:text-slate-600' :
                  Number(row.getValue('cost_impact')) > 0 ? 'text-rose-600' : 
                  Number(row.getValue('cost_impact')) < 0 ? 'text-emerald-600' : ''
                }`}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(row.getValue('cost_impact')) || 0)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-500 font-normal uppercase">Days Impact</span>
                <span className={`text-sm ${Math.abs(Number(row.getValue('days_impact')) || 0) < 0.001 ? 'text-slate-400 dark:text-slate-600' : ''}`}>
                  {row.getValue('days_impact') || 0}
                </span>
              </div>

            </div>
          </div>
        </td>
      </tr>
    </tbody>
  );
}, (prev: GroupedRowProps, next: GroupedRowProps) => {
  return (
    prev.isExpanded === next.isExpanded &&
    prev.isLedgerView === next.isLedgerView &&
    prev.isStickyClone === next.isStickyClone &&
    prev.row.id === next.row.id &&
    prev.row.getValue('cost_impact') === next.row.getValue('cost_impact') &&
    prev.row.getValue('days_impact') === next.row.getValue('days_impact') &&
    prev.visibleColumnIds === next.visibleColumnIds &&
    prev.virtualRow.index === next.virtualRow.index
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

const MemoizedGridRowV2 = React.memo(function MemoizedGridRowV2({ row, virtualRow, isSelected, viewMode, measureElement, isExpanded }: GridRowV2Props) {
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
                   ? (() => {
                       // Phase 4: Variance severity color bands
                       const bl = Number(row.original.baseline_budget) || 0;
                       const rv = Number(row.original.revised_budget) || 0;
                       const delta = rv - bl;
                       const pct = bl > 0 ? delta / bl : 0;
                       if (pct >= 0.1) return 'bg-rose-50/30 dark:bg-rose-900/10 hover:bg-rose-50/60 dark:hover:bg-rose-900/20 border-l-[3px] border-rose-400';
                       if (pct <= -0.1) return 'bg-emerald-50/30 dark:bg-emerald-900/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20 border-l-[3px] border-emerald-400';
                       return 'bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/60 dark:hover:bg-amber-900/20 border-l-[3px] border-amber-400';
                     })() 
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
                data-row-index={virtualRow.index}
                data-col-id={cell.column.id}
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
              data-row-index={virtualRow.index}
              data-col-id={cell.column.id}
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

export default function OpportunityGridV2({ projectId, data, viewMode = 'flat', onOpenCompare, isolateState = false, hideGhostRow = false, isLedgerView = false, filterSlot, filterActiveCount = 0, onClearFilters, varianceNoteMap = {}, activeVersionId, onFilterDrawerToggle }: OpportunityGridProps) {
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const deleteMutation = useDeleteOpportunity(projectId);
  const createOptionMutation = useCreateOption(projectId);
  const updateOptionMutation = useUpdateOption(projectId);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
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

  // Notify parent when filter drawer toggles (e.g., BudgetLedgerView auto-collapses analytics)
  const handleFilterToggle = useCallback((open: boolean) => {
    setIsFilterOpen(open);
    onFilterDrawerToggle?.(open);
  }, [onFilterDrawerToggle]);

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
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'division', desc: false },
    { id: 'cost_code', desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [grouping, setGrouping] = useState<GroupingState>(
    isLedgerView ? ['division', 'cost_code'] : ['division']
  );

  // Sync grouping when isLedgerView changes without remount (e.g., sidebar nav)
  useEffect(() => {
    setGrouping(isLedgerView ? ['division', 'cost_code'] : ['division']);
  }, [isLedgerView]);
  
const EMPTY_VISIBILITY: VisibilityState = {};

  const globalColumnVisibility = useUIStore(state => state.gridV2ColumnVisibility[projectId] || EMPTY_VISIBILITY) as VisibilityState;
  const _setGridColumnVisibility = useUIStore(state => state.setGridV2ColumnVisibility);
  
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
    const orderConfig = settings.ve_column_order as VeColumnConfig[];
    const hiddenIds = orderConfig.filter(c => c.visible === false).map(c => c.id);
    return columns.filter(c => {
      const id = ('accessorKey' in c ? c.accessorKey : c.id) as string | undefined;
      // Bug #5: always keep compare overlay & ledger cols in the active set regardless of ve_column_order
      if ((EXCLUDED_COLUMN_IDS as readonly string[]).includes(id!)) return true;
      return !hiddenIds.includes(id!);
    });
  }, [columns, settings?.ve_column_order]);

  useEffect(() => {
    if (!isolateState && settings?.ve_column_order && settings.ve_column_order.length > 0) {
      const savedOrder = settings.ve_column_order;
      const configuredIds = typeof savedOrder[0] === 'string'
        ? (savedOrder as string[])
        : (savedOrder as VeColumnConfig[]).map(c => c.id);
      
      // Bug #5: exclude overlay & ledger column IDs from the order-managed set so they never
      // enter ve_column_order persistence and cause stale visibility on page reload.
      const allColIds = activeColumns
        .map(c => ('accessorKey' in c ? c.accessorKey : c.id) as string | undefined)
        .filter((id): id is string => !!id && !(EXCLUDED_COLUMN_IDS as readonly string[]).includes(id));
      
      // Explicitly pin UI columns to the front — mode-aware (Bug #7 + #10)
      const pinnedFront = isLedgerView
        ? ['select', 'open_panel', 'item_definition', 'cost_classification', 'management'].filter(id => allColIds.includes(id))
        : ['select', 'open_panel', 'display_id', 'title'].filter(id => allColIds.includes(id));
      
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
      
      // Inject ledger columns at their fixed position (right after days_impact) so
      // the financial narrative flows left-to-right. They're excluded from
      // ve_column_order persistence but need explicit positional injection here.
      const baseOrder = [...pinnedFront, ...dynamicOptionIds, ...activeConfiguredIds, ...unconfiguredIds] as string[];
      const daysIdx = baseOrder.indexOf('days_impact');
      const ledgerIds = [...LEDGER_COLUMN_IDS] as string[];
      if (daysIdx !== -1) {
        baseOrder.splice(daysIdx + 1, 0, ...ledgerIds);
      } else {
        // Fallback: append after the pinned+dynamic block
        baseOrder.push(...ledgerIds);
      }
      setColumnOrder(baseOrder);
    }
  }, [settings?.ve_column_order, activeColumns, isolateState, isLedgerView]);

  const userPinningOverrides = useUIStore(state => state.gridColumnPinningOverrides[projectId]) || { pinned: [], unpinned: [] };
  // Bug #4: column pinning must swap based on isLedgerView
  const columnPinning = useMemo(() => {
    const defaultPinned = ['select', 'open_panel'];
    if (isLedgerView) {
      return { left: [...defaultPinned, 'item_definition'] };
    }
    const globalPinned = (settings?.ve_column_order as VeColumnConfig[] | undefined)?.filter(c => c.pinned).map(c => c.id) || ['display_id', 'title'];
    const allPinned = new Set([...defaultPinned, ...globalPinned, ...userPinningOverrides.pinned]);
    userPinningOverrides.unpinned.forEach(id => allPinned.delete(id));
    return { left: Array.from(allPinned) };
  }, [settings?.ve_column_order, userPinningOverrides, isLedgerView]);

  const table = useReactTable<Opportunity>({
    data,
    columns: activeColumns,
    state: { expanded, columnVisibility, columnOrder, sorting, globalFilter, grouping, columnPinning },
    getSubRows: (row) => {
      // Ledger view: hierarchy is entirely managed by getGroupedRowModel via grouping state.
      // getSubRows must be disabled to avoid corrupting the grouped row tree (F1 fix).
      if (isLedgerView) return [];
      
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
      // Phase 2: variance note lookup for LedgerDeltaCell icon
      varianceNoteMap,
      // Phase 2: active version ID for version-scoped note editing
      activeVersionId,
      // Phase 3: Ledger mode flag — used by ImpactCell to de-emphasize VE cost_impact
      isLedgerView,
    },
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();



  // Ledger columns: visible only in Budget Ledger view, hidden in Value Matrix.
  // Also hide columns that are redundant in the grouped hierarchy:
  // - division / cost_code: already displayed in group row headers
  // - expander: group rows have built-in expand toggles
  // - options: not relevant for budget line items
  useEffect(() => {
    setColumnVisibility(prev => ({
      ...prev,
      // Show ledger financial columns
      baseline_budget: isLedgerView,
      approved_changes: isLedgerView,
      revised_budget: isLedgerView,
      pending_changes: isLedgerView,
      projected_final: isLedgerView,
      // Phase 2: Compound cells ON in ledger, OFF in matrix
      item_definition: isLedgerView,
      cost_classification: isLedgerView,
      management: false, // hidden by default — opt-in via Column Chooser
      // Individual columns replaced by compounds — OFF in ledger, ON in matrix
      display_id: !isLedgerView,
      title: !isLedgerView,
      building_area: !isLedgerView,
      spec_number_id: !isLedgerView,
      assignee: !isLedgerView,
      priority: !isLedgerView,
      due_date: !isLedgerView,
      // Already hidden in ledger (grouping columns)
      division: !isLedgerView,
      cost_code: !isLedgerView,
      expander: !isLedgerView,
      options: !isLedgerView,
    }));
  }, [isLedgerView, setColumnVisibility]);

  // Bug #8: ColumnChooser reset handler that re-applies ledger/matrix visibility defaults
  const handleColumnReset = useCallback(() => {
    table.setColumnVisibility({});
    table.setColumnOrder([]);
    // Re-apply the ledger/matrix visibility defaults since isLedgerView hasn't changed
    setColumnVisibility({
      baseline_budget: isLedgerView, approved_changes: isLedgerView,
      revised_budget: isLedgerView, pending_changes: isLedgerView, projected_final: isLedgerView,
      item_definition: isLedgerView, cost_classification: isLedgerView, management: false,
      display_id: !isLedgerView, title: !isLedgerView, building_area: !isLedgerView,
      spec_number_id: !isLedgerView, assignee: !isLedgerView, priority: !isLedgerView,
      due_date: !isLedgerView, division: !isLedgerView, cost_code: !isLedgerView,
      expander: !isLedgerView, options: !isLedgerView,
    });
  }, [isLedgerView, table]);


  const toggleMapVisibility = useUIStore(state => state.toggleMapVisibility);
  const isMapVisible = useUIStore(state => state.isMapVisible);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44, // Base height
    overscan: 5,
  });

  // Auto-focus the grid when it mounts so keyboard navigation works immediately
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.focus({ preventScroll: true });
    }
  }, []);

  const { onKeyDown } = useVirtualGridKeyboardNavigation({
    table,
    virtualizer,
    onEscape: () => {
      setSelectedOpportunityId(null);
    },
    onEnter: (row, colId) => {
      // Grouped Rows (Division/Cost Code headers) always expand on Enter
      if (row.getIsGrouped()) {
        row.getToggleExpandedHandler()();
        return;
      }
      // The explicit expander column (Card View) expands on Enter
      if (colId === 'expander') {
        if (row.getCanExpand()) row.getToggleExpandedHandler()();
        return;
      }
      // Any other cell opens the Detail Panel.
      // If it's a sub-row (Option), we must open the PARENT opportunity's detail panel.
      const targetId = 'opportunity_id' in row.original 
        ? (row.original.opportunity_id as string) 
        : row.original.id;
      
      setSelectedOpportunityId(targetId);
      
      // Force the layout into split view so the detail panel actually appears
      if (useUIStore.getState().veGridViewMode !== 'split') {
        useUIStore.getState().setVeGridViewMode('split');
      }

      // Throw focus to the Detail Panel after React renders it
      setTimeout(() => {
        const panel = document.getElementById('detail-panel-container');
        if (panel) panel.focus({ preventScroll: true });
      }, 50);
    },
    onSpace: (row, colId) => {
      // Grouped Rows always expand on Space
      if (row.getIsGrouped()) {
        row.getToggleExpandedHandler()();
        return;
      }
      // The explicit expander column expands on Space
      if (colId === 'expander') {
        if (row.getCanExpand()) row.getToggleExpandedHandler()();
        return;
      }
      // Any other cell toggles the Compare Queue.
      // Must explicitly block sub-rows (Options) and Budget Lines to prevent data corruption.
      if (!('opportunity_id' in row.original) && !row.original.is_budget_line) {
        const id = row.original.id;
        if (compareQueue.includes(id)) {
          setCompareQueue(compareQueue.filter(x => x !== id));
        } else {
          setCompareQueue([...compareQueue, id]);
        }
      }
    },
    getValidColumnIds: (row, visibleCols) => {
      // 1. Grouped Row Logic
      if (row.getIsGrouped() && isLedgerView) {
        const financialCellIds = new Set(['cost_impact', 'days_impact', 'baseline_budget', 'approved_changes', 'revised_budget', 'pending_changes', 'projected_final']);
        const allColIds = visibleCols.map(c => c.id);
        const firstFinIdx = allColIds.findIndex(id => financialCellIds.has(id));
        if (firstFinIdx > 0) {
          return [allColIds[0], ...allColIds.slice(firstFinIdx)];
        }
      }
      
      // 2. Sub-Row Logic
      const isSubRow = row.original && !('project_id' in row.original) && 'opportunity_id' in row.original;
      if (isSubRow) {
        // Skip the empty indentation cells so the user doesn't have to arrow through blank space
        const skipIds = new Set(['select', 'open_panel', 'display_id', 'expander']);
        return visibleCols.map(c => c.id).filter(id => !skipIds.has(id));
      }

      // 3. Budget Line Logic
      if (row.original?.is_budget_line) {
        // Budget lines don't have checkboxes, so we skip the select column entirely
        return visibleCols.map(c => c.id).filter(id => id !== 'select');
      }

      return visibleCols.map(c => c.id);
    }
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
    
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [theadHeight, setTheadHeight] = useState(34);
  
  useEffect(() => {
    if (theadRef.current) {
      setTheadHeight(theadRef.current.getBoundingClientRect().height);
    }
  }, [activeColumns, isLedgerView]);

  const { activeGroupRow, stickyTranslateY } = useMemo(() => {
    if (virtualItems.length === 0) return { activeGroupRow: null, stickyTranslateY: 0 };
    const currentScroll = virtualizer.scrollOffset ?? 0;
    // 1. Find the deepest virtual item that has hit the ceiling
    let topVisibleIndex = -1;
    for (let i = 0; i < virtualItems.length; i++) {
      if (virtualItems[i].start <= currentScroll) {
        topVisibleIndex = virtualItems[i].index;
      } else {
        break; // Items are ordered by index/start, so we can stop early
      }
    }
    
    // If no items have hit the ceiling (e.g. bounce scrolling at the very top), no sticky row
    if (topVisibleIndex === -1) {
      return { activeGroupRow: null, stickyTranslateY: 0 };
    }
    
    // 2. Scan backwards from the top visible item to find the parent group
    let activeIndex = -1;
    for (let i = topVisibleIndex; i >= 0; i--) {
      if (rows[i].getIsGrouped() && rows[i].depth === 0) {
        activeIndex = i;
        break;
      }
    }
    
    if (activeIndex === -1) return { activeGroupRow: null, stickyTranslateY: 0 };
    
    let translateY = 0;
    const nextGroupVirtualItem = virtualItems.find(
      (v) => v.index > activeIndex && rows[v.index].getIsGrouped() && rows[v.index].depth === 0
    );
    
    if (nextGroupVirtualItem) {
      const distanceToCeiling = nextGroupVirtualItem.start - currentScroll;
      const stickyHeight = isLedgerView ? 41 : 46; // Approximate heights
      if (distanceToCeiling > 0 && distanceToCeiling < stickyHeight) {
        translateY = distanceToCeiling - stickyHeight;
      }
    }
    
    return { 
      activeGroupRow: { row: rows[activeIndex], index: activeIndex },
      stickyTranslateY: translateY
    };
  }, [virtualItems, rows, virtualizer.scrollOffset, theadHeight, isLedgerView]);

  // Budget Ledger metric pills - computed from the data prop
  const budgetMetrics = useMemo(() => {
    const budgetLines = data.filter(r => r.is_budget_line);
    const veRows = data.filter(r => !r.is_budget_line);
    const totalBudget = budgetLines.reduce((s, r) => s + (Number(r.cost_impact) || 0), 0);
    const netVeImpact = veRows.reduce((s, r) => s + (Number(r.cost_impact) || 0), 0);
    const potentialExposure = veRows
      .filter(r => r.status !== 'Approved' && r.status !== 'Rejected')
      .reduce((s, r) => {
        const opts = optionsMap[r.id] || [];
        if (opts.length === 0) {
          // No options attached — use parent cost_impact
          return s + Math.max(0, Number(r.cost_impact) || 0);
        }
        // Priority: if user has flagged specific options for budget, use those
        const budgetFlagged = opts.filter(o => o.include_in_budget);
        if (budgetFlagged.length > 0) {
          return s + budgetFlagged.reduce((sum, o) => sum + Math.max(0, Number(o.cost_impact) || 0), 0);
        }
        // Fallback: worst-case = Math.max() across all options (AGENTS.md §3)
        return s + Math.max(0, ...opts.map(o => Number(o.cost_impact) || 0));
      }, 0);
    return { totalBudget, netVeImpact, potentialExposure };
  }, [data, optionsMap]);
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
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">VE Impact{filterActiveCount > 0 ? ' ✱' : ''}</span>
            <span className={`text-sm font-bold tabular-nums leading-tight mt-0.5 ${
              Math.abs(budgetMetrics.netVeImpact) < 0.001 ? 'text-slate-400 dark:text-slate-500'
              : budgetMetrics.netVeImpact < 0 ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
            }`}>{Math.abs(budgetMetrics.netVeImpact) < 0.001 ? '' : budgetMetrics.netVeImpact >= 0 ? '+' : ''}{fmt(budgetMetrics.netVeImpact)}</span>
          </div>
          <div className={`flex flex-col items-start px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border ${
            Math.abs(budgetMetrics.potentialExposure) < 0.001 ? 'border-slate-200 dark:border-slate-700' : 'border-amber-200 dark:border-amber-800'
          }`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider leading-none ${
              Math.abs(budgetMetrics.potentialExposure) < 0.001 ? 'text-slate-400 dark:text-slate-500' : 'text-amber-500 dark:text-amber-400'
            }`}>Exposure{filterActiveCount > 0 ? ' ✱' : ''}</span>
            <span className={`text-sm font-bold tabular-nums leading-tight mt-0.5 ${
              Math.abs(budgetMetrics.potentialExposure) < 0.001 ? 'text-slate-400 dark:text-slate-500' : 'text-amber-600 dark:text-amber-400'
            }`}>{fmt(budgetMetrics.potentialExposure)}</span>
          </div>
        </div>
        {/* Right: actions + compare strip */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {filterSlot && (
            <button
              onClick={() => handleFilterToggle(!isFilterOpen)}
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
          <ColumnChooser table={table} projectId={projectId} onReset={handleColumnReset} />
        </div>
      </div>

      {filterSlot && (
        <GridFilterDrawer
          isOpen={isFilterOpen}
          onClose={() => handleFilterToggle(false)}
          activeCount={filterActiveCount}
          onClearAll={() => onClearFilters?.()}
        >
          {filterSlot}
        </GridFilterDrawer>
      )}

      <div 
        ref={tableContainerRef} 
        className="flex-1 overflow-auto rounded-b-xl outline-none relative"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {/* Floating Sticky Group Header */}
        {activeGroupRow && activeGroupRow.row.getIsExpanded() && (
          <div 
            className="sticky left-0 z-[15] w-full pointer-events-none shadow-md drop-shadow-sm"
            style={{ top: `${theadHeight + stickyTranslateY}px`, height: 0 }}
          >
            <table 
              className="text-left text-sm whitespace-nowrap border-separate border-spacing-0 pointer-events-auto"
              style={{ width: table.getTotalSize() }}
            >
              <MemoizedGroupedRow 
                row={activeGroupRow.row}
                virtualRow={{ index: activeGroupRow.index } as unknown as VirtualItem}
                measureElement={() => {}}
                visibleColumnIds={activeGroupRow.row.getVisibleCells().map(c => c.column.id).join(',')}
                rawCostCodes={table.options.meta?.rawCostCodes ?? []}
                isExpanded={activeGroupRow.row.getIsExpanded()}
                isLedgerView={isLedgerView}
                isStickyClone={true}
              />
            </table>
          </div>
        )}

        <table 
          className="text-left text-sm whitespace-nowrap border-separate border-spacing-0" 
          style={{ tableLayout: 'fixed', width: table.getTotalSize() }}
        >
          <thead ref={theadRef} className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-20">
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
                    className={`min-w-0 flex items-center justify-between ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white' : ''}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
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
            const visibleCells = row.getVisibleCells();
            const visibleColumnIds = visibleCells.map(c => c.column.id).join(',');
            const pinnedColumnOffsets = visibleCells
              .filter(c => c.column.getIsPinned())
              .map(c => c.column.getStart('left'))
              .join(',');
            
            if (row.getIsGrouped()) {
              return (
                <MemoizedGroupedRow 
                  key={row.id}
                  row={row}
                  virtualRow={virtualRow}
                  measureElement={virtualizer.measureElement}
                  visibleColumnIds={visibleColumnIds}
                  rawCostCodes={table.options.meta?.rawCostCodes ?? []}
                  isExpanded={row.getIsExpanded()}
                  isLedgerView={isLedgerView}
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
              <GhostRow table={table} createMutation={createMutation} />
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
