"use client";
import { useMemo, useCallback, useRef, useState } from 'react';
import { Plus, PanelRight, List, LayoutPanelTop } from 'lucide-react';
import OpportunityGridV2 from '@/components/OpportunityGridV2';
import BudgetSummaryV2 from '@/components/BudgetSummaryV2';
import FloorplanCanvas from '@/components/FloorplanCanvas';
import DetailPanel from '@/components/DetailPanel';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { Button } from '@/components/ui/Button';
import CompareModal from '@/components/CompareModal';
import { useUIStore } from '@/stores/useUIStore';
import { useOpportunities } from '@/hooks/useOpportunityQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { useMasterLedgerGrid, useProjectEstimateVersions, useEstimateVarianceNotes } from '@/hooks/useEstimateQueries';
import { exportToPDFService } from '@/services/api';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import type { Opportunity, MasterLedgerRow } from '@/types/models';

interface BudgetLedgerViewProps {
  projectId: string;
}

export function BudgetLedgerView({ projectId }: BudgetLedgerViewProps) {
  // ── Queries ──
  const { data: opportunities = [], isLoading: isOppsLoading } = useOpportunities(projectId);
  const { data: ledgerRows = [], isLoading: isLedgerLoading } = useMasterLedgerGrid(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { data: estimateVersions = [] } = useProjectEstimateVersions(projectId);

  // ── Active estimate version & variance notes ──
  const activeVersionId = useMemo(
    () => estimateVersions.find(v => v.is_active)?.id ?? null,
    [estimateVersions]
  );
  const { data: varianceNotes = [] } = useEstimateVarianceNotes(
    activeVersionId ? projectId : null,
    activeVersionId
  );
  const varianceNoteMap = useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const n of varianceNotes) {
      if (n.cost_code) map[n.cost_code] = n.variance_note;
    }
    return map;
  }, [varianceNotes]);

  const isLoading = isOppsLoading || isLedgerLoading;

  // ── UI Store states ──
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isMapVisible = useUIStore(state => state.isMapVisible);
  const isFullscreen = useUIStore(state => state.isBudgetAnalyticsFullscreen);
  const isBudgetSummaryCollapsed = useUIStore(state => state.isBudgetSummaryCollapsed);
  const setBudgetSummaryCollapsed = useUIStore(state => state.setBudgetSummaryCollapsed);
  const setFullscreen = useUIStore(state => state.setBudgetAnalyticsFullscreen);
  const viewMode = useUIStore(state => state.veGridViewMode);
  const setViewMode = useUIStore(state => state.setVeGridViewMode);
  const navigateToSettings = (tab: import('@/stores/useUIStore').SettingsTab) => 
    useUIStore.getState().navigateToSettings(projectId, tab);

  // ── Local Filter State ──
  const [activeBuildingAreas, setActiveBuildingAreas] = useState<string[]>([]);
  const [activeCostCodes, setActiveCostCodes] = useState<string[]>([]);
  const [varianceThreshold, setVarianceThreshold] = useState<number>(0);
  const [showVeOnly, setShowVeOnly] = useState(false);
  const [showIncorporated, setShowIncorporated] = useState(false);

  // ── Modal State ──
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([]);

  // ── Derived Settings ──
  const dynamicBuildingAreas = useMemo(() => {
    return (settings?.building_areas && Array.isArray(settings.building_areas) && settings.building_areas.length > 0) 
      ? (settings.building_areas as string[]) 
      : ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  }, [settings]);

  // ── Master Ledger Merging & Cost Code Normalization ──
  const mergedOpportunities = useMemo(() => {
    const budgetOpps: Opportunity[] = ledgerRows
      .filter((row: MasterLedgerRow) => row.cost_code != null && row.cost_code !== '')
      .map((row: MasterLedgerRow) => ({
      id: `budget-${row.cost_code}`,
      project_id: projectId,
      title: row.description || `Budget: ${row.cost_code}`,
      cost_code: row.cost_code,
      division: row.csi_division && row.csi_division.split('').every((ch: string) => ch >= '0' && ch <= '9') ? row.csi_division + '0000' : 'Uncategorized',
      status: 'Budget Line',
      cost_impact: row.baseline_budget,
      days_impact: 0,
      is_budget_line: true,
      baseline_budget: row.baseline_budget,
      approved_changes: row.locked_ve,
      revised_budget: row.revised_budget,
      pending_changes: row.pending_ve,
      projected_final: row.projected_final,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      priority: 'Low',
      location: '',
      building_area: '',
      record_type: 'VE',
    } as unknown as Opportunity));

    const normalizedOpps = opportunities.map(opp => {
      if ((opp as Record<string, unknown>).is_budget_line) return opp;
      const raw = opp.cost_code;
      if (!raw) return opp.division === 'Uncategorized' ? opp : { ...opp, division: 'Uncategorized' };
      const dotIdx = raw.indexOf('.');
      const base = dotIdx !== -1 ? raw.slice(0, dotIdx) : raw;
      
      let allDigit = base.length > 0;
      for (let i = 0; i < base.length; i++) {
        if (base[i] < '0' || base[i] > '9') { allDigit = false; break; }
      }
      if (!allDigit) return opp.division === 'Uncategorized' ? opp : { ...opp, division: 'Uncategorized' };
      const padded = base.padStart(6, '0');
      const division = padded.slice(0, 2) + '0000';
      
      if (padded === raw && opp.division === division) return opp;
      return { ...opp, cost_code: padded, division };
    });

    return [...normalizedOpps, ...budgetOpps];
  }, [opportunities, ledgerRows, projectId]);

  // ── Filtering Logic ──
  const applyBaseFilters = useCallback((items: Opportunity[]) => {
    return items.filter(opp => {
      const rt = opp.record_type || 'VE';
      if (rt === 'VE') return true;
      if (rt === 'Coordination') {
        const cost = Number(opp.cost_impact) || 0;
        const days = Number(opp.days_impact) || 0;
        const isEscalated = (opp.coordination_details as Record<string, unknown>)?.is_escalated === true;
        return cost !== 0 || days !== 0 || isEscalated;
      }
      return false;
    }).filter(opp => {
      if (activeBuildingAreas.length > 0 && !opp.is_budget_line && !activeBuildingAreas.includes(opp.building_area || '')) return false;
      if (activeCostCodes.length > 0 && !activeCostCodes.includes(opp.cost_code || '')) return false;
      return true;
    });
  }, [activeBuildingAreas, activeCostCodes]);

  const filteredLedgerItems = useMemo(() => {
    const base = applyBaseFilters(mergedOpportunities);

    let veCostCodes: Set<string> | null = null;
    if (showVeOnly) {
      veCostCodes = new Set(
        base.filter(o => !o.is_budget_line && o.cost_code && (!o.incorporated_version_id || showIncorporated)).map(o => o.cost_code as string)
      );
    }

    return base.filter(opp => {
      if (showVeOnly && opp.is_budget_line && !veCostCodes?.has(opp.cost_code || '')) return false;
      if (varianceThreshold > 0 && opp.is_budget_line) {
        const totalVariance = Math.abs(
          (Number(opp.pending_changes) || 0) + (Number(opp.approved_changes) || 0)
        );
        if (totalVariance < varianceThreshold) return false;
      }
      
      if (!opp.is_budget_line) {
        const isInc = opp.incorporated_version_id != null || opp.estimate_sync_status === 'Incorporated';
        if (isInc && !showIncorporated) return false;
      }
      
      return true;
    }).map(opp => {
      if (!opp.is_budget_line && (opp.incorporated_version_id != null || opp.estimate_sync_status === 'Incorporated')) {
        return { ...opp, is_incorporated: true } as Opportunity;
      }
      return opp;
    });
  }, [mergedOpportunities, applyBaseFilters, varianceThreshold, showVeOnly, showIncorporated]);

  const uniqueCostCodes = useMemo(() => {
    const codes = mergedOpportunities.map(o => o.cost_code).filter(Boolean) as string[];
    return Array.from(new Set(codes)).sort();
  }, [mergedOpportunities]);

  const filterActiveCount = activeBuildingAreas.length + activeCostCodes.length + (varianceThreshold > 0 ? 1 : 0) + (showVeOnly ? 1 : 0) + (showIncorporated ? 1 : 0);
  const onClearFilters = useCallback(() => {
    setActiveBuildingAreas([]); setActiveCostCodes([]); setVarianceThreshold(0); setShowVeOnly(false); setShowIncorporated(false);
  }, []);

  // ── Analytics toggle helpers ──
  const preFilterCollapsedRef = useRef<boolean | null>(null);
  const handleFilterDrawerToggle = useCallback((isOpen: boolean) => {
    if (isOpen) {
      preFilterCollapsedRef.current = isBudgetSummaryCollapsed;
      if (isFullscreen) setFullscreen(false);
      if (!isBudgetSummaryCollapsed) setBudgetSummaryCollapsed(true);
    } else {
      if (preFilterCollapsedRef.current === false) {
        setBudgetSummaryCollapsed(false);
      }
      preFilterCollapsedRef.current = null;
    }
  }, [isBudgetSummaryCollapsed, isFullscreen, setBudgetSummaryCollapsed, setFullscreen]);

  const filteredCostCodes = useMemo(() => {
    const codes = filteredLedgerItems
      .map(o => o.cost_code)
      .filter(Boolean) as string[];
    return Array.from(new Set(codes));
  }, [filteredLedgerItems]);

  const totalCodes = useMemo(() => {
    const codes = mergedOpportunities
      .map(o => o.cost_code)
      .filter(Boolean) as string[];
    return new Set(codes).size;
  }, [mergedOpportunities]);

  // ── CSV & PDF Exports ──
  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      let allMarkups: any[] = [];
      opportunities.forEach(opp => {
        if (opp.design_markups && Array.isArray(opp.design_markups)) {
          const color = opp.status === 'Approved' ? '#10b981' : (opp.status === 'Rejected' ? '#ef4444' : '#38bdf8');
          opp.design_markups.forEach((m: any) => {
            allMarkups.push({
              color: color, 
              points: m.points || []
            });
          });
        }
      });

      const payload = {
        include_data: true,
        markups: allMarkups,
        project_name: 'Design Pulse',
        sheet_name: 'VE Log'
      };

      const { blob, filename } = await exportToPDFService(projectId, payload, token);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Priority', 'Location', 'Scope', 'Status', 'Sync Status', 'Incorporated Version', 'Locked Variance', 'Cost Impact', 'Days Impact'];
    
    const escapeCSV = (value: any) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = opportunities.map(opp => {
      const versionName = opp.incorporated_version_id 
        ? estimateVersions.find(v => v.id === opp.incorporated_version_id)?.version_name || opp.incorporated_version_id
        : '';
        
      return [
        opp.display_id,
        opp.title,
        opp.priority,
        opp.location,
        opp.building_area,
        opp.status,
        opp.estimate_sync_status || 'Draft',
        versionName,
        opp.locked_variance,
        opp.cost_impact,
        opp.days_impact
      ].map(escapeCSV).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Project_VE_Log.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* View-Specific Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Budget Ledger
        </h2>
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2 ml-2">
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                viewMode === 'split' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Split View"
            >
              <PanelRight size={18} />
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                viewMode === 'flat' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Flat View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                viewMode === 'card' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Card View"
            >
              <LayoutPanelTop size={18} />
            </button>
          </div>
          <Button 
            variant="secondary"
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button 
            variant="secondary"
            onClick={handleExport}
          >
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Grid Area */}
        <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${
          (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
        }`}>
          <div className="shrink-0 mb-4">
            <BudgetSummaryV2
              projectId={projectId}
              forceCollapse={viewMode === 'split' && !!selectedOpportunityId}
              filteredCostCodes={filteredCostCodes}
              totalFilteredCodes={filteredCostCodes.length}
              totalCodes={totalCodes}
              onClearFilters={onClearFilters}
              navigateToSettings={navigateToSettings}
              allLedgerItems={mergedOpportunities}
              varianceNoteMap={varianceNoteMap}
            />
          </div>

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
                data={filteredLedgerItems} 
                viewMode={viewMode} 
                isLedgerView
                hideGhostRow
                onOpenCompare={(ids) => { setCompareSelectedIds(ids || []); setIsCompareModalOpen(true); }}
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

        {/* Detail Panel */}
        <DetailPanel 
          projectId={projectId} 
          opportunities={mergedOpportunities} 
          viewMode={viewMode} 
        />
      </div>

      <CompareModal 
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        projectId={projectId}
        opportunities={opportunities}
        selectedIds={compareSelectedIds}
      />
    </div>
  );
}
