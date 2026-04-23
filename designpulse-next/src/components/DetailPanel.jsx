"use client";
import React, { useState } from 'react';
import { ExternalLink, Maximize, Minimize, X } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ExpandedCard } from './OpportunityGrid';
import { useUpdateOpportunity } from '@/hooks/useProjectQueries';

export default function DetailPanel({ projectId, opportunities, viewMode }) {
  const { selectedOpportunityId, setSelectedOpportunityId } = useUIStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const updateData = useUpdateOpportunity(projectId);

  if (viewMode !== 'split' || !selectedOpportunityId) return null;

  const opportunity = opportunities.find(o => o.id === selectedOpportunityId);
  if (!opportunity) return null;

  const mockRow = { original: opportunity };

  return (
    <div 
      className={`bg-white dark:bg-slate-900 shadow-[rgba(0,0,0,0.1)_-4px_0px_10px_0px] border-l border-slate-200 dark:border-slate-800 transition-all duration-300 z-10 flex flex-col ${
        isMaximized ? 'absolute inset-0 w-full z-50' : 'w-1/2 h-full'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate pr-4">
          {opportunity.title || 'Untitled Opportunity'}
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.open(`/project/${projectId}/item/${selectedOpportunityId}`, '_blank')}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title="Pop-out in new window"
          >
            <ExternalLink size={18} />
          </button>
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button 
            onClick={() => setSelectedOpportunityId(null)}
            className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
            title="Close Panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-900/50">
        <div className="-m-4 border-none shadow-none bg-transparent">
          <ExpandedCard row={mockRow} updateData={updateData} />
        </div>
      </div>
    </div>
  );
}
