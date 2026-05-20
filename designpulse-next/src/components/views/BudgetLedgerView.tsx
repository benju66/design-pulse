"use client";
import { useMemo, useCallback, useRef } from 'react';
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
  allOpportunities: Opportunity[];  // Unfiltered — for DetailPanel VE Impact lookup
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
  showVeOnly: boolean;
  setShowVeOnly: (v: boolean) => void;
  showIncorporated: boolean;
  setShowIncorporated: (v: boolean) => void;
  // Centralized filter count + clear (computed in page.tsx — single source of truth)
  filterActiveCount: number;
  onClearFilters: () => void;
  dynamicBuildingAreas: string[];
  uniqueCostCodes: string[];
  navigateToSettings: (tab: SettingsTab) => void;
  // Variance notes
  varianceNoteMap: Record<string, string>;
  // Phase 2: active version ID for version-scoped note editing
  activeVersionId?: string | null;
}

export function BudgetLedgerView({
  projectId,
  filteredOpportunities,
  allOpportunities,
  viewMode,
  isLoading,
  onOpenCompare,
  activeBuildingAreas,
  setActiveBuildingAreas,
  activeCostCodes,
  setActiveCostCodes,
  varianceThreshold,
  setVarianceThreshold,
  showVeOnly,
  setShowVeOnly,
  showIncorporated,
  setShowIncorporated,
  filterActiveCount,
  onClearFilters,
  dynamicBuildingAreas,
  uniqueCostCodes,
  navigateToSettings,
  varianceNoteMap,
  activeVersionId,
}: BudgetLedgerViewProps) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isMapVisible = useUIStore(state => state.isMapVisible);
  const isFullscreen = useUIStore(state => state.isBudgetAnalyticsFullscreen);
  const isBudgetSummaryCollapsed = useUIStore(state => state.isBudgetSummaryCollapsed);
  const setBudgetSummaryCollapsed = useUIStore(state => state.setBudgetSummaryCollapsed);
  const setFullscreen = useUIStore(state => state.setBudgetAnalyticsFullscreen);

  // Auto-collapse analytics when filter drawer opens, restore when it closes
  const preFilterCollapsedRef = useRef<boolean | null>(null);
  const handleFilterDrawerToggle = useCallback((isOpen: boolean) => {
    if (isOpen) {
      // Store current state before collapsing
      preFilterCollapsedRef.current = isBudgetSummaryCollapsed;
      if (isFullscreen) setFullscreen(false);
      if (!isBudgetSummaryCollapsed) setBudgetSummaryCollapsed(true);
    } else {
      // Restore previous state when closing
      if (preFilterCollapsedRef.current === false) {
        setBudgetSummaryCollapsed(false);
      }
      preFilterCollapsedRef.current = null;
    }
  }, [isBudgetSummaryCollapsed, isFullscreen, setBudgetSummaryCollapsed, setFullscreen]);

  // ── Layered Context: compute filtered cost codes for analytics ──
  const filteredCostCodes = useMemo(() => {
    const codes = filteredOpportunities
      .map(o => o.cost_code)
      .filter(Boolean) as string[];
    return Array.from(new Set(codes));
  }, [filteredOpportunities]);

  const totalCodes = useMemo(() => {
    const codes = allOpportunities
      .map(o => o.cost_code)
      .filter(Boolean) as string[];
    return new Set(codes).size;
  }, [allOpportunities]);

  return (
    <>
      {/* Main Grid Area */}
      <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${
        (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
      }`}>
        <BudgetSummaryV2
          projectId={projectId}
          forceCollapse={viewMode === 'split' && !!selectedOpportunityId}
          filteredCostCodes={filteredCostCodes}
          totalFilteredCodes={filteredCostCodes.length}
          totalCodes={totalCodes}
          onClearFilters={onClearFilters}
          navigateToSettings={navigateToSettings}
          allLedgerItems={allOpportunities}
          varianceNoteMap={varianceNoteMap}
        />

        {/* Grid — hidden when analytics is fullscreen */}
        <div className={`flex-1 overflow-hidden flex flex-col relative ${isFullscreen ? 'hidden' : ''}`}>
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
              filterActiveCount={filterActiveCount}
              onClearFilters={onClearFilters}
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
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">VE Focus</label>
                    <button
                      onClick={() => setShowVeOnly(!showVeOnly)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        showVeOnly
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>Only VE-impacted codes</span>
                      <div className={`relative w-8 h-[18px] rounded-full transition-colors ${
                        showVeOnly ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}>
                        <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                          showVeOnly ? 'translate-x-[16px]' : 'translate-x-[2px]'
                        }`} />
                      </div>
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowIncorporated(!showIncorporated)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        showIncorporated
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>Show Incorporated Items</span>
                      <div className={`relative w-8 h-[18px] rounded-full transition-colors ${
                        showIncorporated ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}>
                        <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                          showIncorporated ? 'translate-x-[16px]' : 'translate-x-[2px]'
                        }`} />
                      </div>
                    </button>
                  </div>
                </>
              }
              varianceNoteMap={varianceNoteMap}
              activeVersionId={activeVersionId}
              onFilterDrawerToggle={handleFilterDrawerToggle}
            />
          )}
        </div>
      </div>

      {/* Detail Panel — always visible even in fullscreen */}
      <DetailPanel 
        projectId={projectId} 
        opportunities={allOpportunities} 
        viewMode={viewMode} 
      />
    </>
  );
}
