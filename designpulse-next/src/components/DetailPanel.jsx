"use client";
import React, { useState } from 'react';
import { ExternalLink, Maximize, Minimize, X } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ExpandedCard } from './opportunities/ExpandedCard';
import { useUpdateOpportunity } from '@/hooks/useProjectQueries';

export default function DetailPanel({ projectId, opportunities, viewMode }) {
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelWidth, setPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const updateData = useUpdateOpportunity(projectId);

  if (viewMode !== 'split' || !selectedOpportunityId) return null;

  const opportunity = opportunities.find(o => o.id === selectedOpportunityId);
  if (!opportunity) return null;

  const mockRow = { original: opportunity };

  const startResize = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const handleMouseMove = (moveEvent) => {
      const newWidth = ((window.innerWidth - moveEvent.clientX) / window.innerWidth) * 100;
      setPanelWidth(Math.max(20, Math.min(newWidth, 80)));
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  return (
    <div 
      style={!isMaximized ? { width: `${panelWidth}%` } : {}}
      className={`relative bg-white dark:bg-slate-900 shadow-[rgba(0,0,0,0.1)_-4px_0px_10px_0px] border-l border-slate-200 dark:border-slate-800 z-10 flex flex-col shrink-0 max-w-full ${
        isMaximized ? 'absolute top-0 bottom-0 right-0 w-full z-50 transition-all duration-300' : (isDragging ? 'h-full transition-none' : 'h-full transition-all duration-300')
      }`}
    >
      {!isMaximized && (
        <div 
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-20 hover:bg-sky-500/20 active:bg-sky-500/40 transition-colors"
        />
      )}
      <div className="flex items-center p-4 border-b border-slate-200 dark:border-slate-800 relative w-full h-16 shrink-0">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate pr-28 min-w-0 flex-1">
          {opportunity.title || 'Untitled Opportunity'}
        </h3>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-slate-900 pl-2">
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
            onClick={() => {
              setIsMaximized(false);
              setSelectedOpportunityId(null);
            }}
            className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
            title="Close Panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-900/50 min-w-0 w-full">
        <div className="-m-4 border-none shadow-none bg-transparent">
          <ExpandedCard row={mockRow} updateData={updateData} />
        </div>
      </div>
    </div>
  );
}
