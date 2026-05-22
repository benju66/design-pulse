"use client";
import { Plus } from 'lucide-react';
import OpportunityGridV2 from '@/components/OpportunityGridV2';
import BudgetSummary from '@/components/BudgetSummary';
import dynamic from 'next/dynamic';
const FloorplanCanvas = dynamic(() => import('@/components/FloorplanCanvas'), { ssr: false });
import DetailPanel from '@/components/DetailPanel';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { useUIStore } from '@/stores/useUIStore';
import type { Opportunity } from '@/types/models';
import type { SettingsTab } from '@/stores/useUIStore';

interface ValueMatrixViewProps {
  projectId: string;
  opportunities: Opportunity[];
  filteredOpportunities: Opportunity[];
  viewMode: string;
  isLoading: boolean;
  onOpenCompare: (selectedIds?: string[]) => void;
  // Filter state
  activeStatus: string;
  setActiveStatus: (s: string) => void;
  activeEstimateSyncStatus: string;
  setActiveEstimateSyncStatus: (s: string) => void;
  activeBuildingAreas: string[];
  setActiveBuildingAreas: (a: string[]) => void;
  activeCostCodes: string[];
  setActiveCostCodes: (a: string[]) => void;
  uniqueStatuses: string[];
  dynamicBuildingAreas: string[];
  uniqueCostCodes: string[];
  navigateToSettings: (tab: SettingsTab) => void;
}

export function ValueMatrixView({
  projectId,
  opportunities,
  filteredOpportunities,
  viewMode,
  isLoading,
  onOpenCompare,
  activeStatus,
  setActiveStatus,
  activeEstimateSyncStatus,
  setActiveEstimateSyncStatus,
  activeBuildingAreas,
  setActiveBuildingAreas,
  activeCostCodes,
  setActiveCostCodes,
  uniqueStatuses,
  dynamicBuildingAreas,
  uniqueCostCodes,
  navigateToSettings,
}: ValueMatrixViewProps) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isMapVisible = useUIStore(state => state.isMapVisible);

  return (
    <>
      {/* Main Grid Area */}
      <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${
        (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
      }`}>
        <div className="shrink-0">
          <BudgetSummary 
            projectId={projectId} 
            opportunities={opportunities} 
            forceCollapse={viewMode === 'split' && !!selectedOpportunityId} 
          />
          
          {/* Filter Toolbar removed — filters are now inline in the grid toolbar via filterSlot */}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col relative">
          {isMapVisible && (
            <div className="h-1/2 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <FloorplanCanvas 
                projectId={projectId}
                sheetId=""
                maxZoom={0}
                originalWidth={1000}
                originalHeight={1000}
                zones={[]}
              />
            </div>
          )}
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-500">Loading log...</div>
          ) : (
            <OpportunityGridV2 
              projectId={projectId} 
              data={filteredOpportunities} 
              viewMode={viewMode} 
              onOpenCompare={onOpenCompare}
              activeStatus={activeStatus}
              filterActiveCount={(activeStatus !== 'All' ? 1 : 0) + (activeEstimateSyncStatus !== 'All' ? 1 : 0) + activeBuildingAreas.length + activeCostCodes.length}
              onClearFilters={() => { setActiveStatus('All'); setActiveEstimateSyncStatus('All'); setActiveBuildingAreas([]); setActiveCostCodes([]); }}
              filterSlot={
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">VE Status</label>
                    <select
                      value={activeStatus}
                      onChange={(e) => setActiveStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="All">All</option>
                      {uniqueStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Est. Status</label>
                    <select
                      value={activeEstimateSyncStatus}
                      onChange={(e) => setActiveEstimateSyncStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="All">All</option>
                      <option value="Draft">Draft</option>
                      <option value="Pending Estimate Update">Pending Update</option>
                      <option value="Incorporated">Incorporated</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Building Area</label>
                      <button onClick={() => navigateToSettings('building_areas')} className="text-slate-400 hover:text-sky-500 transition-colors" title="Manage Building Areas"><Plus size={13} /></button>
                    </div>
                    <MultiSelectFilter fullWidth label="Building Area" options={dynamicBuildingAreas} selected={activeBuildingAreas} onChange={setActiveBuildingAreas} placeholder="Search areas..." />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost Code</label>
                    <MultiSelectFilter fullWidth label="Cost Code" options={uniqueCostCodes} selected={activeCostCodes} onChange={setActiveCostCodes} placeholder="Search codes..." />
                  </div>
                </>
              }
            />
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel 
        projectId={projectId} 
        opportunities={opportunities} 
        viewMode={viewMode} 
      />
    </>
  );
}
