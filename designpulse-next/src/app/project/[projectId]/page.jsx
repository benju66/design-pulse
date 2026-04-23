"use client";
import React, { useState } from 'react';
import { List, LayoutPanelTop } from 'lucide-react';
import MarkupCanvas from '@/components/MarkupCanvas';
import OpportunityGrid from '@/components/OpportunityGrid';
import CompareModal from '@/components/CompareModal';
import BudgetSummary from '@/components/BudgetSummary';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useOpportunities, useCreateOpportunity } from '@/hooks/useProjectQueries';
import { exportToPDFService } from '@/services/api';
import { supabase } from '@/supabaseClient';

export default function ProjectPage({ params }) {
  const resolvedParams = React.use(params);
  const projectId = resolvedParams.projectId;
  const { data: opportunities = [], isLoading } = useOpportunities(projectId);
  const createMutation = useCreateOpportunity(projectId);
  
  const [showMap, setShowMap] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('flat'); // 'flat' | 'card'
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      let allMarkups = [];
      opportunities.forEach(opp => {
        if (opp.design_markups && Array.isArray(opp.design_markups)) {
          const color = opp.status === 'Approved' ? '#10b981' : (opp.status === 'Rejected' ? '#ef4444' : '#38bdf8');
          opp.design_markups.forEach(m => {
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

  const tabs = ['All', 'Corridor / Common', 'Unit Interiors', 'Back of House'];
  const filteredOpportunities = activeTab === 'All' 
    ? opportunities 
    : opportunities.filter(opp => opp.scope === activeTab);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* Top Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Design Pulse - {projectId}</h2>
        <div className="flex gap-3 items-center">
          <ThemeToggle />
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2 ml-2">
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
            onClick={() => setShowMap(!showMap)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors shadow-sm ${
              showMap 
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {showMap ? 'Hide Map' : 'View on Map'}
          </button>
          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            Export PDF
          </button>
          <button 
            onClick={() => createMutation.mutate({})}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Adding...' : '+ New Option'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Grid Area */}
        <div className={`flex flex-col p-6 transition-all duration-300 ${showMap ? 'w-1/2 border-r border-slate-200 dark:border-slate-800' : 'w-full'}`}>
          <div className="shrink-0">
            <BudgetSummary opportunities={opportunities} />
            
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

        {/* Map Area */}
        {showMap && (
          <div className="w-1/2 h-full relative bg-slate-50 dark:bg-slate-900">
            <MarkupCanvas />
          </div>
        )}
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
