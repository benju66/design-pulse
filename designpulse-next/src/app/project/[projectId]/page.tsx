"use client";
import React, { useState, use } from 'react';
import { List, LayoutPanelTop, PanelRight, Plus, LayoutGrid } from 'lucide-react';
import MarkupCanvas from '@/components/MarkupCanvas';
import OpportunityGrid from '@/components/OpportunityGrid';
import OpportunityGridV2 from '@/components/OpportunityGridV2';
import CompareModal from '@/components/CompareModal';
import BudgetSummary from '@/components/BudgetSummary';
import BudgetSummaryV2 from '@/components/BudgetSummaryV2';
import CoordinationBoard from '@/components/coordination/CoordinationBoard';
import CoordinationTable from '@/components/coordination/CoordinationTable';
import { CoordinationDetailPanel } from '@/components/coordination/CoordinationDetailPanel';
import { CoordinationSummary } from '@/components/coordination/CoordinationSummary';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import MyDeskDashboard from '@/components/mydesk/MyDeskDashboard';
import { useOpportunities, useCreateOpportunity, useProjectSettings } from '@/hooks/useProjectQueries';
import { exportToPDFService } from '@/services/api';
import { supabase } from '@/supabaseClient';
import DetailPanel from '@/components/DetailPanel';
import { useUIStore } from '@/stores/useUIStore';

import { ProjectSidebar } from '@/components/layout/ProjectSidebar';
import { ProjectSettings } from '@/components/project/ProjectSettings';

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { data: opportunities = [], isLoading } = useOpportunities(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const createMutation = useCreateOpportunity(projectId);
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [settingsTab, setSettingsTab] = useState('info');
  const [activeTab, setActiveTab] = useState('All');
  const [activeCostCode, setActiveCostCode] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const [coordActiveType, setCoordActiveType] = useState('All');
  const [coordActiveStatus, setCoordActiveStatus] = useState('All');
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'flat' | 'card'
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const coordinationViewMode = useUIStore(state => state.coordinationViewMode);
  const setCoordinationViewMode = useUIStore(state => state.setCoordinationViewMode);

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
    const headers = ['ID', 'Title', 'Priority', 'Location', 'Scope', 'Status', 'Cost Impact', 'Days Impact'];
    
    const escapeCSV = (value: any) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = opportunities.map(opp => [
      opp.display_id,
      opp.title,
      opp.priority,
      opp.location,
      opp.building_area,
      opp.status,
      opp.cost_impact,
      opp.days_impact
    ].map(escapeCSV).join(','));

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
  const tabs = ['All', ...dynamicBuildingAreas];
  const filteredOpportunities = React.useMemo(() => {
    const baseMatrixItems = opportunities.filter(opp => {
      if (opp.record_type === 'VE') return true;
      if (opp.record_type === 'Coordination') {
        const cost = Number(opp.cost_impact) || 0;
        const days = Number(opp.days_impact) || 0;
        const isEscalated = (opp.coordination_details as Record<string, any>)?.is_escalated === true;
        return cost !== 0 || days !== 0 || isEscalated;
      }
      return false;
    });
    return baseMatrixItems.filter(opp => {
      if (activeTab !== 'All' && opp.building_area !== activeTab) return false;
      if (activeCostCode !== 'All' && opp.cost_code !== activeCostCode) return false;
      if (activeStatus !== 'All' && opp.status !== activeStatus) return false;
      return true;
    });
  }, [opportunities, activeTab, activeCostCode, activeStatus]);

  const uniqueCostCodes = React.useMemo(() => {
    const codes = opportunities.map(o => o.cost_code).filter(Boolean) as string[];
    return Array.from(new Set(codes)).sort();
  }, [opportunities]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = opportunities.map(o => o.status).filter(Boolean) as string[];
    return Array.from(new Set(statuses)).sort();
  }, [opportunities]);

  const coordinationOpportunities = React.useMemo(() => {
    return opportunities.filter(opp => {
      if (opp.record_type === 'Coordination') return true;
      if (opp.record_type === 'VE' && (opp.status === 'Pending Plan Update' || opp.status === 'Approved')) return true;
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

  const filteredCoordinationOpportunities = React.useMemo(() => {
    return coordinationOpportunities.filter(opp => {
      if (coordActiveType !== 'All' && (opp.record_type || 'VE') !== coordActiveType) return false;
      if (coordActiveStatus !== 'All' && opp.coordination_status !== coordActiveStatus) return false;
      return true;
    });
  }, [coordinationOpportunities, coordActiveType, coordActiveStatus]);

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
            {currentView === 'dashboard' && 'Value Engineering Matrix'}
            {currentView === 'dashboard-v2' && 'Value Engineering Matrix V2'}
            {currentView === 'map' && 'Map View'}
            {currentView === 'analytics' && 'Project Analytics'}
            {currentView === 'coordination' && 'Design Coordination Tracker'}
            {currentView === 'my-desk' && 'My Desk'}
            {currentView === 'settings' && 'Project Settings'}
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
                <button 
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  Export CSV
                </button>
                <button 
                  onClick={handleExport}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  Export PDF
                </button>
                <button 
                  onClick={() => createMutation.mutate({ building_area: activeTab !== 'All' ? activeTab : (dynamicBuildingAreas[0] || 'Corridor / Common') })}
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Adding...' : '+ New Item'}
                </button>
              </>
            )}
            
            {currentView === 'coordination' && (
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
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          
          {currentView === 'dashboard' && (
            <>
              {/* Main Grid Area */}
              <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${
                (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
              }`}>
                <div className="shrink-0">
                  <BudgetSummary projectId={projectId} opportunities={opportunities} />
                  
                  {/* Filter Toolbar */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full">
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters</span>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    
                    {/* Status Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors hover:border-sky-300 dark:hover:border-sky-700">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">VE Status:</span>
                      <select
                        value={activeStatus}
                        onChange={(e) => setActiveStatus(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="All">All</option>
                        {uniqueStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    {/* Building Area Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors hover:border-sky-300 dark:hover:border-sky-700">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Building Area:</span>
                      <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        {tabs.map(tab => (
                          <option key={tab} value={tab}>{tab}</option>
                        ))}
                      </select>
                      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                      <button
                        onClick={() => {
                          setSettingsTab('building_areas');
                          setCurrentView('settings');
                        }}
                        className="text-slate-400 hover:text-sky-500 transition-colors"
                        title="Manage Building Areas"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Cost Code Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors hover:border-sky-300 dark:hover:border-sky-700">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cost Code:</span>
                      <select
                        value={activeCostCode}
                        onChange={(e) => setActiveCostCode(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="All">All</option>
                        {uniqueCostCodes.map(code => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1" />
                    <button className="text-xs font-medium text-slate-400 hover:text-sky-500 pr-3 transition-colors flex items-center gap-1">
                      <Plus size={14} /> Add Filter
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-500">Loading log...</div>
                  ) : (
                    <OpportunityGrid 
                      projectId={projectId} 
                      data={filteredOpportunities} 
                      viewMode={viewMode} 
                      onOpenCompare={() => setIsCompareModalOpen(true)}
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
          )}

          {currentView === 'dashboard-v2' && (
            <>
              {/* Main Grid Area */}
              <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${
                (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
              }`}>
                <div className="shrink-0">
                  <BudgetSummaryV2 projectId={projectId} opportunities={opportunities} />
                  
                  {/* Filter Toolbar */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full">
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters</span>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    
                    {/* Building Area Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors hover:border-sky-300 dark:hover:border-sky-700">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Building Area:</span>
                      <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        {tabs.map(tab => (
                          <option key={tab} value={tab}>{tab}</option>
                        ))}
                      </select>
                      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                      <button
                        onClick={() => {
                          setSettingsTab('building_areas');
                          setCurrentView('settings');
                        }}
                        className="text-slate-400 hover:text-sky-500 transition-colors"
                        title="Manage Building Areas"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="flex-1" />
                    <button className="text-xs font-medium text-slate-400 hover:text-sky-500 pr-3 transition-colors flex items-center gap-1">
                      <Plus size={14} /> Add Filter
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-500">Loading log...</div>
                  ) : (
                    <OpportunityGridV2 
                      projectId={projectId} 
                      data={filteredOpportunities} 
                      viewMode={viewMode} 
                      onOpenCompare={() => setIsCompareModalOpen(true)}
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
          )}

          {currentView === 'map' && (
            <>
              <div className="w-full h-full relative bg-slate-50 dark:bg-slate-900 shrink-0">
                <MarkupCanvas />
              </div>
              <DetailPanel 
                projectId={projectId} 
                opportunities={opportunities} 
                viewMode={'split'} 
              />
            </>
          )}

          {currentView === 'settings' && (
            <ProjectSettings projectId={projectId} initialTab={settingsTab} />
          )}

          {currentView === 'analytics' && (
            <AnalyticsDashboard projectId={projectId} opportunities={filteredOpportunities} />
          )}

          {currentView === 'my-desk' && (
            <MyDeskDashboard projectId={projectId} opportunities={opportunities} />
          )}

          {currentView === 'coordination' && (
            <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950">
              <div className="flex flex-1 overflow-hidden px-6 pb-6 pt-6">
                <div className={`flex flex-col flex-1 min-w-0 @container ${selectedOpportunityId && coordinationViewMode === 'table-split' ? 'border-r border-slate-200 dark:border-slate-800 pr-6' : ''}`}>
                  
                  <div className="shrink-0">
                    <CoordinationSummary opportunities={filteredCoordinationOpportunities} />
                  </div>
                  
                  <div className="shrink-0 mb-4 mt-2">
                    <div className="flex flex-wrap items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full">
                      <div className="flex items-center gap-2 pl-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters</span>
                      </div>
                      
                      <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                      
                      {/* Type Filter */}
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors hover:border-sky-300 dark:hover:border-sky-700">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Type:</span>
                        <select
                          value={coordActiveType}
                          onChange={(e) => setCoordActiveType(e.target.value)}
                          className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="All">All</option>
                          {uniqueCoordTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      {/* Status Filter */}
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors hover:border-sky-300 dark:hover:border-sky-700">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</span>
                        <select
                          value={coordActiveStatus}
                          onChange={(e) => setCoordActiveStatus(e.target.value)}
                          className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="All">All</option>
                          {uniqueCoordStatuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1" />
                      <button className="text-xs font-medium text-slate-400 hover:text-sky-500 pr-3 transition-colors flex items-center gap-1">
                        <Plus size={14} /> Add Filter
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {coordinationViewMode.startsWith('table') ? (
                      <CoordinationTable projectId={projectId} opportunities={filteredCoordinationOpportunities} viewMode={coordinationViewMode.replace('table-', '')} />
                    ) : (
                      <CoordinationBoard projectId={projectId} opportunities={filteredCoordinationOpportunities} />
                    )}
                  </div>
                </div>

                {coordinationViewMode === 'table-split' && selectedOpportunityId && filteredCoordinationOpportunities.find(o => o.id === selectedOpportunityId) && (
                  <div className="pl-6 h-full">
                    <CoordinationDetailPanel 
                      projectId={projectId} 
                      opportunity={filteredCoordinationOpportunities.find(o => o.id === selectedOpportunityId)!} 
                    />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <CompareModal 
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        projectId={projectId}
        opportunities={opportunities}
      />
    </div>
  );
}
