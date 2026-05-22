"use client";

import { useMemo, useCallback } from 'react';
import { List, LayoutGrid, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import PermitBoard from '@/components/permits/PermitBoard';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { usePermits, useCreatePermit } from '@/hooks/usePermitQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { useUIStore, PermitFilters } from '@/stores/useUIStore';

const EMPTY_PERMIT_FILTERS: PermitFilters = {};

interface PermitsViewProps {
  projectId: string;
}

export function PermitsView({ projectId }: PermitsViewProps) {
  // ── Queries & Mutations ──
  const { data: permits = [], isLoading } = usePermits(projectId);
  const createPermitMutation = useCreatePermit(projectId);
  const { data: settings } = useProjectSettings(projectId);

  // ── UI Store states & actions ──
  const permitViewMode = useUIStore(state => state.permitViewMode);
  const setPermitViewMode = useUIStore(state => state.setPermitViewMode);

  const permitFilters = useUIStore(state => state.permitFilters[projectId] || EMPTY_PERMIT_FILTERS);
  const _setPermitFilters = useUIStore(state => state.setPermitFilters);
  const setPermitFilters = useCallback(
    (filters: PermitFilters) => _setPermitFilters(projectId, filters),
    [projectId, _setPermitFilters]
  );

  // ── Derived Settings ──
  const permitTypeOptions = useMemo(() => {
    const types = (settings?.permit_types as { id: string; label: string }[]) || [];
    return types.map(t => t.label);
  }, [settings]);

  const permitAHJOptions = useMemo(() => {
    const ahjs = (settings?.permit_ahjs as { id: string; label: string }[]) || [];
    return ahjs.map(a => a.label);
  }, [settings]);

  // ── Filtering Logic ──
  const filteredPermits = useMemo(() => {
    return permits.filter(permit => {
      if (permitFilters.status?.length && (!permit.status || !permitFilters.status.includes(permit.status))) {
        return false;
      }
      if (permitFilters.type?.length && (!permit.permit_type || !permitFilters.type.includes(permit.permit_type))) {
        return false;
      }
      if (permitFilters.ahj?.length && (!permit.ahj || !permitFilters.ahj.includes(permit.ahj))) {
        return false;
      }
      return true;
    });
  }, [permits, permitFilters]);

  const permitFilterActiveCount = (permitFilters.status?.length || 0) + 
                                  (permitFilters.type?.length || 0) + 
                                  (permitFilters.ahj?.length || 0);

  const clearPermitFilters = useCallback(() => {
    setPermitFilters({});
  }, [setPermitFilters]);

  const permitFilterSlot = (
    <div className="flex flex-col gap-1.5 pt-2">
      <MultiSelectFilter 
        label="Status"
        options={['Preparing', 'Submitted', 'Comments Received', 'Approved']}
        selected={permitFilters.status || []}
        onChange={(s) => setPermitFilters({ ...permitFilters, status: s })}
        placeholder="Filter statuses..."
      />
      <MultiSelectFilter 
        label="Type"
        options={permitTypeOptions}
        selected={permitFilters.type || []}
        onChange={(t) => setPermitFilters({ ...permitFilters, type: t })}
        placeholder="Search permit types..."
      />
      <MultiSelectFilter 
        label="AHJ"
        options={permitAHJOptions}
        selected={permitFilters.ahj || []}
        onChange={(a) => setPermitFilters({ ...permitFilters, ahj: a })}
        placeholder="Search AHJs..."
      />
    </div>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* View-Specific Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Permits Tracker
        </h2>
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2 ml-2">
            <button
              onClick={() => setPermitViewMode('table-split')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                permitViewMode === 'table-split' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Table View"
            >
              <List size={18} />
            </button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
            <button
              onClick={() => setPermitViewMode('board')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                permitViewMode === 'board' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Board View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <Button 
            onClick={() => createPermitMutation.mutate({})}
            isLoading={createPermitMutation.isPending}
            loadingText="Adding..."
          >
            <Plus size={16} strokeWidth={3} className="mr-2" />
            New Permit
          </Button>
        </div>
      </div>

      {/* Main Board View Container */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <PermitBoard 
          projectId={projectId}
          permits={filteredPermits}
          isLoading={isLoading}
          filterSlot={permitFilterSlot}
          filterActiveCount={permitFilterActiveCount}
          onClearFilters={clearPermitFilters}
          createMutation={createPermitMutation}
        />
      </div>
    </div>
  );
}
