"use client";
/**
 * BudgetSummaryV2 — Budget analytics dashboard for the Budget Ledger view.
 *
 * Architecture:
 *  - 3 tabs: Financial Bridge, Budget Allocation (sunburst↔treemap toggle), Risk Trend
 *  - Layered Context: global KPIs + filtered subtitle when grid filters active
 *  - Fullscreen mode: expands to fill content area, grid hidden
 *  - forceCollapse priority chain: forceCollapse > fullscreen > userCollapse (F1)
 *  - Empty state when no estimate versions exist (F7)
 *  - All charts receive data via props — no hooks in child components (C24)
 */
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useProjectEstimateVersions, useProjectBudgetWaterfall, useBudgetVersionTimeline } from '@/hooks/useEstimateQueries';
import { usePendingEstimateUpdates } from '@/hooks/useOpportunityQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import VarianceWaterfallChart from './analytics/VarianceWaterfallChart';
import CostConcentrationSunburst from './analytics/CostConcentrationSunburst';
import RiskExposureTrend from './analytics/RiskExposureTrend';
import BudgetTreemap from './analytics/BudgetTreemap';
import VarianceAnnotationChart from './analytics/VarianceAnnotationChart';
import { TabInfoTooltip } from './analytics/TabInfoTooltip';
import { useUIStore } from '@/stores/useUIStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, BarChart3, Layers, TrendingUp, Maximize2, Minimize2, PieChart, LayoutGrid, ArrowUpRight, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Opportunity } from '@/types/models';
import type { SettingsTab } from '@/stores/useUIStore';

type BudgetDashboardTab = 'waterfall' | 'allocation' | 'risk-trend' | 'coverage';
type AllocationSubView = 'sunburst' | 'treemap';

const TAB_DESCRIPTIONS: Record<BudgetDashboardTab, string> = {
  'waterfall': 'Horizontal bar chart comparing each trade\'s baseline budget against locked VE savings and pending exposure. Sorted by net impact.',
  'allocation': 'Proportional budget allocation by division and cost code. Toggle between sunburst overview and interactive treemap drill-down.',
  'risk-trend': 'Timeline showing how your budget baseline and VE position relate across estimate versions.',
  'coverage': 'Variance note annotation coverage across cost codes. Highlights unexplained budget swings requiring documentation.',
};

const DASHBOARD_TABS: { id: BudgetDashboardTab; label: string; icon: LucideIcon }[] = [
  { id: 'waterfall', label: 'Financial Bridge', icon: BarChart3 },
  { id: 'allocation', label: 'Budget Allocation', icon: Layers },
  { id: 'risk-trend', label: 'Risk Trend', icon: TrendingUp },
  { id: 'coverage', label: 'Variance Coverage', icon: MessageSquare },
];

interface BudgetSummaryProps {
  projectId: string;
  forceCollapse?: boolean;
  filteredCostCodes?: string[];
  totalFilteredCodes?: number;
  totalCodes?: number;
  onClearFilters?: () => void;
  navigateToSettings?: (tab: SettingsTab) => void;
  allLedgerItems?: Opportunity[];
  // Phase 5: variance note map for coverage tab
  varianceNoteMap?: Record<string, string>;
}

export default function BudgetSummaryV2({
  projectId,
  forceCollapse = false,
  filteredCostCodes,
  totalFilteredCodes,
  totalCodes,
  onClearFilters,
  navigateToSettings,
  allLedgerItems,
  varianceNoteMap = {},
}: BudgetSummaryProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BudgetDashboardTab>('waterfall');
  const [allocationView, setAllocationView] = useState<AllocationSubView>('treemap');

  const { data: versions = [] } = useProjectEstimateVersions(projectId);
  const { data: waterfallRows = [], isLoading: waterfallLoading } = useProjectBudgetWaterfall(projectId, selectedVersionId);
  const { data: timelineRows = [], isLoading: timelineLoading } = useBudgetVersionTimeline(projectId);
  const { data: costCodes = [] } = useCostCodes();

  // Build division name map from cost_codes where is_division=true
  const divisionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cc of costCodes) {
      if (cc.is_division && cc.description) {
        // Extract 2-digit prefix from code (character loop — iOS safe)
        let base = '';
        for (let i = 0; i < cc.code.length; i++) {
          if (cc.code[i] === '.') break;
          base += cc.code[i];
        }
        while (base.length < 6) base = '0' + base;
        const prefix = base.substring(0, 2);
        // Only set if not already mapped (first match wins — divisions are ordered)
        if (!map.has(prefix)) map.set(prefix, cc.description);
      }
    }
    return map;
  }, [costCodes]);

  // Zustand state
  const storeCollapsed = useUIStore(state => state.isBudgetSummaryCollapsed);
  const toggleCollapse = useUIStore(state => state.toggleBudgetSummary);
  const isFullscreen = useUIStore(state => state.isBudgetAnalyticsFullscreen);
  const setFullscreen = useUIStore(state => state.setBudgetAnalyticsFullscreen);

  // F1: forceCollapse priority — auto-exit fullscreen when forceCollapse fires
  useEffect(() => {
    if (forceCollapse && isFullscreen) setFullscreen(false);
  }, [forceCollapse, isFullscreen, setFullscreen]);

  const isCollapsed = forceCollapse || (!isFullscreen && storeCollapsed);

  // ── Global KPIs (always from full waterfallRows) ──
  const { totalOriginal, revisedBudget, netVariance } = useMemo(() => {
    let original = 0;
    let lockedImpact = 0;
    for (const row of waterfallRows) {
      original += Number(row.budget_amount) || 0;
      lockedImpact += Number(row.ve_impact) || 0;
    }
    return {
      totalOriginal: original,
      revisedBudget: original + lockedImpact,
      netVariance: lockedImpact
    };
  }, [waterfallRows]);

  // ── Pending VE Incorporation KPI ──
  const { data: pendingUpdates = [] } = usePendingEstimateUpdates(projectId);
  const pendingIncorporationCount = pendingUpdates.length;
  const pendingIncorporationValue = pendingUpdates.reduce((sum, opp) => sum + (Number(opp.cost_impact) || 0), 0);

  // ── Filtered KPIs (only when grid filters are active) ──
  const hasActiveFilters = filteredCostCodes && filteredCostCodes.length > 0 && totalFilteredCodes !== totalCodes;
  const filteredKPIs = useMemo(() => {
    if (!hasActiveFilters || !filteredCostCodes) return null;
    const filteredSet = new Set(filteredCostCodes);
    let baseline = 0;
    let locked = 0;
    for (const row of waterfallRows) {
      if (filteredSet.has(row.cost_code)) {
        baseline += Number(row.budget_amount) || 0;
        locked += Number(row.ve_impact) || 0;
      }
    }
    return { baseline, locked };
  }, [waterfallRows, filteredCostCodes, hasActiveFilters]);

  // ── Treemap L3 callback (lazy — only fires when user drills to L3) ──
  const getL3Items = useCallback((costCode: string): Opportunity[] => {
    if (!allLedgerItems) return [];
    return allLedgerItems.filter(o => o.cost_code === costCode);
  }, [allLedgerItems]);

  const formatCurrency = (val: number, forcePlus = false) => {
    if (isNaN(val)) return '$0';
    const num = Number(val);
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(num));
    if (num < 0) return `-${formatted}`;
    if (num > 0 && forcePlus) return `+${formatted}`;
    return formatted;
  };

  // F7: Empty state check
  const showEmptyState = waterfallRows.length === 0 && !waterfallLoading && !isCollapsed;

  return (
    <motion.div layout className={`w-full ${isFullscreen ? 'flex-1 min-h-0 flex flex-col' : 'mb-4'}`}>
      {/* Unified Container — single card that persists across states */}
      <div className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative flex flex-col ${
        isFullscreen ? 'flex-1 min-h-0' : ''
      }`}>
        {/* Persistent Header Row — never changes position */}
        <div className="flex items-center justify-between p-3 px-4 flex-wrap gap-2">
          <div className="flex items-center flex-wrap gap-4">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Budget Analytics</span>

            {!isCollapsed && versions.length > 0 && (
              <select
                value={selectedVersionId || ''}
                onChange={(e) => setSelectedVersionId(e.target.value || null)}
                className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none rounded-md px-2 py-1 cursor-pointer focus:ring-0"
              >
                <option value="">Default (Active Budget)</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.version_name} {v.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            )}

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Baseline:</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalOriginal)}</span>
            </div>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Locked:</span>
              <span className={`text-sm font-bold ${netVariance < 0 ? 'text-emerald-600 dark:text-emerald-400' : netVariance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(netVariance, true)}
              </span>
            </div>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Revised:</span>
              <span className={`text-sm font-extrabold ${revisedBudget > totalOriginal ? 'text-rose-600 dark:text-rose-400' : revisedBudget < totalOriginal ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(revisedBudget)}
              </span>
            </div>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">To Incorporate:</span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{pendingIncorporationCount} items ({formatCurrency(pendingIncorporationValue, true)})</span>
            </div>
          </div>

          {/* Control buttons — always visible in header */}
          {!forceCollapse && (
            <div className="flex items-center gap-1 ml-auto">
              {!isCollapsed && (
                <button
                  onClick={() => setFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={15} strokeWidth={2.5} /> : <Maximize2 size={15} strokeWidth={2.5} />}
                </button>
              )}
              <button
                onClick={() => {
                  if (isFullscreen) setFullscreen(false);
                  toggleCollapse();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                title={isCollapsed ? 'Expand Summary' : 'Collapse Summary'}
              >
                {isCollapsed
                  ? <ChevronDown size={18} strokeWidth={2.5} />
                  : <ChevronUp size={18} strokeWidth={2.5} />}
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Content — smooth height animation */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="expandable-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className={`overflow-hidden flex flex-col ${isFullscreen ? 'flex-1 min-h-0' : ''}`}
            >
              <div className={`px-5 pb-5 flex flex-col ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
                {showEmptyState ? (
                  /* F7: Empty state */
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <BarChart3 size={36} className="text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No budget data yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Import your first estimate to unlock analytics.</p>
                    {navigateToSettings && (
                      <button
                        onClick={() => navigateToSettings('estimate')}
                        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors"
                      >
                        Go to Budget Settings <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Subtitle line */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Executive financial reporting across trade variances, cost concentration, and risk exposure</p>

                    {/* Layered Context — filtered subtitle */}
                    <AnimatePresence>
                      {hasActiveFilters && filteredKPIs && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-2 flex items-center gap-3 text-[11px]"
                        >
                          <span className="text-sky-600 dark:text-sky-400 font-semibold">
                            Filtered: {totalFilteredCodes} of {totalCodes} codes
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {formatCurrency(filteredKPIs.baseline)} baseline
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className={filteredKPIs.locked < 0 ? 'text-emerald-600 dark:text-emerald-400' : filteredKPIs.locked > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}>
                            {formatCurrency(filteredKPIs.locked, true)} locked
                          </span>
                          {onClearFilters && (
                            <>
                              <span className="text-slate-400">·</span>
                              <button onClick={onClearFilters} className="text-sky-600 dark:text-sky-400 hover:text-sky-500 font-medium">
                                Clear filters
                              </button>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Tab Strip */}
                    <nav className="flex items-center border-b border-slate-200 dark:border-slate-700 mb-4">
                      {DASHBOARD_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 border-b-2 -mb-px ${
                              isActive
                                ? 'text-sky-600 dark:text-sky-400 border-sky-500'
                                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                          >
                            <Icon size={16} />
                            {tab.label}
                            <TabInfoTooltip description={TAB_DESCRIPTIONS[tab.id]} />
                          </button>
                        );
                      })}

                      {/* Allocation sub-view toggle (only when allocation tab is active) */}
                      {activeTab === 'allocation' && (
                        <div className="ml-auto flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                          <button
                            onClick={() => setAllocationView('treemap')}
                            className={`p-1.5 rounded-md transition-colors ${
                              allocationView === 'treemap'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                            title="Treemap View"
                          >
                            <LayoutGrid size={14} />
                          </button>
                          <button
                            onClick={() => setAllocationView('sunburst')}
                            className={`p-1.5 rounded-md transition-colors ${
                              allocationView === 'sunburst'
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                            title="Sunburst View"
                          >
                            <PieChart size={14} />
                          </button>
                        </div>
                      )}
                    </nav>

                    {/* Tab Content Area */}
                    <div className={isFullscreen ? 'flex-1 min-h-0 overflow-auto' : 'max-h-[380px] overflow-auto'}>
                      {activeTab === 'waterfall' && (
                        <VarianceWaterfallChart
                          rows={waterfallRows}
                          filteredCostCodes={hasActiveFilters ? filteredCostCodes : undefined}
                          isLoading={waterfallLoading}
                        />
                      )}
                      {activeTab === 'allocation' && allocationView === 'sunburst' && (
                        <CostConcentrationSunburst
                          rows={waterfallRows}
                          filteredCostCodes={hasActiveFilters ? filteredCostCodes : undefined}
                          divisionNameMap={divisionNameMap}
                        />
                      )}
                      {activeTab === 'allocation' && allocationView === 'treemap' && (
                        <BudgetTreemap
                          rows={waterfallRows}
                          filteredCostCodes={hasActiveFilters ? filteredCostCodes : undefined}
                          onRequestL3Items={getL3Items}
                          divisionNameMap={divisionNameMap}
                        />
                      )}
                      {activeTab === 'risk-trend' && (
                        <RiskExposureTrend
                          rows={timelineRows}
                          isFiltered={hasActiveFilters}
                          isLoading={timelineLoading}
                        />
                      )}
                      {activeTab === 'coverage' && (
                        <VarianceAnnotationChart
                          data={waterfallRows.map(row => ({
                            costCode: row.cost_code,
                            description: row.description || '',
                            baseline: Number(row.budget_amount) || 0,
                            revised: (Number(row.budget_amount) || 0) + (Number(row.ve_impact) || 0),
                            hasNote: !!varianceNoteMap[row.cost_code],
                          }))}
                          isLoading={waterfallLoading}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
