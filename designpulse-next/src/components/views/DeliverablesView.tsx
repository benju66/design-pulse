"use client";
import { useMemo, useCallback } from 'react';
import { List, LayoutGrid, Plus, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import DeliverableBoard from '@/components/deliverables/DeliverableBoard';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { useDeliverables, useCreateDeliverable } from '@/hooks/useDeliverableQueries';
import { useUIStore, DeliverableFilters } from '@/stores/useUIStore';

const EMPTY_DELIVERABLE_FILTERS: DeliverableFilters = {};

interface DeliverablesViewProps {
  projectId: string;
}

export function DeliverablesView({ projectId }: DeliverablesViewProps) {
  // ── Queries & Mutations ──
  const { data: deliverables = [], isLoading } = useDeliverables(projectId);
  const createDeliverableMutation = useCreateDeliverable(projectId);

  // ── UI Store states & actions ──
  const deliverablesViewMode = useUIStore(state => state.deliverablesViewMode);
  const setDeliverablesViewMode = useUIStore(state => state.setDeliverablesViewMode);

  const deliverablesFilters = useUIStore(state => state.deliverablesFilters[projectId] || EMPTY_DELIVERABLE_FILTERS);
  const _setDeliverablesFilters = useUIStore(state => state.setDeliverablesFilters);
  
  const setDeliverablesFilters = useCallback(
    (filters: DeliverableFilters) => _setDeliverablesFilters(projectId, filters),
    [projectId, _setDeliverablesFilters]
  );

  // ── Filtering Logic ──
  const filteredDeliverables = useMemo(() => {
    return deliverables.filter(deliverable => {
      // Status Filter
      if (deliverablesFilters.status?.length && !deliverablesFilters.status.includes(deliverable.status)) {
        return false;
      }
      // Key Dates Filter
      if (deliverablesFilters.isKeyDate && !deliverable.is_elevated_key_date) {
        return false;
      }
      return true;
    });
  }, [deliverables, deliverablesFilters]);



  const filterActiveCount = useMemo(() => {
    return (deliverablesFilters.status?.length || 0) + (deliverablesFilters.isKeyDate ? 1 : 0);
  }, [deliverablesFilters]);

  const onClearFilters = useCallback(() => {
    setDeliverablesFilters({ status: [], isKeyDate: false });
  }, [setDeliverablesFilters]);

  // Filters Slot for DeliverableTable toolbar
  const deliverableFilterSlot = (
    <div className="flex flex-col gap-2 pt-2">
      <MultiSelectFilter 
        label="Status"
        options={['Open', 'In Progress', 'Under Review', 'Closed', 'Not Applicable']}
        selected={deliverablesFilters.status || []}
        onChange={(s) => setDeliverablesFilters({ ...deliverablesFilters, status: s })}
        placeholder="Filter statuses..."
      />
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Key Dates Only</span>
        <button
          onClick={() => setDeliverablesFilters({ ...deliverablesFilters, isKeyDate: !deliverablesFilters.isKeyDate })}
          className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${deliverablesFilters.isKeyDate ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'}`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${deliverablesFilters.isKeyDate ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* View-Specific Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays size={20} className="text-sky-500" />
            Deliverables
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Track and coordinate critical pre-construction deliverables and timelines.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {/* View Toggles */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2 ml-2">
            <button
              onClick={() => setDeliverablesViewMode('table-split')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                deliverablesViewMode === 'table-split' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Table View"
            >
              <List size={18} />
            </button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
            <button
              onClick={() => setDeliverablesViewMode('board')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                deliverablesViewMode === 'board' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Board View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <Button 
            onClick={() => createDeliverableMutation.mutate({})}
            isLoading={createDeliverableMutation.isPending}
            loadingText="Adding..."
          >
            <Plus size={16} strokeWidth={3} className="mr-2" />
            New Deliverable
          </Button>
        </div>
      </div>

      {/* Main Board View Container */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <DeliverableBoard 
          projectId={projectId}
          deliverables={filteredDeliverables}
          isLoading={isLoading}
          filterSlot={deliverableFilterSlot}
          filterActiveCount={filterActiveCount}
          onClearFilters={onClearFilters}
          createMutation={createDeliverableMutation}
        />
      </div>
    </div>
  );
}
