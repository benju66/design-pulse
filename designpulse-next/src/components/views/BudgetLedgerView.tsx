"use client";
import { Plus } from 'lucide-react';
import OpportunityGridV2 from '@/components/OpportunityGridV2';
import BudgetSummaryV2 from '@/components/BudgetSummaryV2';
import FloorplanCanvas from '@/components/FloorplanCanvas';
import DetailPanel from '@/components/DetailPanel';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { useUIStore } from '@/stores/useUIStore';
import type { Opportunity } from '@/types/models';
import type { SettingsTab } from '@/stores/useUIStore';

interface BudgetLedgerViewProps {
  projectId: string;
  filteredOpportunities: Opportunity[];
  viewMode: string;
  isLoading: boolean;
  onOpenCompare: () => void;
  // Filter state
  activeBuildingAreas: string[];
  setActiveBuildingAreas: (a: string[]) => void;
  activeCostCodes: string[];
  setActiveCostCodes: (a: string[]) => void;
  varianceThreshold: number;
  setVarianceThreshold: (n: number) => void;
  dynamicBuildingAreas: string[];
  uniqueCostCodes: string[];
  navigateToSettings: (tab: SettingsTab) => void;
  // Variance notes
  varianceNoteMap: Record<string, string>;
}

export function BudgetLedgerView({
  projectId,
  filteredOpportunities,
  viewMode,
  isLoading,
  onOpenCompare,
  activeBuildingAreas,
  setActiveBuildingAreas,
  activeCostCodes,
  setActiveCostCodes,
  varianceThreshold,
  setVarianceThreshold,
  dynamicBuildingAreas,
  uniqueCostCodes,
  navigateToSettings,
  varianceNoteMap,
}: BudgetLedgerViewProps) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isMapVisible = useUIStore(state => state.isMapVisible);

  return (
    <>
      {/* Main Grid Area */}
      <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${
        (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
      }`}>
        <div className="shrink-0">
          <BudgetSummaryV2
            projectId={projectId}
            forceCollapse={viewMode === 'split' && !!selectedOpportunityId}
          />
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
              isLedgerView
              hideGhostRow
              onOpenCompare={onOpenCompare}
              filterActiveCount={activeBuildingAreas.length + activeCostCodes.length + (varianceThreshold > 0 ? 1 : 0)}
              onClearFilters={() => { setActiveBuildingAreas([]); setActiveCostCodes([]); setVarianceThreshold(0); }}
              filterSlot={
                <>
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
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Variance Threshold
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={500000}
                      step={5000}
                      value={varianceThreshold}
                      onChange={(e) => setVarianceThreshold(Number(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {varianceThreshold === 0
                          ? 'Show All'
                          : `\u2265 ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(varianceThreshold)}`}
                      </span>
                      {varianceThreshold > 0 && (
                        <button onClick={() => setVarianceThreshold(0)} className="text-[10px] text-rose-500 hover:text-rose-400">Reset</button>
                      )}
                    </div>
                  </div>
                </>
              }
              varianceNoteMap={varianceNoteMap}
            />
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel 
        projectId={projectId} 
        opportunities={filteredOpportunities} 
        viewMode={viewMode} 
      />
    </>
  );
}
