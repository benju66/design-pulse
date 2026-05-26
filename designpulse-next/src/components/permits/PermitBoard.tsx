"use client";
import { useUIStore } from '@/stores/useUIStore';
import { PermitTable } from './PermitTable';
import PermitKanban from './PermitKanban';
import PermitDetailPanel from './PermitDetailPanel';
import { PermitSummary } from './PermitSummary';
import { Permit } from '@/types/models';

interface PermitBoardProps {
  projectId: string;
  permits: Permit[];
  isLoading: boolean;
  filterSlot?: React.ReactNode;
  filterActiveCount?: number;
  onClearFilters?: () => void;
  createMutation: any;
}

export default function PermitBoard({ 
  projectId,
  permits,
  isLoading,
  filterSlot,
  filterActiveCount,
  onClearFilters,
  createMutation,
}: PermitBoardProps) {
  const viewMode = useUIStore(state => state.permitViewMode);
  const selectedPermitId = useUIStore(state => state.selectedOpportunityId);
  
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${selectedPermitId && viewMode === 'table-split' ? 'border-r border-slate-200 dark:border-slate-800' : ''}`}>
          
          <div className="shrink-0 mb-4">
            <PermitSummary 
              permits={permits} 
              forceCollapse={viewMode === 'table-split' && !!selectedPermitId} 
            />
          </div>

          <div className="flex-1 overflow-hidden flex flex-col relative">
            {isLoading ? (
              <div className="h-full flex items-center justify-center flex-1 bg-slate-50 dark:bg-slate-950">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
              </div>
            ) : viewMode.startsWith('table') ? (
              <PermitTable 
                projectId={projectId} 
                permits={permits} 
                filterSlot={filterSlot}
                filterActiveCount={filterActiveCount}
                onClearFilters={onClearFilters}
                createMutation={createMutation}
              />
            ) : (
              <PermitKanban projectId={projectId} permits={permits} />
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
