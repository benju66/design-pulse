import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Maximize, Minimize, X, MapPin, Paperclip, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { Opportunity, DisciplineConfig, DisciplineDetails } from '@/types/models';
import { useUpdateOpportunity, useProjectSettings } from '@/hooks/useProjectQueries';
import { DEFAULT_DISCIPLINES } from '@/lib/constants';

interface CoordinationDetailPanelProps {
  projectId: string;
  opportunity: Opportunity;
}

export const CoordinationDetailPanel = ({ projectId, opportunity }: CoordinationDetailPanelProps) => {
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelWidth, setPanelWidth] = useState(40); // Initial 40%
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const updateMutation = useUpdateOpportunity(projectId);
  const { data: settings } = useProjectSettings(projectId);
  
  const rawDisciplines = settings?.disciplines;
  const disciplines: DisciplineConfig[] = Array.isArray(rawDisciplines) 
    ? rawDisciplines.map((d: any) => typeof d === 'string' ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d } : d)
    : DEFAULT_DISCIPLINES;
  const [localDetails, setLocalDetails] = useState<Record<string, any>>(opportunity.coordination_details as Record<string, any> || {});
  const pendingDetailsRef = useRef<Record<string, any>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalDetails(opportunity.coordination_details as Record<string, any> || {});
  }, [opportunity.coordination_details]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        if (Object.keys(pendingDetailsRef.current).length > 0) {
          updateMutation.mutate({
            id: opportunity.id,
            updates: {
              coordination_details: { 
                ...(opportunity.coordination_details as object || {}), 
                ...pendingDetailsRef.current 
              }
            }
          });
          pendingDetailsRef.current = {};
        }
        timeoutRef.current = null;
      }
    };
  }, [opportunity.id, opportunity.coordination_details, updateMutation]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = ((window.innerWidth - moveEvent.clientX) / window.innerWidth) * 100;
      const finalWidth = Math.max(20, Math.min(newWidth, 80));
      if (panelRef.current) panelRef.current.style.width = finalWidth + '%';
    };
    const handleMouseUp = (upEvent: MouseEvent) => {
      const newWidth = ((window.innerWidth - upEvent.clientX) / window.innerWidth) * 100;
      const finalWidth = Math.max(20, Math.min(newWidth, 80));
      setPanelWidth(finalWidth);
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateMutation.mutate({
      id: opportunity.id,
      updates: { status: e.target.value }
    });
  };

  const handleDisciplineUpdate = (disciplineId: string, updates: Partial<DisciplineDetails>) => {
    // 1. Instant local visual update
    setLocalDetails(prev => ({
      ...prev,
      [disciplineId]: {
        ...(prev[disciplineId] || {}),
        ...updates
      }
    }));

    // 2. Accumulate in ref
    pendingDetailsRef.current = {
      ...pendingDetailsRef.current,
      [disciplineId]: {
        ...(localDetails[disciplineId] || {}),
        ...updates
      }
    };
    
    // 3. Debounce network mutation
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateMutation.mutate({ 
        id: opportunity.id, 
        updates: { 
          coordination_details: { 
            ...(opportunity.coordination_details as object || {}), 
            ...pendingDetailsRef.current 
          } 
        } 
      });
      pendingDetailsRef.current = {}; // reset after flush
    }, 500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Complete': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'Pending': 
      case 'Required': return <AlertCircle size={16} className="text-amber-500" />;
      default: return <Circle size={16} className="text-slate-300 dark:text-slate-600" />;
    }
  };

  return (
    <div 
      ref={panelRef}
      style={!isMaximized ? { width: `${panelWidth}%` } : {}}
      className={`relative bg-slate-50 dark:bg-slate-900 shadow-[rgba(0,0,0,0.1)_-4px_0px_10px_0px] border-l border-slate-200 dark:border-slate-800 z-10 flex flex-col shrink-0 max-w-full ${
        isMaximized ? 'absolute top-0 bottom-0 right-0 w-full z-50 transition-all duration-300' : (isDragging ? 'h-full transition-none' : 'h-full transition-all duration-300')
      }`}
    >
      {!isMaximized && (
        <div 
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-20 hover:bg-sky-500/20 active:bg-sky-500/40 transition-colors"
        />
      )}
      
      {/* Header */}
      <div className="flex items-center p-4 border-b border-slate-200 dark:border-slate-800 relative w-full h-16 shrink-0 bg-white dark:bg-slate-950">
        <div className="flex items-center gap-3 pr-28 min-w-0 flex-1">
          <span className="text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded">
            {opportunity.display_id || '----'}
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {opportunity.title || 'Untitled Task'}
          </h3>
        </div>
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-slate-950 pl-2">
          <button 
            onClick={() => window.open(`/project/${projectId}/item/${opportunity.id}`, '_blank')}
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

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        
        {/* Top Metadata Row */}
        <div className="flex gap-4">
          <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
             <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Overall Status</label>
             <select
                value={opportunity.status || 'Draft'}
                onChange={handleStatusChange}
                className="w-full text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 outline-none"
             >
                <option value="Draft">Draft</option>
                <option value="In Drafting">In Drafting</option>
                <option value="Ready for Review">Ready for Review</option>
                <option value="Implemented">Implemented</option>
             </select>
          </div>
          
          <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
             <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Due Date</label>
             <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2">
                {opportunity.due_date || <span className="text-slate-400 italic">Not set</span>}
             </div>
          </div>
        </div>

        {/* Manual Escalation */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 shadow-sm">
             <div>
                <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">Escalate to VE Matrix</h4>
                <p className="text-xs font-semibold text-purple-700/80 dark:text-purple-400/80 mt-1">Send this item to Pre-Construction for financial review.</p>
             </div>
               <button 
                onClick={() => {
                  const isEscalated = localDetails?.is_escalated === true;
                  // Local update
                  setLocalDetails(prev => ({ ...prev, is_escalated: !isEscalated }));
                  pendingDetailsRef.current = { ...pendingDetailsRef.current, is_escalated: !isEscalated };
                  
                  if (timeoutRef.current) clearTimeout(timeoutRef.current);
                  timeoutRef.current = setTimeout(() => {
                    updateMutation.mutate({
                      id: opportunity.id,
                      updates: { 
                        coordination_details: { 
                          ...(opportunity.coordination_details as object || {}), 
                          ...pendingDetailsRef.current 
                        }
                      }
                    });
                    pendingDetailsRef.current = {};
                  }, 500);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                  localDetails?.is_escalated === true 
                    ? 'bg-purple-600 text-white shadow-purple-500/30 hover:bg-purple-700' 
                    : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 dark:bg-slate-800 dark:border-purple-800 dark:hover:bg-slate-700'
                }`}
             >
                {localDetails?.is_escalated === true ? 'Escalated' : 'Escalate'}
             </button>
          </div>
        </div>

        {/* Disciplines Workspace */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider pl-1">Disciplines</h4>
          
          {disciplines.map((discipline) => {
            const current = localDetails[discipline.id] || { status: 'Not Required', notes: '' };
            
            return (
              <details 
                key={discipline.id} 
                className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden"
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(current.status)}
                    <span className="font-bold text-slate-800 dark:text-slate-100">{discipline.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{current.status}</span>
                    <ChevronDown size={18} className="text-slate-400 group-open:rotate-180 transition-transform" />
                  </div>
                </summary>
                
                <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700/50 mt-2 flex flex-col gap-4">
                  <div className="pt-4 flex items-center justify-between">
                     <label className="text-xs font-bold text-slate-500">Status</label>
                     <select
                        value={current.status}
                        onChange={(e) => handleDisciplineUpdate(discipline.id, { status: e.target.value as DisciplineDetails['status'] })}
                        className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-none rounded py-1 px-3 focus:ring-2 focus:ring-sky-500 outline-none"
                      >
                        <option value="Not Required">Not Required</option>
                        <option value="Pending">Pending</option>
                        <option value="Complete">Complete</option>
                      </select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-2">Coordination Notes</label>
                    <textarea
                      value={current.notes}
                      onChange={(e) => handleDisciplineUpdate(discipline.id, { notes: e.target.value })}
                      placeholder="Add notes, sheet references, or action items..."
                      className="w-full text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 h-24 resize-y focus:ring-2 focus:ring-sky-500 outline-none text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700/50 pt-3">
                     <button className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 py-2 rounded-md transition-colors">
                        <MapPin size={14} /> View Map Pins
                     </button>
                     <button className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 py-2 rounded-md transition-colors">
                        <Paperclip size={14} /> Attachments
                     </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Helper for the details Chevron
const ChevronDown = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);
