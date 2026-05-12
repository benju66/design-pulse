import { useMemo } from 'react';
import { PanelRight } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { TextCell, StatusCell, CoordinationStatusCell, BuildingAreaCell, ImpactCell, PriorityCell, CostCodeCell, CsiSpecCell, DivisionCell, DisplayIdCell, AssigneeCell, CostImpactAggregatedCell, DaysImpactAggregatedCell, LedgerFinancialCell, LedgerFinancialAggregatedCell, LedgerDeltaCell, LedgerDeltaAggregatedCell, LedgerProjectedCell, LedgerProjectedAggregatedCell, ItemDefinitionCell, CostClassificationCell, ManagementCell } from './ReadOnlyCell';
import { OptionsCell } from './OptionsCell';
import { InlineOptionCell } from './InlineOptionCell';
import { ColumnDef, Row, CellContext } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

const CheckboxCell = ({ row }: { row: Row<Opportunity> }) => {
  const isSelected = useUIStore(state => state.compareQueue.includes(row.original.id));
  const toggleCompareItem = useUIStore(state => state.toggleCompareItem);
  
  if (row.original.is_budget_line) {
    return <div className="flex items-center justify-center py-2 px-1 text-slate-300 dark:text-slate-600">-</div>;
  }

  return (
    <div className="flex items-center justify-center py-2 px-1">
      <input 
        type="checkbox" 
        checked={isSelected}
        onChange={() => toggleCompareItem(row.original.id)}
        className="w-4 h-4 text-sky-600 bg-slate-100 border-slate-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
      />
    </div>
  );
};

const OpenPanelCell = ({ row }: { row: Row<Opportunity> }) => {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  return (
    <div className="flex items-center justify-center p-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (selectedOpportunityId === row.original.id) {
            setSelectedOpportunityId(null);
          } else {
            setSelectedOpportunityId(row.original.id);
          }
        }}
        className={`p-1 rounded transition-colors ${
          selectedOpportunityId === row.original.id 
            ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/30' 
            : 'text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30'
        }`}
        title="Open Details Panel"
      >
        <PanelRight size={20} />
      </button>
    </div>
  );
};

export const useOpportunityColumnsV2 = (viewMode: string, maxOptionCount: number = 0): ColumnDef<Opportunity, unknown>[] => {
  const checkboxColumn: ColumnDef<Opportunity, unknown> = useMemo(() => ({
    id: 'select',
    header: () => null,
    cell: CheckboxCell,
    size: 40,
  }), []);

  const openPanelColumn: ColumnDef<Opportunity, unknown> = useMemo(() => ({
    id: 'open_panel',
    header: () => null,
    cell: OpenPanelCell,
    size: 40,
  }), []);

  const prioritySort = (rowA: Row<Opportunity>, rowB: Row<Opportunity>, columnId: string) => {
    const weights: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    const aVal = rowA.getValue(columnId) as string;
    const bVal = rowB.getValue(columnId) as string;
    const a = weights[aVal] || 2;
    const b = weights[bVal] || 2;
    return a - b;
  };

  const divisionSort = (rowA: Row<Opportunity>, rowB: Row<Opportunity>, columnId: string) => {
    const aVal = (rowA.getValue(columnId) as string) || 'Uncategorized';
    const bVal = (rowB.getValue(columnId) as string) || 'Uncategorized';
    
    if (aVal === 'Uncategorized' && bVal !== 'Uncategorized') return -1;
    if (aVal !== 'Uncategorized' && bVal === 'Uncategorized') return 1;
    
    return aVal.localeCompare(bVal);
  };

  const dynamicOptionColumns: ColumnDef<Opportunity, unknown>[] = useMemo(() => {
    if (viewMode !== 'flat') return [];
    
    const columns: ColumnDef<Opportunity, unknown>[] = [];
    // +1 to always have an empty column at the end for fast data entry
    for (let i = 0; i <= maxOptionCount; i++) {
      columns.push({
        id: `opt_${i}_title`,
        header: `[C${i + 1}] Title`,
        cell: (context) => <InlineOptionCell context={context} />,
        meta: { order_index: i, field: 'title' },
        enableSorting: false,
        enableColumnFilter: false,
        size: 200,
      });
      columns.push({
        id: `opt_${i}_cost`,
        header: `[C${i + 1}] Cost`,
        cell: (context) => <InlineOptionCell context={context} />,
        meta: { order_index: i, field: 'cost_impact' },
        enableSorting: false,
        enableColumnFilter: false,
        size: 120,
      });
    }
    return columns;
  }, [viewMode, maxOptionCount]);

  const flatColumns: ColumnDef<Opportunity, unknown>[] = useMemo(
    () => [
      checkboxColumn,
      ...(viewMode === 'split' ? [openPanelColumn] : []),
      // Phase 2: Compound cells (ledger-only, hidden in matrix via columnVisibility)
      { id: 'item_definition', header: 'Item / Description', cell: ItemDefinitionCell, size: 280, enableSorting: false },
      { id: 'cost_classification', header: 'Cost Classification', cell: CostClassificationCell, size: 200, enableSorting: false },
      { id: 'management', header: 'Owner / Schedule', cell: ManagementCell, size: 180, enableSorting: false },
      { accessorKey: 'display_id', header: 'ID', cell: DisplayIdCell, size: 80 },
      { accessorKey: 'title', header: 'Title (Element)', cell: TextCell },
      ...dynamicOptionColumns,
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: ImpactCell, aggregatedCell: CostImpactAggregatedCell, aggregationFn: 'sum' },
      { accessorKey: 'days_impact', header: 'Days Impact', cell: ImpactCell, aggregatedCell: DaysImpactAggregatedCell, aggregationFn: 'sum' },
      // ── Ledger Financial Narrative Columns (hidden in Value Matrix via columnVisibility) ──
      { accessorKey: 'baseline_budget', header: 'Baseline', cell: LedgerFinancialCell, aggregatedCell: LedgerFinancialAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'approved_changes', header: 'Approved Δ', cell: LedgerDeltaCell, aggregatedCell: LedgerDeltaAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'revised_budget', header: 'Revised', cell: LedgerFinancialCell, aggregatedCell: LedgerFinancialAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'pending_changes', header: 'Pending Δ', cell: LedgerDeltaCell, aggregatedCell: LedgerDeltaAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'projected_final', header: 'Projected', cell: LedgerProjectedCell, aggregatedCell: LedgerProjectedAggregatedCell, aggregationFn: 'sum', size: 140, enableSorting: false },
      { accessorKey: 'status', header: 'VE Status', cell: StatusCell },
      { accessorKey: 'final_direction', header: 'Final Direction', cell: TextCell },
      { accessorKey: 'coordination_status', header: 'Coordination Status', cell: CoordinationStatusCell },
      { accessorKey: 'building_area', header: 'Building Area', cell: BuildingAreaCell },
      { id: 'division', accessorFn: (row: Opportunity) => row.division ? row.division.substring(0, 6) : 'Uncategorized', header: 'Division', cell: DivisionCell, size: 120, sortingFn: divisionSort },
      { accessorKey: 'cost_code', header: 'Cost Code', cell: CostCodeCell, size: 150 },
      { accessorKey: 'spec_number_id', header: 'CSI Spec', cell: CsiSpecCell, size: 150 },
      { accessorKey: 'priority', header: 'Priority', cell: PriorityCell, sortingFn: prioritySort, size: 100 },
      { accessorKey: 'assignee', header: 'Assigned User', cell: AssigneeCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: TextCell },
    ],
    [viewMode, checkboxColumn, openPanelColumn, dynamicOptionColumns]
  );

  const cardColumns: ColumnDef<Opportunity, unknown>[] = useMemo(
    () => [
      checkboxColumn,
      ...(viewMode === 'split' ? [openPanelColumn] : []),
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
          >
            {row.getIsExpanded() ? <span className="rotate-90 inline-block">▶</span> : <span>▶</span>}
          </button>
        ),
      },
      { accessorKey: 'display_id', header: 'ID', cell: DisplayIdCell, size: 80 },
      { accessorKey: 'title', header: 'Title (Element)', cell: TextCell },
      { id: 'options', header: 'Options', cell: OptionsCell, size: 100 },
      // Phase 2: Compound cells (ledger-only, hidden in matrix via columnVisibility)
      { id: 'item_definition', header: 'Item / Description', cell: ItemDefinitionCell, size: 280, enableSorting: false },
      { id: 'cost_classification', header: 'Cost Classification', cell: CostClassificationCell, size: 200, enableSorting: false },
      { id: 'management', header: 'Owner / Schedule', cell: ManagementCell, size: 180, enableSorting: false },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: ImpactCell, aggregatedCell: CostImpactAggregatedCell, aggregationFn: 'sum' },
      { accessorKey: 'days_impact', header: 'Days Impact', cell: ImpactCell, aggregatedCell: DaysImpactAggregatedCell, aggregationFn: 'sum' },
      // ── Ledger Financial Narrative Columns ──────────────────────────────────────
      // Visible only in Budget Ledger view (controlled by isLedgerView → columnVisibility).
      // aggregationFn: 'sum' enables native TanStack rollup for group rows.
      // aggregatedCell renders bold values for group row totals.
      { accessorKey: 'baseline_budget', header: 'Baseline', cell: LedgerFinancialCell, aggregatedCell: LedgerFinancialAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'approved_changes', header: 'Approved Δ', cell: LedgerDeltaCell, aggregatedCell: LedgerDeltaAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'revised_budget', header: 'Revised', cell: LedgerFinancialCell, aggregatedCell: LedgerFinancialAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'pending_changes', header: 'Pending Δ', cell: LedgerDeltaCell, aggregatedCell: LedgerDeltaAggregatedCell, aggregationFn: 'sum', size: 130, enableSorting: false },
      { accessorKey: 'projected_final', header: 'Projected', cell: LedgerProjectedCell, aggregatedCell: LedgerProjectedAggregatedCell, aggregationFn: 'sum', size: 140, enableSorting: false },
      { accessorKey: 'final_direction', header: 'Final Direction', cell: TextCell },
      { id: 'division', accessorFn: (row: Opportunity) => row.division ? row.division.substring(0, 6) : 'Uncategorized', header: 'Division', cell: DivisionCell, size: 120, sortingFn: divisionSort },
      { accessorKey: 'cost_code', header: 'Cost Code', cell: CostCodeCell, size: 150 },
      { accessorKey: 'spec_number_id', header: 'CSI Spec', cell: CsiSpecCell, size: 150 },
      { accessorKey: 'status', header: 'VE Status', cell: StatusCell },
      { accessorKey: 'coordination_status', header: 'Coordination Status', cell: CoordinationStatusCell },
      { accessorKey: 'building_area', header: 'Building Area', cell: BuildingAreaCell },
      { accessorKey: 'priority', header: 'Priority', cell: PriorityCell, sortingFn: prioritySort, size: 100 },
      { accessorKey: 'assignee', header: 'Assigned User', cell: AssigneeCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: TextCell },
      // ── Version Compare Overlay Columns ──────────────────────────────────────
      // Always defined, hidden by default via columnVisibility (Bug #1 fix).
      // Cells only render data for budget lines; VE rows always show — (Bug #2 fix).
      // Data summed across all cost_type rows per cost_code (Bug #8 fix).
      {
        id: 'compare_version_a',
        header: 'Version A',
        cell: ({ row, table }: CellContext<Opportunity, unknown>) => {
          if (!row.original.is_budget_line) {
            return <span className="flex items-center justify-end h-full px-2 text-slate-300 dark:text-slate-600 text-xs">—</span>;
          }
          const entries = (table.options.meta?.comparisonMap ?? {})[row.original.cost_code ?? ''] ?? [];
          const total = entries.reduce((s, e) => s + (Number(e.old_amount) || 0), 0);
          return (
            <div className="px-2 py-1 text-xs text-right tabular-nums text-slate-600 dark:text-slate-300 bg-amber-50/40 dark:bg-amber-900/10 h-full flex items-center justify-end">
              {entries.length > 0
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total)
                : <span className="text-slate-300 dark:text-slate-600">—</span>}
            </div>
          );
        },
        size: 130,
        enableSorting: false,
        enableResizing: false,
      },
      {
        id: 'compare_version_b',
        header: 'Version B',
        cell: ({ row, table }: CellContext<Opportunity, unknown>) => {
          if (!row.original.is_budget_line) {
            return <span className="flex items-center justify-end h-full px-2 text-slate-300 dark:text-slate-600 text-xs">—</span>;
          }
          const entries = (table.options.meta?.comparisonMap ?? {})[row.original.cost_code ?? ''] ?? [];
          const total = entries.reduce((s, e) => s + (Number(e.new_amount) || 0), 0);
          return (
            <div className="px-2 py-1 text-xs text-right tabular-nums text-slate-600 dark:text-slate-300 bg-amber-50/40 dark:bg-amber-900/10 h-full flex items-center justify-end">
              {entries.length > 0
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total)
                : <span className="text-slate-300 dark:text-slate-600">—</span>}
            </div>
          );
        },
        size: 130,
        enableSorting: false,
        enableResizing: false,
      },
      {
        id: 'compare_delta',
        header: 'Δ Delta',
        cell: ({ row, table }: CellContext<Opportunity, unknown>) => {
          if (!row.original.is_budget_line) {
            return <span className="flex items-center justify-end h-full px-2 text-slate-300 dark:text-slate-600 text-xs">—</span>;
          }
          const entries = (table.options.meta?.comparisonMap ?? {})[row.original.cost_code ?? ''] ?? [];
          const delta = entries.reduce((s, e) => s + (Number(e.delta_amount) || 0), 0);
          const colorClass = entries.length === 0
            ? 'text-slate-400'
            : delta < 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
            : delta > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold'
            : 'text-slate-500';
          return (
            <div className={`px-2 py-1 text-xs text-right tabular-nums bg-amber-50/40 dark:bg-amber-900/10 h-full flex items-center justify-end ${colorClass}`}>
              {entries.length > 0
                ? (delta >= 0 ? '+' : '') + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(delta)
                : <span className="text-slate-300 dark:text-slate-600">—</span>}
            </div>
          );
        },
        size: 120,
        enableSorting: false,
        enableResizing: false,
      },
    ],
    [viewMode, checkboxColumn, openPanelColumn]
  );

  return viewMode === 'card' ? cardColumns : flatColumns;
};
