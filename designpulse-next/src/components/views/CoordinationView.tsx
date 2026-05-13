"use client";
import CoordinationTable from '@/components/coordination/CoordinationTable';
import CoordinationBoard from '@/components/coordination/CoordinationBoard';
import { CoordinationDetailPanel } from '@/components/coordination/CoordinationDetailPanel';
import { CoordinationSummary } from '@/components/coordination/CoordinationSummary';
import FloorplanCanvas from '@/components/FloorplanCanvas';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { useUIStore } from '@/stores/useUIStore';
import type { Opportunity } from '@/types/models';

interface CoordinationViewProps {
  projectId: string;
  filteredOpportunities: Opportunity[];
  coordinationViewMode: string;
  // Filter state
  coordActiveType: string;
  setCoordActiveType: (s: string) => void;
  coordActiveStatus: string;
  setCoordActiveStatus: (s: string) => void;
  coordActiveBuildingAreas: string[];
  setCoordActiveBuildingAreas: (a: string[]) => void;
  coordActiveDisciplines: string[];
  setCoordActiveDisciplines: (a: string[]) => void;
  coordActiveCostCodes: string[];
  setCoordActiveCostCodes: (a: string[]) => void;
  uniqueCoordTypes: string[];
  uniqueCoordStatuses: string[];
  uniqueCoordCostCodes: string[];
  dynamicBuildingAreas: string[];
  disciplineLabels: string[];
}

export function CoordinationView({
  projectId,
  filteredOpportunities,
  coordinationViewMode,
  coordActiveType,
  setCoordActiveType,
  coordActiveStatus,
  setCoordActiveStatus,
  coordActiveBuildingAreas,
  setCoordActiveBuildingAreas,
  coordActiveDisciplines,
  setCoordActiveDisciplines,
  coordActiveCostCodes,
  setCoordActiveCostCodes,
  uniqueCoordTypes,
  uniqueCoordStatuses,
  uniqueCoordCostCodes,
  dynamicBuildingAreas,
  disciplineLabels,
}: CoordinationViewProps) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isMapVisible = useUIStore(state => state.isMapVisible);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${selectedOpportunityId && coordinationViewMode === 'table-split' ? 'border-r border-slate-200 dark:border-slate-800' : ''}`}>
          
          <div className="shrink-0">
            <CoordinationSummary 
              opportunities={filteredOpportunities} 
              forceCollapse={coordinationViewMode === 'table-split' && !!selectedOpportunityId} 
            />
          </div>
          
          {/* Filter Toolbar removed — filters are now inline in the grid toolbar via filterSlot */}

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
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
            {coordinationViewMode.startsWith('table') ? (
              <CoordinationTable
                projectId={projectId}
                opportunities={filteredOpportunities}
                viewMode={coordinationViewMode.replace('table-', '')}
                filterActiveCount={(coordActiveType !== 'All' ? 1 : 0) + (coordActiveStatus !== 'All' ? 1 : 0) + coordActiveBuildingAreas.length + coordActiveDisciplines.length + coordActiveCostCodes.length}
                onClearFilters={() => { setCoordActiveType('All'); setCoordActiveStatus('All'); setCoordActiveBuildingAreas([]); setCoordActiveDisciplines([]); setCoordActiveCostCodes([]); }}
                filterSlot={
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</label>
                      <select value={coordActiveType} onChange={(e) => setCoordActiveType(e.target.value)} className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 cursor-pointer">
                        <option value="All">All</option>
                        {uniqueCoordTypes.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</label>
                      <select value={coordActiveStatus} onChange={(e) => setCoordActiveStatus(e.target.value)} className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 cursor-pointer">
                        <option value="All">All</option>
                        {uniqueCoordStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Building Area</label>
                      <MultiSelectFilter fullWidth label="Building Area" options={dynamicBuildingAreas} selected={coordActiveBuildingAreas} onChange={setCoordActiveBuildingAreas} placeholder="Search areas..." />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Discipline</label>
                      <MultiSelectFilter fullWidth label="Discipline" options={disciplineLabels} selected={coordActiveDisciplines} onChange={setCoordActiveDisciplines} placeholder="Search disciplines..." />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost Code</label>
                      <MultiSelectFilter fullWidth label="Cost Code" options={uniqueCoordCostCodes} selected={coordActiveCostCodes} onChange={setCoordActiveCostCodes} placeholder="Search codes..." />
                    </div>
                  </>
                }
              />
            ) : (
              <CoordinationBoard projectId={projectId} opportunities={filteredOpportunities} />
            )}
          </div>
        </div>

        {coordinationViewMode === 'table-split' && selectedOpportunityId && filteredOpportunities.find(o => o.id === selectedOpportunityId) && (
          <CoordinationDetailPanel 
            projectId={projectId} 
            opportunity={filteredOpportunities.find(o => o.id === selectedOpportunityId)!} 
          />
        )}
      </div>
    </div>
  );
}
