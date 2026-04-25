import React, { useMemo } from 'react';
import { PanelRight } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { TextCell, StatusCell, ScopeCell, ImpactCell, PriorityCell } from './EditableCell';
import { OptionsCell } from './OptionsCell';
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

export const useOpportunityColumns = (viewMode: string): ColumnDef<Opportunity, unknown>[] => {
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

  const flatColumns: ColumnDef<Opportunity, unknown>[] = useMemo(
    () => [
      checkboxColumn,
      ...(viewMode === 'split' ? [openPanelColumn] : []),
      { accessorKey: 'display_id', header: 'ID', cell: TextCell, size: 80 },
      { accessorKey: 'title', header: 'Title (Element)', cell: TextCell },
      { accessorKey: 'priority', header: 'Priority', cell: PriorityCell, sortingFn: prioritySort, size: 100 },
      { accessorKey: 'location', header: 'Location', cell: TextCell },
      { accessorKey: 'scope', header: 'Scope', cell: ScopeCell },
      { accessorKey: 'arch_plans_spec', header: 'Arch Plans/Spec', cell: TextCell },
      { accessorKey: 'bok_standard', header: 'BOK Standard', cell: TextCell },
      { accessorKey: 'existing_conditions', header: 'Existing Conditions', cell: TextCell },
      { accessorKey: 'mep_impact', header: 'MEP Impact', cell: TextCell },
      { accessorKey: 'owner_goals', header: 'Owner Goals', cell: TextCell },
      { accessorKey: 'backing_required', header: 'Backing Req.', cell: TextCell },
      { accessorKey: 'coordination_required', header: 'Coord Req.', cell: TextCell },
      { accessorKey: 'design_lock_phase', header: 'Design Lock Phase', cell: TextCell },
      { accessorKey: 'final_direction', header: 'Final Direction', cell: TextCell },
      { accessorKey: 'assignee', header: 'Assignee', cell: TextCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: TextCell },
      { accessorKey: 'status', header: 'Status', cell: StatusCell },
      { id: 'options', header: 'Options', cell: OptionsCell, size: 100 },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: ImpactCell },
    ],
    [viewMode, checkboxColumn, openPanelColumn]
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
      { accessorKey: 'display_id', header: 'ID', cell: TextCell, size: 80 },
      { accessorKey: 'title', header: 'Title (Element)', cell: TextCell },
      { accessorKey: 'priority', header: 'Priority', cell: PriorityCell, sortingFn: prioritySort, size: 100 },
      { accessorKey: 'location', header: 'Location', cell: TextCell },
      { accessorKey: 'assignee', header: 'Assignee', cell: TextCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: TextCell },
      { accessorKey: 'status', header: 'Status', cell: StatusCell },
      { id: 'options', header: 'Options', cell: OptionsCell, size: 100 },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: ImpactCell },
    ],
    [viewMode, checkboxColumn, openPanelColumn]
  );

  return viewMode === 'card' ? cardColumns : flatColumns;
};
