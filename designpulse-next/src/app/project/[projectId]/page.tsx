"use client";
import React, { useState, use } from 'react';
import { List, LayoutPanelTop, PanelRight, PieChart, Plus } from 'lucide-react';
import MarkupCanvas from '@/components/MarkupCanvas';
import OpportunityGrid from '@/components/OpportunityGrid';
import CompareModal from '@/components/CompareModal';
import BudgetSummary from '@/components/BudgetSummary';
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
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'flat' | 'card'
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);

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
      opp.scope,
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

  const dynamicScopes = (settings?.scopes && Array.isArray(settings.scopes) && settings.scopes.length > 0) 
    ? (settings.scopes as string[]) 
    : ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  const tabs = ['All', ...dynamicScopes];
  const filteredOpportunities = React.useMemo(() => {
    return activeTab === 'All' 
      ? opportunities 
      : opportunities.filter(opp => opp.scope === activeTab);
  }, [opportunities, activeTab]);

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
            {currentView === 'map' && 'Map View'}
            {currentView === 'analytics' && 'Project Analytics'}
            {currentView === 'coordination' && 'Design Coordination Tracker'}
            {currentView === 'settings' && 'Project Settings'}
          </h2>
          <div className="flex gap-3 items-center">
            {currentView === 'dashboard' && (
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
                  onClick={() => createMutation.mutate({ scope: activeTab !== 'All' ? activeTab : (dynamicScopes[0] || 'Corridor / Common') })}
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Adding...' : '+ New Item'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          
          {currentView === 'dashboard' && (
            <>
              {/* Main Grid Area */}
              <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 ${
                (viewMode === 'split' && selectedOpportunityId) ? 'border-r border-slate-200 dark:border-slate-800' : ''
              }`}>
                <div className="shrink-0">
                  <BudgetSummary projectId={projectId} opportunities={opportunities} />
                  
                  {/* Scope Tabs */}
                  <div className="flex gap-2 mb-4">
                    {tabs.map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeTab === tab
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentView('settings')}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800 flex items-center justify-center"
                      title="Add New Scope Tab"
                    >
                      <Plus size={16} />
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
            <ProjectSettings projectId={projectId} />
          )}

          {currentView === 'analytics' && (
            <div className="p-8 w-full flex flex-col items-center justify-center h-full">
              <PieChart size={64} className="text-slate-300 dark:text-slate-700 mb-6" />
              <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Analytics Dashboard</h3>
              <p className="text-slate-500 mt-2 text-center max-w-md">
                Detailed cost breakdowns, schedule impact forecasting, and team performance metrics will be available here in a future update.
              </p>
            </div>
          )}

          {currentView === 'coordination' && (
            <div className="p-8 w-full flex flex-col items-center justify-center h-full">
              <List size={64} className="text-slate-300 dark:text-slate-700 mb-6" />
              <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Design Coordination Tracker</h3>
              <p className="text-slate-500 mt-2 text-center max-w-md">
                A structured checklist and tracker for MEP, structural, and architectural coordination tasks. Coming soon!
              </p>
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
