import { useMemo } from 'react';
import { PanelRight } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { TextCell, StatusCell, CoordinationStatusCell, BuildingAreaCell, ImpactCell, PriorityCell, CostCodeCell, CsiSpecCell, DivisionCell, DisplayIdCell, AssigneeCell } from './EditableCell';
import { OptionsCell } from './OptionsCell';
import { InlineOptionCell } from './InlineOptionCell';
import { ColumnDef, Row } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

const CheckboxCell = ({ row }: { row: Row<Opportunity> }) => {
  const isSelected = useUIStore(state => state.compareQueue.includes(row.original.id));
  const toggleCompareItem = useUIStore(state => state.toggleCompareItem);
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

export const useOpportunityColumns = (viewMode: string, maxOptionCount: number = 0): ColumnDef<Opportunity, unknown>[] => {
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
      { accessorKey: 'display_id', header: 'ID', cell: DisplayIdCell, size: 80 },
      { accessorKey: 'title', header: 'Title (Element)', cell: TextCell },
      ...dynamicOptionColumns,
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: ImpactCell, aggregationFn: 'sum' as any },
      { accessorKey: 'days_impact', header: 'Days Impact', cell: ImpactCell, aggregationFn: 'sum' as any },
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
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: ImpactCell },
      { accessorKey: 'days_impact', header: 'Days Impact', cell: ImpactCell },
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
    ],
    [viewMode, checkboxColumn, openPanelColumn]
  );

  return viewMode === 'card' ? cardColumns : flatColumns;
};
