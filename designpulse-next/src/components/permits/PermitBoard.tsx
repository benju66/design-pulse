"use client";
import { useState, useMemo } from 'react';
import { usePermits } from '@/hooks/usePermitQueries';
import { useUIStore } from '@/stores/useUIStore';
import { Search, FilterX } from 'lucide-react';
import PermitTable from './PermitTable';
import PermitKanban from './PermitKanban';
import PermitDetailPanel from './PermitDetailPanel';
import { PermitSummary } from './PermitSummary';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';

export default function PermitBoard({ projectId }: { projectId: string }) {
  const { data: permits = [], isLoading } = usePermits(projectId);
  
  const viewMode = useUIStore(state => state.permitViewMode);
  const permitFilters = useUIStore(state => state.permitFilters);
  const setPermitFilters = useUIStore(state => state.setPermitFilters);
  const selectedPermitId = useUIStore(state => state.selectedOpportunityId);
  
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPermits = useMemo(() => {
    return permits.filter(permit => {
      // Search
      if (searchQuery && !permit.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !permit.display_id?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
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
  }, [permits, permitFilters, searchQuery]);

  const uniqueStatuses = useMemo(() => Array.from(new Set(permits.map(p => p.status).filter(Boolean) as string[])).sort(), [permits]);
  const uniqueTypes = useMemo(() => Array.from(new Set(permits.map(p => p.permit_type).filter(Boolean) as string[])).sort(), [permits]);
  const uniqueAHJs = useMemo(() => Array.from(new Set(permits.map(p => p.ahj).filter(Boolean) as string[])).sort(), [permits]);

  const clearFilters = () => {
    setPermitFilters({});
    setSearchQuery('');
  };

  const activeFilterCount = (permitFilters.status?.length || 0) + 
                            (permitFilters.type?.length || 0) + 
                            (permitFilters.ahj?.length || 0) + 
                            (permitFilters.assignee?.length || 0) + 
                            (searchQuery ? 1 : 0);

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
          
          <div className="shrink-0">
            <PermitSummary 
              permits={filteredPermits} 
              forceCollapse={viewMode === 'table-split' && !!selectedPermitId} 
            />
          </div>
          
          <div className="shrink-0 mb-4 mt-2">
            <div className="flex flex-wrap items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full">
              <div className="flex items-center gap-2 pl-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters</span>
              </div>
              
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search permits..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm w-48 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all dark:text-white"
                />
              </div>

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

              {activeFilterCount > 0 && (
                <button 
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20 rounded-lg transition-colors ml-auto"
                >
                  <FilterX size={16} />
                  <span className="hidden @xl:inline">Clear ({activeFilterCount})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {viewMode.startsWith('table') ? (
              <PermitTable projectId={projectId} permits={filteredPermits} />
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
