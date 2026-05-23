"use client";
import React from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { DeliverableTable } from './DeliverableTable';
import DeliverableKanban from './DeliverableKanban';
import DeliverableDetailPanel from './DeliverableDetailPanel';
import { ProjectDeliverable } from '@/types/models';

interface DeliverableBoardProps {
  projectId: string;
  deliverables: ProjectDeliverable[];
  isLoading: boolean;
  filterSlot?: React.ReactNode;
  createMutation: any;
}

export default function DeliverableBoard({ 
  projectId,
  deliverables,
  isLoading,
  filterSlot,
  createMutation
}: DeliverableBoardProps) {
  const viewMode = useUIStore(state => state.deliverablesViewMode);
  const selectedDeliverableId = useUIStore(state => state.selectedOpportunityId);
  
  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 h-full w-full overflow-hidden">
        
        {/* Main Area */}
        <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 h-full overflow-hidden @container ${
          selectedDeliverableId ? 'border-r border-slate-200 dark:border-slate-800' : ''
        }`}>
          
          <div className="flex-1 h-full overflow-hidden flex flex-col relative">
            {isLoading ? (
              <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                  <span className="text-xs text-slate-400 font-medium">Loading Deliverables...</span>
                </div>
              </div>
            ) : viewMode.startsWith('table') ? (
              <DeliverableTable 
                projectId={projectId} 
                deliverables={deliverables} 
                filterSlot={filterSlot}
                createMutation={createMutation}
              />
            ) : (
              <DeliverableKanban 
                projectId={projectId} 
                deliverables={deliverables} 
              />
            )}
          </div>
        </div>

        {/* Slide-out Detail Panel (Shown in either mode when a deliverable is active for a great UX) */}
        {selectedDeliverableId && (
          <DeliverableDetailPanel 
            projectId={projectId} 
            deliverableId={selectedDeliverableId} 
          />
        )}
      </div>
    </div>
  );
}
