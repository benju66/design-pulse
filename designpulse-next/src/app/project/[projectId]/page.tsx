"use client";
import React, { use } from 'react';
import { List, LayoutPanelTop, PanelRight, Plus, LayoutGrid, UploadCloud, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
import FloorplanCanvas from '@/components/FloorplanCanvas';
import { SheetTabStrip } from '@/components/canvas/SheetTabStrip';
import { DrawingGrid } from '@/components/drawings/DrawingGrid';
import CompareModal from '@/components/CompareModal';
import { BulkImportModal } from '@/components/coordination/BulkImportModal';
// View components — extracted to reduce monolithic re-renders on sidebar navigation
import { ValueMatrixView } from '@/components/views/ValueMatrixView';
import { BudgetLedgerView } from '@/components/views/BudgetLedgerView';
import { CoordinationView } from '@/components/views/CoordinationView';
import { LessonsLearnedView } from '@/components/views/LessonsLearnedView';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
// Lazy-loaded views — only loaded when the user navigates to them
const AnalyticsDashboard = dynamic(() => import('@/components/analytics/AnalyticsDashboard'));
const MyDeskDashboard = dynamic(() => import('@/components/mydesk/MyDeskDashboard'));
const VersionComparisonViewer = dynamic(
  () => import('@/components/project/VersionComparisonViewer').then(
    m => ({ default: m.VersionComparisonViewer })
  )
);
import PermitBoard from '@/components/permits/PermitBoard';
import { useOpportunities, useCreateOpportunity } from '@/hooks/useOpportunityQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { usePermits, useCreatePermit } from '@/hooks/usePermitQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useMasterLedgerGrid, useProjectEstimateVersions, useEstimateVarianceNotes } from '@/hooks/useEstimateQueries';
import { exportToPDFService } from '@/services/api';
import { supabase } from '@/supabaseClient';
import DrawingDetailPanel from '@/components/drawings/DrawingDetailPanel';
import { useUIStore, ProjectView, SettingsTab, PermitFilters } from '@/stores/useUIStore';
import { useMapStore } from '@/stores/useMapStore';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { useProjectSheets, useSheetMarkups, markupsToZones, useUpdateSheetMarkups } from '@/hooks/useMapQueries';

import { ProjectSidebar } from '@/components/layout/ProjectSidebar';
import { ProjectSettings } from '@/components/project/ProjectSettings';
import { PdfImportModal } from '@/components/drawings/PdfImportModal';
import { Opportunity, MasterLedgerRow } from '@/types/models';

// ── Module-level navigation type guards ─────────────────────────────────────────
const VALID_PROJECT_VIEWS = new Set<ProjectView>([
  'dashboard', 'dashboard-v2', 'budget-compare', 'map', 'analytics',
  'coordination', 'permits', 'my-desk', 'settings', 'lessons'
]);
function isProjectView(v: string | undefined): v is ProjectView {
  return !!v && VALID_PROJECT_VIEWS.has(v as ProjectView);
}

const VALID_SETTINGS_TABS = new Set<SettingsTab>([
  'info', 'team', 'building_areas', 'categories', 'drawings',
  'csi_specs', 'estimate', 'sidebar', 've_matrix', 'coord_matrix', 'brand_standards', 'permits',
]);
function isSettingsTab(v: string | undefined): v is SettingsTab {
  return !!v && VALID_SETTINGS_TABS.has(v as SettingsTab);
}

const EMPTY_PERMIT_FILTERS: PermitFilters = {};

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  useProjectRealtime(projectId);
  const { data: opportunities = [], isLoading } = useOpportunities(projectId);
  const { data: ledgerRows = [], isLoading: isLedgerLoading } = useMasterLedgerGrid(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { data: globalCostCodes = [] } = useCostCodes();
  const createMutation = useCreateOpportunity(projectId);
  const { data: permits = [], isLoading: isPermitsLoading } = usePermits(projectId);
  const createPermitMutation = useCreatePermit(projectId);
  
  // ── Estimate hooks ────────────────────────────────────────────────────────────
  const { data: estimateVersions = [] } = useProjectEstimateVersions(projectId);

  // ── Drawings / Map hooks (called unconditionally per Rules of Hooks) ─────────
  const activeSheetId = useMapStore((s) => s.activeSheetId);
  const isViewerOpen = useMapStore((s) => s.isViewerOpen);
  const setIsViewerOpen = useMapStore((s) => s.setIsViewerOpen);
  const { data: sheets = [] } = useProjectSheets(projectId);
  const { data: rawMarkups = [] } = useSheetMarkups(activeSheetId || null);
  const updateMarkups = useUpdateSheetMarkups();
  
  // ── Navigation state (persisted in Zustand, replaces useState) ────────────────
  const _rawView        = useUIStore(state => state.activeView[projectId]);
  const currentView: ProjectView = isProjectView(_rawView) ? _rawView : 'dashboard';
  const _setActiveView  = useUIStore(state => state.setActiveView);
  const setCurrentView  = React.useMemo(
    () => (view: ProjectView) => _setActiveView(projectId, view),
    [projectId, _setActiveView]
  );

  const _rawTab           = useUIStore(state => state.activeSettingsTab[projectId]);
  const settingsTab: SettingsTab = isSettingsTab(_rawTab) ? _rawTab : 'info';
  const _setActiveTab     = useUIStore(state => state.setActiveSettingsTab);
  const setSettingsTab    = React.useMemo(
    () => (tab: SettingsTab) => _setActiveTab(projectId, tab),
    [projectId, _setActiveTab]
  );

  const _navigateFn         = useUIStore(state => state.navigateToSettings);
  const navigateToSettings  = React.useMemo(
    () => (tab: SettingsTab) => _navigateFn(projectId, tab),
    [projectId, _navigateFn]
  );

  // VE grid view mode — flat selector, no wrapper needed (same as coordinationViewMode)
  const viewMode    = useUIStore(state => state.veGridViewMode);
  const setViewMode = useUIStore(state => state.setVeGridViewMode);

  const [activeBuildingAreas, setActiveBuildingAreas] = React.useState<string[]>([]);
  const [activeCostCodes, setActiveCostCodes] = React.useState<string[]>([]);
  const [activeStatus, setActiveStatus] = React.useState('All');
  const [activeEstimateSyncStatus, setActiveEstimateSyncStatus] = React.useState('All');
  const [varianceThreshold, setVarianceThreshold] = React.useState<number>(0);
  const [showVeOnly, setShowVeOnly] = React.useState(false);
  const [showIncorporated, setShowIncorporated] = React.useState(false);
  const [coordActiveBuildingAreas, setCoordActiveBuildingAreas] = React.useState<string[]>([]);
  const [coordActiveCostCodes, setCoordActiveCostCodes] = React.useState<string[]>([]);
  const [coordActiveType, setCoordActiveType] = React.useState('All');
  const [coordActiveStatus, setCoordActiveStatus] = React.useState('All');
  const [coordActiveDisciplines, setCoordActiveDisciplines] = React.useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = React.useState(false);
  const [compareSelectedIds, setCompareSelectedIds] = React.useState<string[]>([]);
  const [isBulkImportOpen, setIsBulkImportOpen] = React.useState(false);
  const [isPdfImportOpen, setIsPdfImportOpen] = React.useState(false);
  const drawingGridViewMode = useUIStore(state => state.drawingGridViewMode);
  const selectedDrawingId = useUIStore(state => state.selectedDrawingId);
  const coordinationViewMode = useUIStore(state => state.coordinationViewMode);
  const setCoordinationViewMode = useUIStore(state => state.setCoordinationViewMode);
  const permitViewMode = useUIStore(state => state.permitViewMode);
  const setPermitViewMode = useUIStore(state => state.setPermitViewMode);

  const permitFilters = useUIStore(state => state.permitFilters[projectId] || EMPTY_PERMIT_FILTERS);
  const _setPermitFilters = useUIStore(state => state.setPermitFilters);
  const setPermitFilters = React.useCallback((filters: PermitFilters) => _setPermitFilters(projectId, filters), [projectId, _setPermitFilters]);

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
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDF');
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
      // For CSV export, look up the version name if possible, else use ID
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

  const dynamicBuildingAreas = (settings?.building_areas && Array.isArray(settings.building_areas) && settings.building_areas.length > 0) 
    ? (settings.building_areas as string[]) 
    : ['Corridor / Common', 'Unit Interiors', 'Back of House'];



  // Phase 2: derive active version ID and fetch variance notes (active-only scope)
  const activeVersionId = React.useMemo(
    () => estimateVersions.find(v => v.is_active)?.id ?? null,
    [estimateVersions]
  );
  const { data: varianceNotes = [] } = useEstimateVarianceNotes(
    activeVersionId ? projectId : null,  // AGENTS.md C11: null, never undefined
    activeVersionId
  );
  const varianceNoteMap = React.useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const n of varianceNotes) {
      if (n.cost_code) map[n.cost_code] = n.variance_note;
    }
    return map;
  }, [varianceNotes]);


  const mergedOpportunities = React.useMemo(() => {
    // Filter out RPC rows with null/empty cost_code — unassigned VEs already appear
    // as real opportunity rows; a budget-line duplicate would be a phantom.
    const budgetOpps: Opportunity[] = ledgerRows
      .filter((row: MasterLedgerRow) => row.cost_code != null && row.cost_code !== '')
      .map((row: MasterLedgerRow) => ({
      id: `budget-${row.cost_code}`,
      project_id: projectId,
      title: row.description || `Budget: ${row.cost_code}`,
      cost_code: row.cost_code,
      // csi_division is the 2-digit MasterFormat prefix from the cost_code, NOT from project_csi_specs
      division: row.csi_division && row.csi_division.split('').every((ch: string) => ch >= '0' && ch <= '9') ? row.csi_division + '0000' : 'Uncategorized',
      status: 'Budget Line',
      cost_impact: row.baseline_budget,
      days_impact: 0,
      is_budget_line: true,
      // Ledger financial columns — server-computed (AGENTS.md C5)
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

    // ── Normalize VE opportunity cost codes for ledger grouping ──────────────
    // VE items may have raw, un-normalized cost codes (e.g. "61753.M" instead of
    // "061753") from legacy coordination imports or manual entry. This causes
    // fake divisions (DIVISION 61 instead of 06) and orphan sub-groups.
    // Normalize at merge time (display-layer only — no DB mutation).
    // iOS-safe: char loop for digit validation, no regex (AGENTS.md A).
    const normalizedOpps = opportunities.map(opp => {
      if ((opp as Record<string, unknown>).is_budget_line) return opp;
      const raw = opp.cost_code;
      // No cost code → force into the Uncategorized bucket
      if (!raw) return opp.division === 'Uncategorized' ? opp : { ...opp, division: 'Uncategorized' };
      // Strip cost_type suffix (.L, .M, .S, .E, .O)
      const dotIdx = raw.indexOf('.');
      const base = dotIdx !== -1 ? raw.slice(0, dotIdx) : raw;
      // Validate all-digit (iOS-safe — no regex)
      let allDigit = base.length > 0;
      for (let i = 0; i < base.length; i++) {
        if (base[i] < '0' || base[i] > '9') { allDigit = false; break; }
      }
      // Non-numeric cost code (e.g. "Uncategorized") → force into Uncategorized bucket
      if (!allDigit) return opp.division === 'Uncategorized' ? opp : { ...opp, division: 'Uncategorized' };
      // Pad to 6 digits and re-derive division
      const padded = base.padStart(6, '0');
      const division = padded.slice(0, 2) + '0000';
      if (padded === raw && opp.division === division) return opp; // already clean
      return { ...opp, cost_code: padded, division };
    });

    return [...normalizedOpps, ...budgetOpps];
  }, [opportunities, ledgerRows, projectId]);

  // Shared base filter — no currentView dependency, so sidebar switches don't trigger recomputation
  // NOTE: activeStatus is NOT included here — it's view-specific (only Value Matrix uses it).
  // Including it here caused a ghost filter where status set in VM silently leaked into the Budget Ledger.
  // Normalize record_type: items created in the Value Matrix have record_type: null,
  // only Coordination Board items explicitly set 'Coordination'. Treat null/undefined as 'VE'.
  const effectiveRecordType = (opp: Opportunity) => opp.record_type || 'VE';

  const applyBaseFilters = React.useCallback((items: Opportunity[]) => {
    return items.filter(opp => {
      const rt = effectiveRecordType(opp);
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

  // Value Matrix filtered items (from raw opportunities only)
  // activeStatus is applied here — scoped to VM only, never leaks into Budget Ledger
  const filteredOpportunities = React.useMemo(
    () => {
      const base = applyBaseFilters(opportunities);
      let filtered = base;
      if (activeStatus !== 'All') {
        filtered = filtered.filter(opp => opp.status === activeStatus);
      }
      if (activeEstimateSyncStatus !== 'All') {
        filtered = filtered.filter(opp => (opp.estimate_sync_status || 'Draft') === activeEstimateSyncStatus);
      }
      return filtered;
    },
    [opportunities, applyBaseFilters, activeStatus, activeEstimateSyncStatus]
  );

  // Budget Ledger filtered items (from merged dataset, with variance threshold + VE focus)
  const filteredLedgerItems = React.useMemo(() => {
    const base = applyBaseFilters(mergedOpportunities);

    // VE Focus: compute set of cost codes that have at least one VE item
    let veCostCodes: Set<string> | null = null;
    if (showVeOnly) {
      veCostCodes = new Set(
        base.filter(o => !o.is_budget_line && o.cost_code && (!o.incorporated_version_id || showIncorporated)).map(o => o.cost_code as string)
      );
    }

    return base.filter(opp => {
      // VE Focus filter — hide budget lines whose cost code has no VE items
      if (showVeOnly && opp.is_budget_line && !veCostCodes?.has(opp.cost_code || '')) return false;
      // Variance threshold — only applies to budget lines
      if (varianceThreshold > 0 && opp.is_budget_line) {
        const totalVariance = Math.abs(
          (Number(opp.pending_changes) || 0) + (Number(opp.approved_changes) || 0)
        );
        if (totalVariance < varianceThreshold) return false;
      }
      
      // Filter out incorporated items unless showIncorporated is true
      if (!opp.is_budget_line) {
        const isInc = opp.incorporated_version_id != null || opp.estimate_sync_status === 'Incorporated';
        if (isInc && !showIncorporated) return false;
      }
      
      return true;
    }).map(opp => {
      // Tag incorporated items for the UI renderer
      if (!opp.is_budget_line && (opp.incorporated_version_id != null || opp.estimate_sync_status === 'Incorporated')) {
        return { ...opp, is_incorporated: true } as Opportunity;
      }
      return opp;
    });
  }, [mergedOpportunities, applyBaseFilters, varianceThreshold, showVeOnly, showIncorporated]);

  // Centralized ledger filter count + clear handler (single source of truth — not duplicated in the view)
  const ledgerFilterActiveCount = activeBuildingAreas.length + activeCostCodes.length + (varianceThreshold > 0 ? 1 : 0) + (showVeOnly ? 1 : 0) + (showIncorporated ? 1 : 0);
  const ledgerClearFilters = React.useCallback(() => {
    setActiveBuildingAreas([]); setActiveCostCodes([]); setVarianceThreshold(0); setShowVeOnly(false); setShowIncorporated(false);
  }, []);

  const uniqueCostCodes = React.useMemo(() => {
    const codes = mergedOpportunities.map(o => o.cost_code).filter(Boolean) as string[];
    return Array.from(new Set(codes)).sort();
  }, [mergedOpportunities]);

  const globalCostCodeStrings = React.useMemo(() => {
    return globalCostCodes
      .map(c => c.description ? `${c.code} - ${c.description}` : c.code);
  }, [globalCostCodes]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = opportunities.map(o => o.status).filter(Boolean) as string[];
    return Array.from(new Set(statuses)).sort();
  }, [opportunities]);

  const coordinationOpportunities = React.useMemo(() => {
    return opportunities.filter(opp => {
      const rt = effectiveRecordType(opp);
      if (rt === 'Coordination') return true;
      // Any VE item with an active coordination_status (not null, not 'Not Required')
      // should appear on the Coordination Board — regardless of its VE status
      // (Draft = early-start, Pending Review = in-flight, Approved = locked decision)
      if (rt === 'VE' && opp.coordination_status && opp.coordination_status !== 'Not Required') {
        return true;
      }
      return false;
    });
  }, [opportunities]);

  const uniqueCoordTypes = React.useMemo(() => {
    const types = coordinationOpportunities.map(o => o.record_type || 'VE').filter(Boolean) as string[];
    return Array.from(new Set(types)).sort();
  }, [coordinationOpportunities]);

  const uniqueCoordStatuses = React.useMemo(() => {
    const statuses = coordinationOpportunities.map(o => o.coordination_status).filter(Boolean) as string[];
    return Array.from(new Set(statuses)).sort();
  }, [coordinationOpportunities]);

  const uniqueCoordCostCodes = React.useMemo(() => {
    const codes = coordinationOpportunities.map(o => o.cost_code).filter(Boolean) as string[];
    return Array.from(new Set(codes)).sort();
  }, [coordinationOpportunities]);

  const projectDisciplines = (settings?.disciplines as {id: string, label: string}[]) || [];
  const disciplineLabels = projectDisciplines.map(d => d.label);

  const filteredCoordinationOpportunities = React.useMemo(() => {
    return coordinationOpportunities.filter(opp => {
      if (coordActiveType !== 'All' && (opp.record_type || 'VE') !== coordActiveType) return false;
      if (coordActiveStatus !== 'All' && opp.coordination_status !== coordActiveStatus) return false;
      if (coordActiveBuildingAreas.length > 0 && !coordActiveBuildingAreas.includes(opp.building_area || '')) return false;
      if (coordActiveCostCodes.length > 0 && !coordActiveCostCodes.includes(opp.cost_code || '')) return false;
      
      if (coordActiveDisciplines.length > 0) {
        const details = (opp.coordination_details as Record<string, any>) || {};
        const matchingDisciplineIds = projectDisciplines
          .filter(d => coordActiveDisciplines.includes(d.label))
          .map(d => d.id);
          
        const hasMatchingDiscipline = matchingDisciplineIds.some(id => {
          const disc = details[id];
          return disc && disc.status && disc.status !== 'Not Required';
        });
        
        if (!hasMatchingDiscipline) return false;
      }

      return true;
    });
  }, [coordinationOpportunities, coordActiveType, coordActiveStatus, coordActiveBuildingAreas, coordActiveCostCodes, coordActiveDisciplines, projectDisciplines]);

  const filteredPermits = React.useMemo(() => {
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

  const clearPermitFilters = React.useCallback(() => {
    setPermitFilters({});
  }, [setPermitFilters]);

  const permitTypes = (settings?.permit_types as {id: string, label: string}[]) || [];
  const permitAHJs = (settings?.permit_ahjs as {id: string, label: string}[]) || [];
  const permitTypeOptions = React.useMemo(() => permitTypes.map(t => t.label), [permitTypes]);
  const permitAHJOptions = React.useMemo(() => permitAHJs.map(a => a.label), [permitAHJs]);

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
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* Left Sidebar Layout */}
      <ProjectSidebar 
        projectId={projectId} 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
      />

      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Top Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {currentView === 'dashboard' && 'Value Matrix'}
            {currentView === 'dashboard-v2' && 'Budget Ledger'}
            {currentView === 'map' && 'Drawings'}
            {currentView === 'analytics' && 'Project Analytics'}
            {currentView === 'coordination' && 'Design Coordination Board'}
            {currentView === 'permits' && 'Permits Tracker'}
            {currentView === 'my-desk' && 'My Desk'}
            {currentView === 'settings' && 'Project Settings'}
            {currentView === 'budget-compare' && 'Version Comparison Matrix'}
            {currentView === 'lessons' && 'Lessons Learned'}
          </h2>
          <div className="flex gap-3 items-center">
            {(currentView === 'dashboard' || currentView === 'dashboard-v2') && (
              <>
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
                <Button 
                  onClick={() => createMutation.mutate({ building_area: activeBuildingAreas.length > 0 ? activeBuildingAreas[0] : (dynamicBuildingAreas[0] || 'Corridor / Common') })}
                  isLoading={createMutation.isPending}
                  loadingText="Adding..."
                >
                  + New Item
                </Button>
              </>
            )}
            
            {currentView === 'coordination' && (
              <>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2 ml-2">
                  <button
                    onClick={() => setCoordinationViewMode('table-split')}
                    className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                      coordinationViewMode === 'table-split' 
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                    title="Split View"
                  >
                    <PanelRight size={18} />
                  </button>
                  <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
                  <button
                    onClick={() => setCoordinationViewMode('board')}
                    className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                      coordinationViewMode === 'board' 
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                    title="Board View"
                  >
                    <LayoutGrid size={18} />
                  </button>
                </div>
                <Button 
                  intent="coordination"
                  onClick={() => setIsBulkImportOpen(true)}
                >
                  <UploadCloud size={16} className="mr-2" />
                  Bulk Import
                </Button>
              </>
            )}

            {currentView === 'map' && (
              isViewerOpen ? (
                <Button
                  variant="secondary"
                  onClick={() => setIsViewerOpen(false)}
                >
                  <List size={16} />
                  Close Drawing
                </Button>
              ) : (
                <Button
                  intent="drawings"
                  id="drawings-import-btn"
                  onClick={() => setIsPdfImportOpen(true)}
                >
                  <Upload size={16} />
                  Import Drawings
                </Button>
              )
            )}

            {currentView === 'permits' && (
              <>
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
                  <Plus size={16} strokeWidth={3} /> New Permit
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          
          {currentView === 'dashboard' && (
            <ValueMatrixView
              projectId={projectId}
              opportunities={opportunities}
              filteredOpportunities={filteredOpportunities}
              viewMode={viewMode}
              isLoading={isLoading}
              onOpenCompare={(ids) => { setCompareSelectedIds(ids || []); setIsCompareModalOpen(true); }}
              activeStatus={activeStatus}
              setActiveStatus={setActiveStatus}
              activeEstimateSyncStatus={activeEstimateSyncStatus}
              setActiveEstimateSyncStatus={setActiveEstimateSyncStatus}
              activeBuildingAreas={activeBuildingAreas}
              setActiveBuildingAreas={setActiveBuildingAreas}
              activeCostCodes={activeCostCodes}
              setActiveCostCodes={setActiveCostCodes}
              uniqueStatuses={uniqueStatuses}
              dynamicBuildingAreas={dynamicBuildingAreas}
              uniqueCostCodes={uniqueCostCodes}
              navigateToSettings={navigateToSettings}
            />
          )}

          {currentView === 'dashboard-v2' && (
            <BudgetLedgerView
              projectId={projectId}
              filteredOpportunities={filteredLedgerItems}
              allOpportunities={mergedOpportunities}
              viewMode={viewMode}
              isLoading={isLoading || isLedgerLoading}
              onOpenCompare={(ids) => { setCompareSelectedIds(ids || []); setIsCompareModalOpen(true); }}
              activeBuildingAreas={activeBuildingAreas}
              setActiveBuildingAreas={setActiveBuildingAreas}
              activeCostCodes={activeCostCodes}
              setActiveCostCodes={setActiveCostCodes}
              varianceThreshold={varianceThreshold}
              setVarianceThreshold={setVarianceThreshold}
              showVeOnly={showVeOnly}
              setShowVeOnly={setShowVeOnly}
              showIncorporated={showIncorporated}
              setShowIncorporated={setShowIncorporated}
              filterActiveCount={ledgerFilterActiveCount}
              onClearFilters={ledgerClearFilters}
              dynamicBuildingAreas={dynamicBuildingAreas}
              uniqueCostCodes={uniqueCostCodes}
              navigateToSettings={navigateToSettings}
              varianceNoteMap={varianceNoteMap}
              activeVersionId={activeVersionId}
            />
          )}

          {currentView === 'budget-compare' && (
            <div className="flex-1 overflow-hidden p-6">
              <VersionComparisonViewer projectId={projectId} />
            </div>
          )}

          {currentView === 'map' && (() => {
            const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
            const zones = markupsToZones(rawMarkups);
            // Determine if the sheet is ready for canvas rendering.
            // During processing, max_zoom/original_width/original_height are null.
            // Rendering FloorplanCanvas with maxZoom=0 causes TileRenderer to request
            // non-existent tiles (400 errors from Supabase Storage).
            const isSheetReady = activeSheet?.status === 'ready'
              && activeSheet.max_zoom != null
              && activeSheet.original_width != null
              && activeSheet.original_height != null;

            // Zone persistence — all unlinked (opportunityId: null, AGENTS.md C11)
            const saveZones = (updatedZones: typeof zones) => {
              if (!activeSheetId) return;
              updateMarkups.mutate({
                sheetId: activeSheetId,
                opportunityId: null,
                markups: updatedZones,
              });
            };

            return (
              <div className="flex flex-col w-full h-full overflow-hidden">
                <div className="flex-1 relative bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-row">
                  {!isViewerOpen ? (
                    <>
                      <div className={`flex flex-col flex-1 min-w-0 h-full @container ${
                        (drawingGridViewMode === 'split' && selectedDrawingId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
                      }`}>
                        <DrawingGrid
                          projectId={projectId}
                          sheets={sheets}
                          disciplines={settings?.disciplines || []}
                          onOpenViewer={(sheetId) => {
                            const store = useMapStore.getState();
                            store.setActiveSheetId(sheetId);
                            store.addOpenSheetId(sheetId);
                            setIsViewerOpen(true);
                          }}
                        />
                      </div>
                      
                      <DrawingDetailPanel
                        projectId={projectId}
                        sheets={sheets}
                        disciplines={settings?.disciplines || []}
                      />
                    </>
                  ) : activeSheetId && isSheetReady ? (
                    <>
                      <FloorplanCanvas
                        projectId={projectId}
                        sheetId={activeSheetId}
                        maxZoom={activeSheet.max_zoom ?? undefined}
                        originalWidth={activeSheet.original_width ?? undefined}
                        originalHeight={activeSheet.original_height ?? undefined}
                        zones={zones}
                        onPolygonComplete={(points) => {
                          const newZone = {
                            id: crypto.randomUUID(),
                            label: '',
                            coordinates: points,
                            color: '#3b82f6',
                            opacity: 0.35,
                          };
                          saveZones([...zones, newZone]);
                        }}
                        onUpdateZonePolygon={(zoneId, points) => {
                          saveZones(
                            zones.map((z) => (z.id === zoneId ? { ...z, coordinates: points } : z))
                          );
                        }}
                        onDeleteZone={(zoneId) => {
                          const ids = Array.isArray(zoneId) ? zoneId : [zoneId];
                          saveZones(zones.filter((z) => !ids.includes(z.id)));
                        }}
                      />
                    </>
                  ) : activeSheetId && activeSheet?.status === 'processing' ? (
                    <div className="flex flex-col h-full items-center justify-center gap-4 text-slate-400 dark:text-slate-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent" />
                      <p className="text-sm font-medium">Processing sheet&hellip;</p>
                      <p className="text-xs text-slate-400">
                        {activeSheet.progress_percent != null && activeSheet.progress_percent > 0
                          ? `${activeSheet.progress_percent}% complete`
                          : 'Generating tile pyramid'}
                      </p>
                    </div>
                  ) : activeSheetId && activeSheet?.status === 'error' ? (
                    <div className="flex flex-col h-full items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
                      <p className="text-sm text-red-400">Processing failed.</p>
                      <p className="text-xs">Right-click the tab below and choose <span className="font-semibold text-sky-400">Re-upload PDF</span>.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
                      <p className="text-sm">No sheets yet.</p>
                      <p className="text-xs">Click <span className="font-semibold text-sky-500">+ Add Sheet</span> below to upload a PDF.</p>
                    </div>
                  )}
                </div>
                {isViewerOpen && <SheetTabStrip projectId={projectId} sheets={sheets} />}
              </div>
            );
          })()}

          {currentView === 'settings' && (
            <ProjectSettings
              projectId={projectId}
              activeTab={settingsTab}
              onTabChange={setSettingsTab}
            />
          )}

          {currentView === 'analytics' && (
            <AnalyticsDashboard projectId={projectId} opportunities={filteredOpportunities} />
          )}

          {currentView === 'my-desk' && (
            <MyDeskDashboard projectId={projectId} opportunities={opportunities} />
          )}

          {currentView === 'coordination' && (
            <CoordinationView
              projectId={projectId}
              filteredOpportunities={filteredCoordinationOpportunities}
              coordinationViewMode={coordinationViewMode}
              coordActiveType={coordActiveType}
              setCoordActiveType={setCoordActiveType}
              coordActiveStatus={coordActiveStatus}
              setCoordActiveStatus={setCoordActiveStatus}
              coordActiveBuildingAreas={coordActiveBuildingAreas}
              setCoordActiveBuildingAreas={setCoordActiveBuildingAreas}
              coordActiveDisciplines={coordActiveDisciplines}
              setCoordActiveDisciplines={setCoordActiveDisciplines}
              coordActiveCostCodes={coordActiveCostCodes}
              setCoordActiveCostCodes={setCoordActiveCostCodes}
              uniqueCoordTypes={uniqueCoordTypes}
              uniqueCoordStatuses={uniqueCoordStatuses}
              uniqueCoordCostCodes={uniqueCoordCostCodes}
              dynamicBuildingAreas={dynamicBuildingAreas}
              disciplineLabels={disciplineLabels}
            />
          )}

          {currentView === 'permits' && (
            <PermitBoard 
              projectId={projectId}
              permits={filteredPermits}
              isLoading={isPermitsLoading}
              filterSlot={permitFilterSlot}
              filterActiveCount={permitFilterActiveCount}
              onClearFilters={clearPermitFilters}
              createMutation={createPermitMutation}
            />
          )}

          {currentView === 'lessons' && (
            <div className="flex-1 overflow-hidden">
              <LessonsLearnedView projectId={projectId} />
            </div>
          )}

        </div>
      </div>

      <CompareModal 
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        projectId={projectId}
        opportunities={opportunities}
        selectedIds={compareSelectedIds}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        projectId={projectId}
        projectSettings={settings || null}
        costCodes={globalCostCodeStrings}
      />

      {isPdfImportOpen && (
        <PdfImportModal
          projectId={projectId}
          onClose={() => setIsPdfImportOpen(false)}
        />
      )}
    </div>
  );
}
