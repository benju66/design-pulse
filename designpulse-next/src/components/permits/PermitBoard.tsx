"use client";
import { useMemo } from 'react';
import { usePermits, useCreatePermit } from '@/hooks/usePermitQueries';
import { useUIStore } from '@/stores/useUIStore';
import { PermitTable } from './PermitTable';
import PermitKanban from './PermitKanban';
import PermitDetailPanel from './PermitDetailPanel';
import { PermitSummary } from './PermitSummary';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';

const EMPTY_FILTERS: any = {};

export default function PermitBoard({ projectId }: { projectId: string }) {
  const { data: permits = [], isLoading } = usePermits(projectId);
  const createMutation = useCreatePermit(projectId);
  
  const viewMode = useUIStore(state => state.permitViewMode);
  const permitFilters = useUIStore(state => state.permitFilters[projectId] || EMPTY_FILTERS);
  const _setPermitFilters = useUIStore(state => state.setPermitFilters);
  const setPermitFilters = useMemo(() => (filters: any) => _setPermitFilters(projectId, filters), [projectId, _setPermitFilters]);
  const selectedPermitId = useUIStore(state => state.selectedOpportunityId);
  
  const filteredPermits = useMemo(() => {
    return permits.filter(permit => {
      // Filters
      if (permitFilters.status?.length && (!permit.status || !permitFilters.status.includes(permit.status))) {
        return false;
      }
      if (permitFilters.type?.length && (!permit.permit_type || !permitFilters.type.includes(permit.permit_type))) {
        return false;
      }
      if (permitFilters.ahj?.length && (!permit.ahj || !permitFilters.ahj.includes(permit.ahj))) {
        return false;
      }
      
      // Assignee (comma separated string)
      if (permitFilters.assignee?.length) {
        if (!permit.assignee) return false;
        const assignees = permit.assignee.split(',').map(a => a.trim());
        const hasMatch = permitFilters.assignee.some(filterEmail => assignees.includes(filterEmail));
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [permits, permitFilters]);

  const uniqueStatuses = useMemo(() => Array.from(new Set(permits.map(p => p.status).filter(Boolean) as string[])).sort(), [permits]);
  const uniqueTypes = useMemo(() => Array.from(new Set(permits.map(p => p.permit_type).filter(Boolean) as string[])).sort(), [permits]);
  const uniqueAHJs = useMemo(() => Array.from(new Set(permits.map(p => p.ahj).filter(Boolean) as string[])).sort(), [permits]);

  const clearFilters = () => setPermitFilters({});

  const activeFilterCount = (permitFilters.status?.length || 0) + 
                            (permitFilters.type?.length || 0) + 
                            (permitFilters.ahj?.length || 0) + 
                            (permitFilters.assignee?.length || 0);

  const filterSlot = (
    <div className="flex flex-col gap-1.5 pt-2">
      <MultiSelectFilter
        label="Status"
        options={uniqueStatuses}
        selected={permitFilters.status || []}
        onChange={(s) => setPermitFilters({ ...permitFilters, status: s })}
        placeholder="Search statuses..."
      />
      
      <MultiSelectFilter
        label="Type"
        options={uniqueTypes}
        selected={permitFilters.type || []}
        onChange={(t) => setPermitFilters({ ...permitFilters, type: t })}
        placeholder="Search types..."
      />

      <MultiSelectFilter
        label="AHJ"
        options={uniqueAHJs}
        selected={permitFilters.ahj || []}
        onChange={(a) => setPermitFilters({ ...permitFilters, ahj: a })}
        placeholder="Search AHJs..."
      />
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${selectedPermitId && viewMode === 'table-split' ? 'border-r border-slate-200 dark:border-slate-800' : ''}`}>
          
          <div className="shrink-0 mb-4">
            <PermitSummary 
              permits={filteredPermits} 
              forceCollapse={viewMode === 'table-split' && !!selectedPermitId} 
            />
          </div>

          <div className="flex-1 overflow-hidden">
            {viewMode.startsWith('table') ? (
              <PermitTable 
                projectId={projectId} 
                permits={filteredPermits} 
                filterSlot={filterSlot}
                filterActiveCount={activeFilterCount}
                onClearFilters={clearFilters}
                createMutation={createMutation}
              />
            ) : (
              <PermitKanban projectId={projectId} permits={filteredPermits} />
            )}
          </div>
        </div>

        {viewMode === 'table-split' && selectedPermitId && (
          <PermitDetailPanel projectId={projectId} permitId={selectedPermitId} />
        )}
      </div>
    </div>
  );
}
