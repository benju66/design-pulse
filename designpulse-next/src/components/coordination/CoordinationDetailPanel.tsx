import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Maximize, Minimize, X, MapPin, Paperclip, CheckCircle2, Circle, AlertCircle, List, MessageSquare, ChevronDown } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { Opportunity, DisciplineConfig, DisciplineDetails } from '@/types/models';
import { useUpdateOpportunity, useUpdateCoordinationDetails } from '@/hooks/useOpportunityQueries';
import { useProjectSettings, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { ContendersMatrix } from '../opportunities/ContendersMatrix';
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
  const [activeTab, setActiveTab] = useState('Details');
  const panelRef = useRef<HTMLDivElement>(null);

  const updateMutation = useUpdateOpportunity(projectId);
  const updateCoordDetails = useUpdateCoordinationDetails(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);
  
  const rawDisciplines = settings?.disciplines;
  const disciplines: DisciplineConfig[] = Array.isArray(rawDisciplines) 
    ? rawDisciplines.map((d: any) => typeof d === 'string' ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d } : d)
    : DEFAULT_DISCIPLINES;
  const [localDetails, setLocalDetails] = useState<Record<string, any>>(opportunity.coordination_details as Record<string, any> || {});
  const pendingDetailsRef = useRef<Record<string, any>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    {/* eslint-disable-next-line react-hooks/set-state-in-effect */}
    setLocalDetails(opportunity.coordination_details as Record<string, any> || {});
  }, [opportunity.coordination_details]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        if (Object.keys(pendingDetailsRef.current).length > 0) {
          updateCoordDetails.mutate({
            id: opportunity.id,
            updates: pendingDetailsRef.current
          });
          pendingDetailsRef.current = {};
        }
        timeoutRef.current = null;
      }
    };
  }, [opportunity.id, updateCoordDetails]);

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


  const handleDisciplineUpdate = (disciplineId: string, updates: Partial<DisciplineDetails>) => {
    // 1. Instant local visual update
    setLocalDetails(prev => ({
      ...prev,
      [disciplineId]: {
        ...(prev[disciplineId] || {}),
        ...updates
      }
    }));

    // 2. Accumulate delta in ref
    pendingDetailsRef.current = {
      ...pendingDetailsRef.current,
      [disciplineId]: {
        ...(pendingDetailsRef.current[disciplineId] || {}),
        ...updates
      }
    };
    
    // 3. Debounce network mutation
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateCoordDetails.mutate({ 
        id: opportunity.id, 
        updates: pendingDetailsRef.current
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

      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 px-4 shrink-0">
        <div className="flex space-x-1 py-2">
          {['Details', 'Attachments', 'Activity'].map(tab => {
            const Icon = tab === 'Details' ? List : tab === 'Attachments' ? Paperclip : MessageSquare;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab 
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon size={16} />
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900/50">
        {activeTab === 'Details' && (
          <div className="flex flex-col gap-6">
            
            {/* Top Metadata Row */}
        <div className="flex gap-4">
          <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
             <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Overall Status</label>
             <select
                value={opportunity.coordination_status || 'Draft'}
                onChange={(e) => {
                  updateMutation.mutate({
                    id: opportunity.id,
                    updates: { coordination_status: e.target.value }
                  });
                }}
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

        {/* Pinned Description / Notes Accordion */}
        <details 
          className="group border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm mb-2"
          open={!!opportunity.description?.trim()} 
        >
          <summary className="flex items-center justify-between p-3 cursor-pointer select-none outline-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-colors rounded-xl group-open:rounded-b-none group-open:border-b group-open:border-slate-200 dark:group-open:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                Description / Notes
              </span>
              {/* Subtle Visual Indicator if content exists */}
              {!!opportunity.description?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400"></span>
              )}
            </div>
            
            <div className="flex items-center gap-3 pr-2">
              {/* Text preview when collapsed and empty */}
              {!opportunity.description?.trim() && (
                <span className="text-xs text-slate-400 dark:text-slate-500 group-open:hidden">
                  + Add description...
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          
          <div className="p-2 bg-white dark:bg-slate-800 rounded-b-xl">
            <textarea
              className="w-full text-sm bg-transparent border-none p-2 h-24 resize-y focus:ring-2 focus:ring-sky-500 rounded-lg outline-none text-slate-800 dark:text-slate-200 disabled:opacity-70 disabled:cursor-not-allowed"
              placeholder="Add description, scope notes, or context..."
              key={opportunity.id + '-desc'}
              defaultValue={opportunity.description || ''}
              disabled={!permissions?.can_edit_records}
              onBlur={(e) => {
                if (e.target.value !== (opportunity.description || '')) {
                  updateMutation.mutate({
                    id: opportunity.id,
                    updates: { description: e.target.value }
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  const val = e.currentTarget.value;
                  if (val !== (opportunity.description || '')) {
                    updateMutation.mutate({
                      id: opportunity.id,
                      updates: { description: val }
                    });
                  }
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
        </details>

        {/* Interactive Contenders Matrix — replaces static VE Selection Details */}
        <ContendersMatrix
          opportunityId={opportunity.id}
          isLocked={opportunity.status === 'Approved'}
          recordType="Coordination"
          projectId={projectId}
          permissions={permissions}
        />

        {/* Manual Escalation */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 shadow-sm">
             <div>
                <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">Escalate to Value Matrix</h4>
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
                    updateCoordDetails.mutate({
                      id: opportunity.id,
                      updates: pendingDetailsRef.current
                    });
                    pendingDetailsRef.current = {};
                  }, 500);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                  localDetails?.is_escalated === true 
                    ? 'bg-purple-600 text-white shadow-purple-500/30 hover:bg-purple-700' 
                    : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 dark:bg-slate-800 dark:border-purple-800 dark:hover:bg-slate-700'
                }`}
                title={localDetails?.is_escalated === true
                  ? 'Remove from Value Matrix and return this item to the Coordination Board only'
                  : 'Send to Value Matrix for financial evaluation by Pre-Construction'}
              >
                 {localDetails?.is_escalated === true ? 'Recall from Value Matrix' : 'Escalate to Value Matrix'}
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
        )}

        {activeTab === 'Attachments' && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-slate-800/50 h-full">
            <Paperclip size={32} className="mb-3 text-slate-400" />
            <p className="font-medium text-slate-600 dark:text-slate-300">Drag and drop files here, or click to browse</p>
            <p className="text-sm mt-1 text-slate-400">Supports PDF, JPG, PNG, DOCX</p>
          </div>
        )}

        {activeTab === 'Activity' && (
          <div className="flex flex-col space-y-4 h-full">
            <div className="space-y-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 pb-4 mt-2">
              <div className="relative pl-6">
                <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-slate-50 dark:ring-slate-900/50" />
                <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-white">System</span> created this option.</p>
                <span className="text-xs text-slate-400">Just now</span>
              </div>
              <div className="relative pl-6">
                <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-sky-400 ring-4 ring-slate-50 dark:ring-slate-900/50" />
                <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-white">You</span> updated <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1 rounded">status</span> from Draft to Pending Review.</p>
                <span className="text-xs text-slate-400">2 mins ago</span>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <input type="text" placeholder="Write a comment..." className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
              <button className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors">Send</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

