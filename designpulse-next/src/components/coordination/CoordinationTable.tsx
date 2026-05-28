"use client";
import { toast } from 'sonner';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  CellContext,
  SortingState,
  VisibilityState,
  Row,
  RowSelectionState,
  getExpandedRowModel
} from '@tanstack/react-table';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { Map as MapIcon, ChevronDown, ChevronUp, SlidersHorizontal, PanelRight, MessageCirclePlus, Layers } from 'lucide-react';
import { Opportunity, DisciplineConfig, CoordGroupConfig } from '@/types/models';
import { useProjectSettings, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { useUpdateOpportunity, useCreateOpportunity, useDeleteOpportunity, useBulkUpdateCoordinationStatus, useBulkUpdateCoordGroup } from '@/hooks/useOpportunityQueries';
import { useGridNavigation } from '@/hooks/useGridNavigation';
import { TextCell, PriorityCell, BuildingAreaCell, CostCodeCell, CsiSpecCell, DivisionCell } from '@/components/opportunities/EditableCell';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useProjectCsiSpecs } from '@/hooks/useCsiQueries';
import { useUIStore } from '@/stores/useUIStore';
import { hasDescriptionContent } from '@/lib/htmlUtils';
import { GridFilterDrawer } from '@/components/ui/GridFilterDrawer';
import { ColumnChooser } from '@/components/opportunities/ColumnChooser';
import { ExpandedCard } from '@/components/opportunities/ExpandedCard';
import { DEFAULT_DISCIPLINES, DEFAULT_COORD_COLUMN_ORDER, UNASSIGNED_GROUP_ID } from '@/lib/constants';
import { CheckboxCell, CheckboxHeader, DateCell } from '@/components/data-table/cells';
import { BulkActionBar, DeleteConfirmModal, GhostRow, TableEmptyState } from '@/components/data-table';
import { BulkStatusChangeMenu } from './BulkStatusChangeMenu';
import { BulkGroupAssignMenu } from './BulkGroupAssignMenu';
import { CoordinationGroupCell } from './CoordinationGroupCell';
import { CoordinationGroupHeaderRow } from './CoordinationGroupHeaderRow';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
  viewMode?: string;
  filterSlot?: ReactNode;
  filterActiveCount?: number;
  onClearFilters?: () => void;
  // Coordination Groups props
  coordGroups?: CoordGroupConfig[];
  onGroupsChange?: (groups: CoordGroupConfig[]) => void;
  /** Active group filter IDs — Ghost Row inherits coord_group_id when exactly 1 group is active */
  activeGroupIds?: string[];
}

// Module-level stable empty array for Zustand selector stability (deep-review Issue 9)
const EMPTY_COLLAPSED_ARRAY: string[] = [];
// Module-level stable empty array for coordGroups default (Rule C47 — Issue A)
const EMPTY_GROUPS: CoordGroupConfig[] = [];

// Custom Discipline Status Cell
{/* eslint-disable-next-line react/display-name */}
const DisciplineStatusCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  // [C-6 FIX] Read from meta (derived once in parent) instead of calling
  // useProjectSettings inside every virtualized row — prevents N subscriber registrations.
  const disciplines: DisciplineConfig[] = table.options.meta?.disciplines || DEFAULT_DISCIPLINES;
  const coordDetails = row.original.coordination_details || {};

  return (
    <div className="flex gap-1 items-center px-2 py-1 h-full cursor-default">
      {disciplines.map((d: DisciplineConfig) => {
        // CoordinationDetailsMap values are DisciplineDetails | boolean. Guard against is_escalated boolean.
        const rawEntry = (coordDetails as Record<string, unknown>)[d.id];
        const disciplineEntry = (typeof rawEntry === 'object' && rawEntry !== null && 'status' in rawEntry)
          ? rawEntry as { status: string }
          : null;
        const status = disciplineEntry?.status || 'Not Required';
        if (status === 'Not Required') return null;
        
        const isCompleted = status === 'Complete';
        const isPending = status === 'Pending' || status === 'Required';
        
        let colorClass = 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
        if (isCompleted) colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
        else if (isPending) colorClass = 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';

        return (
          <div 
            key={d.id} 
            title={`${d.label}: ${status}`} 
            className={`flex items-center justify-center w-5 h-5 rounded border text-[10px] font-bold ${colorClass}`}
          >
            {d.label.charAt(0).toUpperCase()}
          </div>
        );
      })}
      {disciplines.every((d: DisciplineConfig) => {
        const rawD = (coordDetails as Record<string, unknown>)[d.id];
        const s = (typeof rawD === 'object' && rawD !== null && 'status' in rawD) ? (rawD as { status: string }).status : 'Not Required';
        return s === 'Not Required';
      }) && (
        <span className="text-xs text-slate-400 italic">No tasks</span>
      )}
    </div>
  );
});

{/* eslint-disable-next-line react/display-name */}
const CoordinationStatusCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string;
  const updateData = table.options.meta?.updateData;
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);

  if (isCellActive) {
    return (
      <div className="w-full h-full p-0 flex">
        <select
          value={initialValue || 'Draft'}
          onChange={e => {
            if (updateData && e.target.value !== initialValue) {
              updateData.mutate({ id: row.original.id, updates: { [column.id]: e.target.value } });
            }
            setActiveCell(null);
          }}
          onBlur={() => {
            if (isCellActive) setActiveCell(null);
          }}
          autoFocus
          className="w-full h-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-sky-500 rounded outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100"
        >
          <option value="Draft">Draft</option>
          <option value="In Drafting">In Drafting</option>
          <option value="Ready for Review">Ready for Review</option>
          <option value="Implemented">Implemented</option>
          <option value="Not Applicable">Not Applicable</option>
        </select>
      </div>
    );
  }

  let colorClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  if (initialValue === 'In Drafting') colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  else if (initialValue === 'Ready for Review') colorClass = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  else if (initialValue === 'Implemented') colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  else if (initialValue === 'Not Applicable') colorClass = 'bg-slate-200 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400 border border-slate-300 dark:border-slate-600';

  return (
    <div 
      className="w-full h-full px-2 py-1.5 flex items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 group"
      onClick={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
    >
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass} group-hover:ring-1 group-hover:ring-slate-300 dark:group-hover:ring-slate-600`}>
        {initialValue || 'Draft'}
      </span>
    </div>
  );
});

// CheckboxCell is now imported from @/components/data-table/cells
// Uses TanStack native rowSelection instead of Zustand compareQueue

const OpenPanelCell = ({ row }: { row: Row<Opportunity> }) => {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const coordinationViewMode = useUIStore(state => state.coordinationViewMode);
  const setCoordinationViewMode = useUIStore(state => state.setCoordinationViewMode);
  return (
    <div className="flex items-center justify-center p-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (selectedOpportunityId === row.original.id) {
            setSelectedOpportunityId(null);
          } else {
            setSelectedOpportunityId(row.original.id);
            // Deep-review Issue 1: only switch to split when in board mode;
            // in groups mode, keep the groups layout and just open the panel.
            if (coordinationViewMode === 'board') {
              setCoordinationViewMode('table-split');
            }
          }
        }}
        className={`p-1 rounded transition-colors ${
          selectedOpportunityId === row.original.id 
            ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' 
            : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30'
        }`}
        title="Open Details Panel"
      >
        <PanelRight size={20} />
      </button>
    </div>
  );
};

const NotesIndicatorCell = ({ row }: { row: Row<Opportunity> }) => {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const setFocusDetailSection = useUIStore(state => state.setFocusDetailSection);
  const coordinationViewMode = useUIStore(state => state.coordinationViewMode);
  const setCoordinationViewMode = useUIStore(state => state.setCoordinationViewMode);

  const hasContent = hasDescriptionContent(row.original.description);

  return (
    <div className="flex items-center justify-center p-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (selectedOpportunityId === row.original.id) {
            // Already viewing this item — just signal to scroll to description
            setFocusDetailSection('description');
          } else {
            setSelectedOpportunityId(row.original.id);
            setFocusDetailSection('description');
            if (coordinationViewMode === 'board') {
              setCoordinationViewMode('table-split');
            }
          }
        }}
        className={`p-1 rounded transition-colors ${
          hasContent
            ? 'text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30'
            : 'text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
        title={hasContent ? 'View notes' : 'Add notes'}
      >
        <MessageCirclePlus size={18} />
      </button>
    </div>
  );
};

// eslint-disable-next-line react/display-name
const MemoizedCoordinationRow = React.memo(({ 
  row, 
  virtualRow, 
  selectedOpportunityId, 
  viewMode,
  measureElement,
  isRowSelected,
  groupColor,
}: { 
  row: Row<Opportunity>; 
  virtualRow: VirtualItem; 
  selectedOpportunityId: string | null; 
  viewMode: string;
  measureElement: (element: Element | null) => void;
  visibleColumnIds: string;
  pinnedColumnOffsets: string;
  isRowSelected: boolean;
  groupColor?: string;
}) => {
  return (
    <tbody 
      ref={measureElement}
      data-index={virtualRow.index}
      className="border-b border-slate-100 dark:border-slate-800/50"
    >
      <tr 
        id={`row-${row.original.id}`}
        data-selected={isRowSelected}
        className={`group transition-colors ${
          row.original.id === selectedOpportunityId 
            ? 'bg-sky-50 dark:bg-sky-900/20 border-l-2 border-sky-500' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        style={groupColor ? { borderLeft: `4px solid ${groupColor}` } : undefined}
      >
        {row.getVisibleCells().map((cell) => {
          const isPinned = cell.column.getIsPinned() === 'left';
          const isLastPinned = isPinned && cell.column.getIsLastColumn('left');
          const isHighlighted = row.original.id === selectedOpportunityId;
          return (
            <td
              key={cell.id}
              className={`p-0 h-[1px] border-r border-b border-slate-200 dark:border-slate-800 align-top bg-clip-padding${
                isPinned
                  ? ` sticky z-[8] ${
                      isHighlighted
                        ? 'bg-sky-50 dark:bg-sky-900/20'
                        : 'bg-white dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                    }`
                  : ''
              }${isLastPinned ? ' shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2' : ''}`}
              style={isPinned ? { left: cell.column.getStart('left') } : {}}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
      {viewMode === 'card' && row.getIsExpanded() && (
        <tr>
          <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-slate-100 dark:border-slate-800/50">
            <ExpandedCard row={row} />
          </td>
        </tr>
      )}
    </tbody>
  );
}, (prevProps, nextProps) => {
  if (prevProps.row.original !== nextProps.row.original) return false;
  if (prevProps.selectedOpportunityId !== nextProps.selectedOpportunityId) return false;
  if (prevProps.viewMode !== nextProps.viewMode) return false;
  if (prevProps.visibleColumnIds !== nextProps.visibleColumnIds) return false;
  if (prevProps.pinnedColumnOffsets !== nextProps.pinnedColumnOffsets) return false;
  if (prevProps.row.getIsExpanded() !== nextProps.row.getIsExpanded()) return false;
  if (prevProps.isRowSelected !== nextProps.isRowSelected) return false;
  if (prevProps.groupColor !== nextProps.groupColor) return false;
  return true;
});

export default function CoordinationTable({ projectId, opportunities, viewMode = 'flat', filterSlot, filterActiveCount = 0, onClearFilters, coordGroups = EMPTY_GROUPS, onGroupsChange, activeGroupIds = [] }: Props) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const toggleMapVisibility = useUIStore(state => state.toggleMapVisibility);
  const isMapVisible = useUIStore(state => state.isMapVisible);

  // Inline grouping toggle — read from store (v21: merged from Groups view mode)
  const isGroupsMode = useUIStore(state => state.isCoordGroupingEnabled);
  const toggleCoordGrouping = useUIStore(state => state.toggleCoordGrouping);

  // [C-6 FIX] Derive shared cell data once at the parent level.
  // Virtualized cells read from meta instead of each registering their own subscriber.
  const { data: settings } = useProjectSettings(projectId);
  const disciplines: DisciplineConfig[] = useMemo(() => {
    const raw = settings?.disciplines;
    return Array.isArray(raw)
      ? raw.map((d: any) => typeof d === 'string' ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d } : d)
      : DEFAULT_DISCIPLINES;
  }, [settings?.disciplines]);
  const buildingAreas = useMemo(
    () => (settings?.building_areas as string[]) || ['Corridor / Common', 'Unit Interiors', 'Back of House'],
    [settings?.building_areas]
  );

  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const deleteMutation = useDeleteOpportunity(projectId);
  const bulkUpdateMutation = useBulkUpdateCoordinationStatus(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);
  const { data: rawCostCodes = [] } = useCostCodes();
  const { data: csiSpecs = [] } = useProjectCsiSpecs(projectId);

  const bulkGroupMutation = useBulkUpdateCoordGroup(projectId);
  const [isBulkGroupUpdating, setIsBulkGroupUpdating] = useState(false);

  // TanStack native row selection — replaces Zustand compareQueue
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const selectedRows = useMemo(
    () => Object.keys(rowSelection).filter(id => rowSelection[id]),
    [rowSelection]
  );
  const clearSelection = useCallback(() => setRowSelection({}), []);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedRows.length === 0) return;

    // Filter to isolate only pure coordination tasks and exclude pushed VE items
    const coordinationIds = selectedRows.filter(id => {
      const opp = opportunities.find(o => o.id === id);
      return opp && opp.record_type === 'Coordination';
    });

    const skippedCount = selectedRows.length - coordinationIds.length;

    if (coordinationIds.length === 0) {
      toast.warning('No coordination tasks selected. Pushed VE items cannot be bulk-updated.');
      return;
    }

    setIsBulkUpdating(true);
    try {
      await bulkUpdateMutation.mutateAsync({
        ids: coordinationIds,
        newStatus,
      });

      if (skippedCount > 0) {
        toast.success(`Successfully updated status for ${coordinationIds.length} task(s) to "${newStatus}"; skipped ${skippedCount} pushed VE item(s).`);
      } else {
        toast.success(`Successfully updated status for ${coordinationIds.length} task(s) to "${newStatus}"`);
      }

      clearSelection();
    } catch (error: any) {
      console.error('Failed to bulk update coordination status:', error);
      toast.error(`Status update failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkGroupAssign = async (groupId: string | null) => {
    if (selectedRows.length === 0) return;
    setIsBulkGroupUpdating(true);
    try {
      await bulkGroupMutation.mutateAsync({ ids: selectedRows, groupId });
      const label = groupId
        ? coordGroups.find(g => g.id === groupId)?.label ?? 'group'
        : 'Unassigned';
      toast.success(`Assigned ${selectedRows.length} item(s) to "${label}"`);
      clearSelection();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Group assignment failed: ${errMsg}`);
      // Selection is NOT cleared on failure (deep-review Issue 14)
    } finally {
      setIsBulkGroupUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    // Pre-flight: separate locked (Approved) items from deletable ones.
    // The DB trigger enforce_financial_immutability blocks soft-delete on Approved rows.
    const lockedIds: string[] = [];
    const deletableIds: string[] = [];
    for (const id of selectedRows) {
      const row = rows.find(r => r.original.id === id);
      if (row?.original.status === 'Approved') {
        lockedIds.push(id);
      } else {
        deletableIds.push(id);
      }
    }

    if (lockedIds.length > 0 && deletableIds.length === 0) {
      toast.error(`Cannot delete ${lockedIds.length} locked item${lockedIds.length > 1 ? 's' : ''}. Unlock the contender first.`);
      setIsDeleteModalOpen(false);
      return;
    }

    if (lockedIds.length > 0) {
      toast.warning(`${lockedIds.length} locked item${lockedIds.length > 1 ? 's were' : ' was'} skipped — unlock the contender first.`);
    }

    setIsDeleting(true);
    try {
      for (const id of deletableIds) {
        await deleteMutation.mutateAsync(id);
      }
      clearSelection();
      setIsDeleteModalOpen(false);
    } catch (error: any) {
      console.error('Failed to bulk delete:', error);
      toast.error(`Delete failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
const EMPTY_VISIBILITY: VisibilityState = {};

  const coordColumnVisibility = useUIStore(state => state.coordColumnVisibility[projectId] || EMPTY_VISIBILITY);
  const _setCoordColumnVisibility = useUIStore(state => state.setCoordColumnVisibility);
  const setCoordColumnVisibility = React.useCallback(
    (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => _setCoordColumnVisibility(projectId, updater), 
    [projectId, _setCoordColumnVisibility]
  );

  const coordColumnOrder = useUIStore(state => state.coordColumnOrder[projectId] || DEFAULT_COORD_COLUMN_ORDER as unknown as string[]);
  const _setCoordColumnOrder = useUIStore(state => state.setCoordColumnOrder);
  const setCoordColumnOrder = React.useCallback(
    (updater: string[] | ((old: string[]) => string[])) => _setCoordColumnOrder(projectId, updater), 
    [projectId, _setCoordColumnOrder]
  );

  // Pin wiring: read user overrides from the shared store slice (same key as VE Matrix / OpportunityGridV2)
  const userPinningOverrides = useUIStore(
    state => state.gridColumnPinningOverrides[projectId]
  ) ?? { pinned: [], unpinned: [] };

  const columnPinning = useMemo(() => {
    // select + open_panel are always pinned regardless of user overrides
    const alwaysPinned = ['select', 'open_panel'];
    const allPinned = new Set([...alwaysPinned, ...userPinningOverrides.pinned]);
    userPinningOverrides.unpinned.forEach(id => allPinned.delete(id));
    // Re-add always-pinned after clearing overrides so stale localStorage cannot unpin them
    alwaysPinned.forEach(id => allPinned.add(id));
    return { left: Array.from(allPinned) };
  }, [userPinningOverrides]);

  useEffect(() => {
    if (selectedOpportunityId) {
      const element = document.getElementById(`row-${selectedOpportunityId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedOpportunityId]);

  const columns = useMemo<ColumnDef<Opportunity, unknown>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <CheckboxHeader table={table} disabled={!permissions.can_edit_records} />,
      cell: (info) => <CheckboxCell info={info} disabled={!permissions.can_edit_records} />,
      size: 40,
    },
    {
      id: 'open_panel',
      header: () => null,
      size: 40,
      cell: OpenPanelCell,
    },
    {
      accessorKey: 'display_id',
      header: 'ID',
      size: 80,
      cell: ({ getValue, row }: CellContext<Opportunity, unknown>) => {
        const value = getValue<string>();
        const recordType = row.original.record_type || 'Coordination';
        const badgeClass = recordType === 'Coordination'
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
        const titleText = recordType === 'Coordination' ? 'Design Coordination item' : 'Value Engineering item';
        return (
          <div className="px-2 py-1.5 flex items-center h-full">
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${badgeClass}`} title={titleText}>
              {value}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'record_type',
      header: 'Type',
      size: 130,
      cell: ({ getValue }) => {
        const type = getValue<string>() || 'VE';
        return (
          <div className="px-2 py-1 h-full flex items-center">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              type === 'Coordination' 
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
            }`}>
              {type}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: 'building_area',
      header: 'Building Area',
      size: 150,
      cell: BuildingAreaCell,
    },
    {
      accessorKey: 'title',
      header: 'Task / Item',
      size: 400,
      cell: TextCell,
    },
    {
      id: 'notes_indicator',
      header: 'Notes',
      size: 40,
      cell: ({ row }: CellContext<Opportunity, unknown>) => <NotesIndicatorCell row={row} />,
      enableSorting: false,
      enableResizing: false,
    },
    {
      accessorKey: 'final_direction',
      header: 'Final Selection',
      size: 200,
      cell: ({ getValue }) => {
        const val = getValue<string>();
        if (!val) return <div className="px-2 py-1.5 text-xs text-slate-400">--</div>;
        const displayVal = val.startsWith('Locked: ') ? val.substring(8) : val;
        return (
          <div className="px-2 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 truncate" title={displayVal}>
            {displayVal}
          </div>
        );
      }
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      size: 100,
      cell: PriorityCell,
    },
    {
      accessorKey: 'division',
      header: 'Division',
      size: 200,
      cell: DivisionCell,
    },
    {
      accessorKey: 'cost_code',
      header: 'Cost Code',
      size: 150,
      cell: CostCodeCell,
    },
    {
      accessorKey: 'spec_number_id',
      header: 'CSI Spec',
      size: 150,
      cell: CsiSpecCell,
    },
    {
      accessorKey: 'coordination_status',
      header: 'Status',
      size: 140,
      cell: CoordinationStatusCell,
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      size: 120,
      cell: DateCell,
    },
    {
      id: 'discipline_status',
      header: 'Disciplines',
      size: 150,
      cell: DisciplineStatusCell,
    },
    {
      id: 'coord_group',
      header: 'Group',
      size: 140,
      cell: CoordinationGroupCell,
      enableSorting: true,
      enableResizing: true,
    }
  ], [permissions]);

  const activeColumns = useMemo(() => {
    if (!settings?.coord_column_order || typeof settings.coord_column_order[0] === 'string') return columns;
    const hiddenIds = settings.coord_column_order.filter((c: any) => c.visible === false).map((c: any) => c.id);
    return columns.filter((c: any) => {
      const id = c.accessorKey || c.id;
      return !hiddenIds.includes(id);
    });
  }, [columns, settings?.coord_column_order]);

  useEffect(() => {
    if (settings?.coord_column_order && settings.coord_column_order.length > 0) {
      const savedOrder = settings.coord_column_order;
      const configuredIds = typeof savedOrder[0] === 'string' ? savedOrder : savedOrder.map((c: any) => c.id);
      
      const allColIds = activeColumns.map((c: any) => c.accessorKey || c.id).filter(Boolean);
      
      const leftPinnedSet = new Set(columnPinning.left);
      const pinnedFront = allColIds.filter(id => leftPinnedSet.has(id));
      
      const unconfiguredIds = allColIds.filter(id => !configuredIds.includes(id as string) && !leftPinnedSet.has(id as string));
      const activeConfiguredIds = configuredIds.filter((id: string) => allColIds.includes(id) && !leftPinnedSet.has(id));
      
      const newOrder = [...pinnedFront, ...activeConfiguredIds, ...unconfiguredIds] as string[];
      
      const isDifferent = 
        newOrder.length !== coordColumnOrder.length ||
        newOrder.some((val, idx) => val !== coordColumnOrder[idx]);

      if (isDifferent) {
        setCoordColumnOrder(newOrder);
      }
    }
  }, [settings?.coord_column_order, activeColumns, setCoordColumnOrder, columnPinning, coordColumnOrder]);

  const moveActiveCellRef = useRef<((direction: 'down' | 'right' | 'left' | 'up') => void) | null>(null);

  const table = useReactTable({
    data: opportunities,
    columns: activeColumns,
    state: { sorting, globalFilter, columnVisibility: coordColumnVisibility, columnOrder: coordColumnOrder, rowSelection, columnPinning },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setCoordColumnVisibility,
    onColumnOrderChange: setCoordColumnOrder,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    meta: {
      updateData: updateMutation,
      projectId,
      permissions,
      rawCostCodes,
      csiSpecs,
      moveActiveCellRef,
      disciplines,
      buildingAreas,
      coordGroups,
      onGroupsChange,
      isGroupsMode,
    }
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44, // Base height
    overscan: 5,
  });

  // Groups mode: collapsed state + per-row group color lookup
  const collapsedGroupIds = useUIStore(
    (s) => s.coordGroupCollapsed[projectId] ?? EMPTY_COLLAPSED_ARRAY
  );
  const toggleGroupCollapsed = useUIStore(s => s.toggleCoordGroupCollapsed);

  // Memoized single-pass O(n) group bucketing (Fix 3)
  const sortedGroups = useMemo(() =>
    [...coordGroups].sort((a, b) => a.order - b.order),
    [coordGroups]
  );

  const groupedRows = useMemo(() => {
    if (!isGroupsMode) return null;
    const bucketMap = new Map<string, Row<Opportunity>[]>();
    const unassigned: Row<Opportunity>[] = [];
    for (const row of rows) {
      const gid = row.original.coord_group_id;
      if (!gid) { unassigned.push(row); continue; }
      const bucket = bucketMap.get(gid);
      if (bucket) bucket.push(row);
      else bucketMap.set(gid, [row]);
    }
    return {
      unassigned,
      groups: sortedGroups.map(g => ({ group: g, rows: bucketMap.get(g.id) ?? [] })),
    };
  }, [isGroupsMode, rows, sortedGroups]);

  useEffect(() => {
    if (selectedOpportunityId) {
      const index = rows.findIndex(r => r.original.id === selectedOpportunityId);
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'center' });
      }
    }
  }, [selectedOpportunityId, rows, virtualizer]);

  const { handleKeyDown, moveActiveCell } = useGridNavigation(table as any, virtualizer);
  moveActiveCellRef.current = moveActiveCell; // [C-5 FIX] ref assignment, never mutate meta inline

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 rounded-b-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative flex flex-col">
        
        {/* no overflow-hidden: MultiSelectFilter popover is z-[100] and must escape this container */}
        <div className="flex items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 z-20">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">Coordination List</span>
            <input 
              type="text"
              placeholder="Search tasks..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 w-64"
            />
          </div>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />
          <div className="flex items-center gap-2 ml-auto shrink-0">
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
              onClick={toggleCoordGrouping}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isGroupsMode
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Layers size={15} />
              <span>Group</span>
            </button>
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
          className="flex-1 min-h-0 overflow-auto rounded-b-xl outline-none"
          tabIndex={0}
          onKeyDown={(e) => {
            if (handleKeyDown) handleKeyDown(e as any);
          }}
        >
          <table 
            className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0" 
            style={{ tableLayout: 'fixed', minWidth: table.getTotalSize() }}
          >
            <thead className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th 
                      key={header.id} 
                      className={`relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 select-none group bg-slate-100 dark:bg-slate-900${
                        header.column.getIsPinned() === 'left' ? ' sticky z-[12]' : ''
                      }${header.column.getIsLastColumn('left') ? ' shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] border-r-2' : ''}`}
                      style={{
                        width: header.getSize(),
                        ...(header.column.getIsPinned() === 'left' ? { left: header.column.getStart('left') } : {}),
                      }}
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
                  ))}
                </tr>
              ))}
            </thead>
            
            {/* ── Groups Mode or Flat Mode Rendering ── */}
            {isGroupsMode && groupedRows ? (() => {
              const visibleCols = table.getVisibleFlatColumns();
              const totalWidth = table.getTotalSize();

              return (
                <>
                  {/* Unassigned group */}
                  {groupedRows.unassigned.length > 0 && (
                    <>
                      <CoordinationGroupHeaderRow
                        group={null}
                        groupId={UNASSIGNED_GROUP_ID}
                        itemCount={groupedRows.unassigned.length}
                        isCollapsed={collapsedGroupIds.includes(UNASSIGNED_GROUP_ID)}
                        onToggle={() => toggleGroupCollapsed(projectId, UNASSIGNED_GROUP_ID)}
                        onRename={() => {}}
                        onColorChange={() => {}}
                        onSelectAll={() => {
                          const sel: RowSelectionState = {};
                          groupedRows.unassigned.forEach(r => { sel[r.id] = true; });
                          setRowSelection(prev => ({ ...prev, ...sel }));
                        }}
                        onDelete={() => {}}
                        totalWidth={totalWidth}
                        visibleColumnCount={visibleCols.length}
                      />
                      {!collapsedGroupIds.includes(UNASSIGNED_GROUP_ID) && groupedRows.unassigned.map(row => {
                        const visibleColumnIds = row.getVisibleCells().map(c => c.column.id).join(',');
                        const pinnedColumnOffsets = row.getVisibleCells()
                          .filter(c => c.column.getIsPinned())
                          .map(c => c.column.getStart('left'))
                          .join(',');
                        return (
                          <MemoizedCoordinationRow
                            key={row.id}
                            row={row}
                            virtualRow={{ index: row.index, start: 0, end: 44, size: 44, key: row.id, lane: 0 }}
                            selectedOpportunityId={selectedOpportunityId}
                            viewMode={viewMode}
                            measureElement={() => {}}
                            visibleColumnIds={visibleColumnIds}
                            pinnedColumnOffsets={pinnedColumnOffsets}
                            isRowSelected={row.getIsSelected()}
                            groupColor="#94a3b8"
                          />
                        );
                      })}
                    </>
                  )}

                  {/* User-defined groups — all groups shown, empty groups get placeholder (Fix 4) */}
                  {groupedRows.groups.map(({ group, rows: groupRows }) => (
                    <React.Fragment key={group.id}>
                      <CoordinationGroupHeaderRow
                        group={group}
                        groupId={group.id}
                        itemCount={groupRows.length}
                        isCollapsed={collapsedGroupIds.includes(group.id)}
                        onToggle={() => toggleGroupCollapsed(projectId, group.id)}
                        onRename={(newLabel) => {
                          if (!onGroupsChange) return;
                          onGroupsChange(coordGroups.map(g => g.id === group.id ? { ...g, label: newLabel } : g));
                        }}
                        onColorChange={(newColor) => {
                          if (!onGroupsChange) return;
                          onGroupsChange(coordGroups.map(g => g.id === group.id ? { ...g, color: newColor } : g));
                        }}
                        onSelectAll={() => {
                          const sel: RowSelectionState = {};
                          groupRows.forEach(r => { sel[r.id] = true; });
                          setRowSelection(prev => ({ ...prev, ...sel }));
                        }}
                        onDelete={() => {
                          if (!onGroupsChange) return;
                          const ids = groupRows.map(r => r.original.id);
                          if (ids.length > 0) {
                            bulkGroupMutation.mutate({ ids, groupId: null });
                          }
                          onGroupsChange(coordGroups.filter(g => g.id !== group.id));
                        }}
                        totalWidth={totalWidth}
                        visibleColumnCount={visibleCols.length}
                      />
                      {!collapsedGroupIds.includes(group.id) && groupRows.length === 0 && (
                        <tbody><tr>
                          <td colSpan={visibleCols.length} className="px-8 py-3 text-xs text-slate-400 dark:text-slate-500 italic" style={{ minWidth: totalWidth }}>
                            No items in this group
                          </td>
                        </tr></tbody>
                      )}
                      {!collapsedGroupIds.includes(group.id) && groupRows.map(row => {
                        const visibleColumnIds = row.getVisibleCells().map(c => c.column.id).join(',');
                        const pinnedColumnOffsets = row.getVisibleCells()
                          .filter(c => c.column.getIsPinned())
                          .map(c => c.column.getStart('left'))
                          .join(',');
                        return (
                          <MemoizedCoordinationRow
                            key={row.id}
                            row={row}
                            virtualRow={{ index: row.index, start: 0, end: 44, size: 44, key: row.id, lane: 0 }}
                            selectedOpportunityId={selectedOpportunityId}
                            viewMode={viewMode}
                            measureElement={() => {}}
                            visibleColumnIds={visibleColumnIds}
                            pinnedColumnOffsets={pinnedColumnOffsets}
                            isRowSelected={row.getIsSelected()}
                            groupColor={group.color}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}

                  {/* GhostRow at the bottom */}
                  <tbody>
                    {permissions.can_edit_records && (
                      <GhostRow
                        table={table as any}
                        createMutation={createMutation}
                        placeholder="+ Add Item..."
                        defaultValues={{
                          record_type: 'Coordination',
                          cost_impact: 0,
                          days_impact: 0,
                          status: 'Draft',
                          coordination_status: 'Draft',
                          priority: 'Set Priority',
                        }}
                        staticFields={[
                          { columnId: 'display_id', displayValue: '-' },
                          { columnId: 'record_type', displayValue: '-' },
                        ]}
                        onSubmit={(title) => {
                          const inheritedGroupId = activeGroupIds.length === 1 ? activeGroupIds[0] : undefined;
                          return {
                            title,
                            record_type: 'Coordination',
                            cost_impact: 0,
                            days_impact: 0,
                            status: 'Draft',
                            coordination_status: 'Draft',
                            priority: 'Set Priority',
                            ...(inheritedGroupId && inheritedGroupId !== UNASSIGNED_GROUP_ID ? { coord_group_id: inheritedGroupId } : {}),
                          };
                        }}
                      />
                    )}
                  </tbody>
                </>
              );
            })() : (
              <>
                {paddingTop > 0 && (
                  <tbody><tr><td style={{ height: `${paddingTop}px` }} colSpan={columns.length} /></tr></tbody>
                )}

                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  const visibleColumnIds = row.getVisibleCells().map(c => c.column.id).join(',');
                  const pinnedColumnOffsets = row.getVisibleCells()
                    .filter(c => c.column.getIsPinned())
                    .map(c => c.column.getStart('left'))
                    .join(',');
                  return (
                    <MemoizedCoordinationRow
                      key={row.id}
                      row={row}
                      virtualRow={virtualRow}
                      selectedOpportunityId={selectedOpportunityId}
                      viewMode={viewMode}
                      measureElement={virtualizer.measureElement}
                      visibleColumnIds={visibleColumnIds}
                      pinnedColumnOffsets={pinnedColumnOffsets}
                      isRowSelected={row.getIsSelected()}
                    />
                  );
                })}

                {paddingBottom > 0 && (
                  <tbody><tr><td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} /></tr></tbody>
                )}

                {opportunities.length === 0 && (
                  <tbody>
                    <TableEmptyState
                      colSpan={columns.length}
                      message="No items in Coordination Items. Add one below!"
                    />
                  </tbody>
                )}

                <tbody>
                  {permissions.can_edit_records && (
                    <GhostRow
                      table={table as any}
                      createMutation={createMutation}
                      placeholder="+ Add Item..."
                      defaultValues={{
                        record_type: 'Coordination',
                        cost_impact: 0,
                        days_impact: 0,
                        status: 'Draft',
                        coordination_status: 'Draft',
                        priority: 'Set Priority',
                      }}
                      staticFields={[
                        { columnId: 'display_id', displayValue: '-' },
                        { columnId: 'record_type', displayValue: '-' },
                      ]}
                      onSubmit={(title) => {
                        const inheritedGroupId = activeGroupIds.length === 1 ? activeGroupIds[0] : undefined;
                        return {
                          title,
                          record_type: 'Coordination',
                          cost_impact: 0,
                          days_impact: 0,
                          status: 'Draft',
                          coordination_status: 'Draft',
                          priority: 'Set Priority',
                          ...(inheritedGroupId && inheritedGroupId !== UNASSIGNED_GROUP_ID ? { coord_group_id: inheritedGroupId } : {}),
                        };
                      }}
                    />
                  )}
                </tbody>
              </>
            )}
          </table>

          <BulkActionBar
            selectedCount={selectedRows.length}
            entityLabel="Tasks"
            onClear={clearSelection}
            onDelete={() => setIsDeleteModalOpen(true)}
            canDelete={permissions.can_delete_records}
            extraActions={
              <>
                <BulkStatusChangeMenu
                  selectedCount={selectedRows.length}
                  onStatusSelect={handleBulkStatusChange}
                  isUpdating={isBulkUpdating}
                />
                {isGroupsMode && (
                  <BulkGroupAssignMenu
                    selectedCount={selectedRows.length}
                    coordGroups={coordGroups}
                    onGroupSelect={handleBulkGroupAssign}
                    isUpdating={isBulkGroupUpdating}
                  />
                )}
              </>
            }
          />
        </div>

        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleBulkDelete}
          isDeleting={isDeleting}
          count={selectedRows.length}
          entityName="Tasks"
          description="Are you sure you want to delete these coordination tasks? This action will move them to the trash."
        />

      </div>
    </div>
  );
}
