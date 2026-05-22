"use client";
import { useState, useRef, useEffect } from 'react';
import { useDeliverables, useUpdateDeliverable } from '@/hooks/useDeliverableQueries';
import { X, Maximize, Minimize, ExternalLink, List, MessageSquare, ChevronDown, Calendar, User, Tag } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ActivityFeed } from '@/components/opportunities/ActivityFeed';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { hasDescriptionContent } from '@/lib/htmlUtils';
import { useCurrentUserPermissions, useProjectMembers } from '@/hooks/useProjectCoreQueries';
import { usePermits } from '@/hooks/usePermitQueries';
import { toDateInputValue } from '@/lib/formatters';
import { AssigneeSelect } from '@/components/opportunities/AssigneeSelect';

export default function DeliverableDetailPanel({ projectId, deliverableId }: { projectId: string, deliverableId: string }) {
  const { data: deliverables } = useDeliverables(projectId);
  const deliverable = deliverables?.find(d => d.id === deliverableId);
  
  const updateDeliverable = useUpdateDeliverable(projectId);
  const { data: permits = [] } = usePermits(projectId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);
  
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  
  // Tabs state: Details or Comments (Activity)
  const [activeTab, setActiveTab] = useState('Details');
  
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelWidth, setPanelWidth] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Controlled accordion for description
  const [descOpen, setDescOpen] = useState(
    () => hasDescriptionContent(deliverable?.description)
  );

  useEffect(() => { 
    setDescOpen(hasDescriptionContent(deliverable?.description)); 
  }, [deliverable?.id]);

  if (!deliverable) return null;

  const emails = deliverable.assignee ? deliverable.assignee.split(',').map(e => e.trim()).filter(Boolean) : [];
  const assignedMembers = emails.map(email => {
    const matched = projectMembers.find(m => m.email === email || m.name === email);
    return {
      email: matched?.email || email,
      displayName: matched ? (matched.name || matched.email) : email
    };
  });

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = ((window.innerWidth - moveEvent.clientX) / window.innerWidth) * 100;
      const finalWidth = Math.max(25, Math.min(newWidth, 80));
      if (panelRef.current) panelRef.current.style.width = finalWidth + '%';
    };
    const handleMouseUp = (upEvent: MouseEvent) => {
      const newWidth = ((window.innerWidth - upEvent.clientX) / window.innerWidth) * 100;
      const finalWidth = Math.max(25, Math.min(newWidth, 80));
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

  const handleUpdate = (field: keyof typeof deliverable, value: any) => {
    if (!permissions.can_edit_records) return;
    updateDeliverable.mutate({
      id: deliverable.id,
      updates: { [field]: value }
    });
  };

  return (
    <div 
      ref={panelRef}
      style={!isMaximized ? { width: `${panelWidth}%` } : {}}
      className={`relative bg-white dark:bg-slate-900 shadow-[rgba(0,0,0,0.1)_-4px_0px_10px_0px] border-l border-slate-200 dark:border-slate-800 z-10 flex flex-col shrink-0 max-w-full ${
        isMaximized ? 'absolute top-0 bottom-0 right-0 w-full z-50 transition-all duration-300' : (isDragging ? 'h-full transition-none' : 'h-full transition-all duration-300')
      }`}
    >
      {!isMaximized && (
        <div 
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-25 hover:bg-sky-500/20 active:bg-sky-500/40 transition-colors animate-pulse"
        />
      )}
      
      {/* Header */}
      <div className="flex items-center p-4 border-b border-slate-200 dark:border-slate-800 relative w-full h-16 shrink-0 bg-slate-50 dark:bg-slate-950/50">
        <div className="overflow-hidden pr-24">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 truncate" title={deliverable.title}>
            {deliverable.title}
          </h2>
          <div className="flex items-center gap-2 mt-1 shrink-0">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-1.5 py-0.5 rounded">
              {deliverable.display_id || 'DE-???'}
            </span>
            {deliverable.is_elevated_key_date && (
              <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Tag size={10} /> Key Date
              </span>
            )}
          </div>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-slate-50 dark:bg-slate-950/50 pl-2">
          <button 
            onClick={() => window.open(`/project/${projectId}/deliverable/${deliverable.id}`, '_blank')}
            className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
            title="Pop-out in new window"
          >
            <ExternalLink size={18} />
          </button>
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
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
      <div className="flex flex-wrap items-center gap-y-1 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 px-4">
        <div className="flex items-center space-x-1 py-2">
          {['Details', 'Comments'].map(tab => {
            const Icon = tab === 'Details' ? List : MessageSquare;
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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
        
        {activeTab === 'Details' && (
          <div className="space-y-6">
            {/* Pinned Description Accordion */}
            <details 
              className="group border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm"
              open={descOpen}
              onToggle={(e) => setDescOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="flex items-center justify-between p-3 cursor-pointer select-none outline-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-colors rounded-xl group-open:rounded-b-none group-open:border-b group-open:border-slate-200 dark:group-open:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                    Description / Scope Notes
                  </span>
                  {hasDescriptionContent(deliverable.description) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400"></span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 pr-2">
                  {!hasDescriptionContent(deliverable.description) && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 group-open:hidden">
                      + Add description...
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </div>
              </summary>
              
              <div className="p-2 bg-white dark:bg-slate-800 rounded-b-xl">
                <RichTextEditor
                  key={deliverable.id + '-desc'}
                  content={deliverable.description || ''}
                  disabled={!permissions.can_edit_records}
                  placeholder="Add scope details, guidelines, or specs for this deliverable..."
                  onSave={(html) => {
                    if (html !== (deliverable.description || '')) {
                      handleUpdate('description', html);
                    }
                  }}
                />
              </div>
            </details>

            {/* Editable Fields Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Deliverable Settings
              </h3>
              
              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Title</label>
                <input 
                  type="text"
                  value={deliverable.title}
                  disabled={!permissions.can_edit_records}
                  onChange={(e) => handleUpdate('title', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                />
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status</label>
                <select
                  value={deliverable.status}
                  disabled={!permissions.can_edit_records}
                  onChange={(e) => handleUpdate('status', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white cursor-pointer"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Closed">Closed</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>

              {/* Due Date Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Calendar size={12} /> Due Date
                </label>
                <input 
                  type="date"
                  value={toDateInputValue(deliverable.due_date) || ''}
                  disabled={!permissions.can_edit_records}
                  onChange={(e) => handleUpdate('due_date', e.target.value || null)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                />
              </div>

              {/* Assignee Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <User size={12} /> Assignee
                </label>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 min-h-[38px] flex items-center w-full">
                  {permissions.can_edit_records ? (
                    <AssigneeSelect
                      value={deliverable.assignee || ''}
                      members={projectMembers}
                      autoFocus={false}
                      onChange={(newValue) => handleUpdate('assignee', newValue || null)}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {assignedMembers.map((m, i) => (
                        <div key={i} title={m.displayName} className="px-2 py-0.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-900/60 rounded">
                          {m.displayName}
                        </div>
                      ))}
                      {assignedMembers.length === 0 && <span className="text-slate-400 dark:text-slate-500 italic text-xs">Unassigned</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Parent Permit Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Parent Permit Link</label>
                <select
                  value={deliverable.permit_id || ''}
                  disabled={!permissions.can_edit_records}
                  onChange={(e) => handleUpdate('permit_id', e.target.value || null)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white cursor-pointer"
                >
                  <option value="">None</option>
                  {permits.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.display_id ? `${p.display_id} - ${p.title}` : p.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Elevated Key Date Toggle */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Elevate to Key Date</span>
                  <span className="text-xs text-slate-400">Makes this deliverable appear on executive key timelines.</span>
                </div>
                <button
                  onClick={() => handleUpdate('is_elevated_key_date', !deliverable.is_elevated_key_date)}
                  disabled={!permissions.can_edit_records}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${deliverable.is_elevated_key_date ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'} ${!permissions.can_edit_records ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${deliverable.is_elevated_key_date ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Comments' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 min-h-[400px]">
            <ActivityFeed deliverableId={deliverable.id} projectId={projectId} />
          </div>
        )}

      </div>
    </div>
  );
}
