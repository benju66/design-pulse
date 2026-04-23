"use client";
import MarkupCanvas from '@/components/MarkupCanvas';
import OpportunityGrid from '@/components/OpportunityGrid';
import BudgetSummary from '@/components/BudgetSummary';
import { useOpportunities } from '@/hooks/useProjectQueries';
import { exportToPDFService } from '@/services/api';
import { supabase } from '@/supabaseClient';

export default function ProjectPage({ params }) {
  const projectId = params.projectId;
  const { data: opportunities = [], isLoading } = useOpportunities(projectId);

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

      // Note: Assuming projectId doubles as the sheetId for the MVP
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

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left side: Markup Canvas */}
      <div className="flex-1 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative">
        <MarkupCanvas />
      </div>
      
      {/* Right side: VE Data Grid */}
      <div className="w-1/2 h-full bg-white dark:bg-slate-950 flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Value Engineering Log</h2>
          
          {/* Quick Actions */}
          <div className="flex gap-3">
            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Export PDF
            </button>
            <button className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold rounded-xl shadow-sm transition-colors">
              + New Option
            </button>
          </div>
        </div>

        <BudgetSummary opportunities={opportunities} />

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-500">Loading log...</div>
          ) : (
            <OpportunityGrid projectId={projectId} data={opportunities} />
          )}
        </div>
      </div>
    </div>
  );
}
