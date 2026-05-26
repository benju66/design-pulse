"use client";
import React from 'react';
import { Plus, PanelRight, List, LayoutPanelTop, Package } from 'lucide-react';
import OpportunityGridV2 from '@/components/OpportunityGridV2';
import BudgetSummary from '@/components/BudgetSummary';
import FloorplanCanvas from '@/components/FloorplanCanvas';
import DetailPanel from '@/components/DetailPanel';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { Button } from '@/components/ui/Button';
import CompareModal from '@/components/CompareModal';
import { SandboxPanel } from '@/components/sandbox/SandboxPanel';
import { AddToPackageMenu } from '@/components/sandbox/AddToPackageMenu';
import { useUIStore } from '@/stores/useUIStore';
import { useOpportunities, useCreateOpportunity } from '@/hooks/useOpportunityQueries';
import { useProjectSettings, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { useProjectEstimateVersions } from '@/hooks/useEstimateQueries';
import { useVePackages } from '@/hooks/useSandboxQueries';
import { exportToPDFService } from '@/services/api';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import type { Opportunity } from '@/types/models';

interface ValueMatrixViewProps {
  projectId: string;
}

export function ValueMatrixView({ projectId }: ValueMatrixViewProps) {
  // ── Queries & Mutations ──
  const { data: opportunities = [], isLoading } = useOpportunities(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { data: estimateVersions = [] } = useProjectEstimateVersions(projectId);
  const createMutation = useCreateOpportunity(projectId);

  // ── UI Store states & actions ──
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isMapVisible = useUIStore(state => state.isMapVisible);
  const viewMode = useUIStore(state => state.veGridViewMode);
  const setViewMode = useUIStore(state => state.setVeGridViewMode);
  const isSandboxPanelOpen = useUIStore(state => state.isSandboxPanelOpen);
  const toggleSandboxPanel = useUIStore(state => state.toggleSandboxPanel);
  const activeSandboxPackageId = useUIStore(state => state.activeSandboxPackageId);
  const navigateToSettings = (tab: import('@/stores/useUIStore').SettingsTab) => 
    useUIStore.getState().navigateToSettings(projectId, tab);

  // ── Permissions ──
  const { permissions } = useCurrentUserPermissions(projectId);
  const canEdit = permissions.can_edit_records;

  // ── Sandbox package highlight IDs ──
  const { data: packages = [] } = useVePackages(projectId);
  const packageHighlightIds = React.useMemo(() => {
    if (!activeSandboxPackageId) return undefined;
    const pkg = packages.find(p => p.id === activeSandboxPackageId);
    if (!pkg) return undefined;
    return new Set(pkg.items.map(item => item.opportunity_id));
  }, [activeSandboxPackageId, packages]);

  // ── Local Filter State ──
  const [activeStatus, setActiveStatus] = React.useState('All');
  const [activeEstimateSyncStatus, setActiveEstimateSyncStatus] = React.useState('All');
  const [activeBuildingAreas, setActiveBuildingAreas] = React.useState<string[]>([]);
  const [activeCostCodes, setActiveCostCodes] = React.useState<string[]>([]);

  // ── Modal State ──
  const [isCompareModalOpen, setIsCompareModalOpen] = React.useState(false);
  const [compareSelectedIds, setCompareSelectedIds] = React.useState<string[]>([]);

  // ── Derived Settings and Filters ──
  const dynamicBuildingAreas = React.useMemo(() => {
    return (settings?.building_areas && Array.isArray(settings.building_areas) && settings.building_areas.length > 0) 
      ? (settings.building_areas as string[]) 
      : ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  }, [settings]);

  const ghostDefaults = React.useMemo(() => ({
    building_area: activeBuildingAreas.length > 0 ? activeBuildingAreas[0] : (dynamicBuildingAreas[0] || 'Corridor / Common'),
    cost_code: activeCostCodes.length > 0 ? activeCostCodes[0] : null,
  }), [activeBuildingAreas, activeCostCodes, dynamicBuildingAreas]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = opportunities.map(o => o.status).filter(Boolean) as string[];
    return Array.from(new Set(statuses)).sort();
  }, [opportunities]);

  const uniqueCostCodes = React.useMemo(() => {
    const codes = opportunities.map(o => o.cost_code).filter(Boolean) as string[];
    return Array.from(new Set(codes)).sort();
  }, [opportunities]);

  const applyBaseFilters = React.useCallback((items: Opportunity[]) => {
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

  const filteredOpportunities = React.useMemo(() => {
    const base = applyBaseFilters(opportunities);
    let filtered = base;
    if (activeStatus !== 'All') {
      filtered = filtered.filter(opp => opp.status === activeStatus);
    }
    if (activeEstimateSyncStatus !== 'All') {
      filtered = filtered.filter(opp => (opp.estimate_sync_status || 'Draft') === activeEstimateSyncStatus);
    }
    return filtered;
  }, [opportunities, applyBaseFilters, activeStatus, activeEstimateSyncStatus]);

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
          Value Matrix
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
          <Button
            variant={isSandboxPanelOpen ? 'primary' : 'secondary'}
            onClick={toggleSandboxPanel}
            title="VE Packages Sandbox"
          >
            <Package size={16} />
            Packages
          </Button>
          <Button 
            onClick={() => createMutation.mutate({ building_area: activeBuildingAreas.length > 0 ? activeBuildingAreas[0] : (dynamicBuildingAreas[0] || 'Corridor / Common') })}
            isLoading={createMutation.isPending}
            loadingText="Adding..."
          >
            + New Item
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Grid Area */}
        <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${
          (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
        }`}>
          <div className="shrink-0 mb-4">
            <BudgetSummary 
              projectId={projectId} 
              opportunities={opportunities} 
              forceCollapse={(viewMode === 'split' && !!selectedOpportunityId) || isSandboxPanelOpen} 
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
                defaultValues={ghostDefaults} 
                onOpenCompare={(ids) => { setCompareSelectedIds(ids || []); setIsCompareModalOpen(true); }}
                activeStatus={activeStatus}
                filterActiveCount={(activeStatus !== 'All' ? 1 : 0) + (activeEstimateSyncStatus !== 'All' ? 1 : 0) + activeBuildingAreas.length + activeCostCodes.length}
                onClearFilters={() => { setActiveStatus('All'); setActiveEstimateSyncStatus('All'); setActiveBuildingAreas([]); setActiveCostCodes([]); }}
                extraBulkActions={canEdit ? (selectedIds) => {
                  // Grid selectedIds may include option/contender subrow IDs — filter to parent opportunity IDs only
                  const opportunityIdSet = new Set(filteredOpportunities.map(o => o.id));
                  const oppIds = selectedIds.filter(id => opportunityIdSet.has(id));
                  if (oppIds.length === 0) return null;
                  return <AddToPackageMenu projectId={projectId} selectedIds={oppIds} />;
                } : undefined}
                packageHighlightIds={packageHighlightIds}
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

        {/* Sandbox Panel — coexists as a flex sibling */}
        {isSandboxPanelOpen && (
          <SandboxPanel projectId={projectId} canEdit={canEdit} />
        )}

        {/* Detail Panel */}
        <DetailPanel 
          projectId={projectId} 
          opportunities={opportunities} 
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
