"use client";
import { useState, useRef, useEffect } from 'react';
import { useLogPermitActivity, usePermits, usePermitTaskLinks, useLinkPermitTask, useUnlinkPermitTask, usePermitComments, useUpdatePermit } from '@/hooks/usePermitQueries';
import { PermitCommentGrid } from './PermitCommentGrid';
import { useOpportunities } from '@/hooks/useOpportunityQueries';
import { X, Save, Link as LinkIcon, Unlink, Maximize, Minimize, ExternalLink, List, Paperclip, MessageSquare, Send, ChevronDown } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ActivityFeed } from '@/components/opportunities/ActivityFeed';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { hasDescriptionContent } from '@/lib/htmlUtils';
import { useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';

export default function PermitDetailPanel({ projectId, permitId }: { projectId: string, permitId: string }) {
  const { data: permits } = usePermits(projectId);
  const permit = permits?.find(p => p.id === permitId);
  
  const { data: commentsData } = usePermitComments(projectId);
  const comments = commentsData?.filter(c => c.permit_id === permitId) || [];

  const { data: tasks } = usePermitTaskLinks(projectId);
  const { data: opportunities } = useOpportunities(projectId);
  const logActivity = useLogPermitActivity(projectId);
  const linkTask = useLinkPermitTask(projectId);
  const unlinkTask = useUnlinkPermitTask(projectId);
  const updatePermit = useUpdatePermit(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);
  
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedOpportunityId(null);
      document.getElementById('permit-table-container')?.focus({ preventScroll: true });
    }
  };
  
  // Tabs state
  const [activeTab, setActiveTab] = useState('Details');
  
  // Submission state
  const [newRevisionNote, setNewRevisionNote] = useState('');
  
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelWidth, setPanelWidth] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Controlled accordion
  const [descOpen, setDescOpen] = useState(
    () => hasDescriptionContent(permit?.description)
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { setDescOpen(hasDescriptionContent(permit?.description)); }, [permit?.id]);

  if (!permit) return null;

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

  const currentLinks = tasks?.filter(t => t.permit_id === permit.id) || [];
  const linkedTaskIds = currentLinks.map(l => l.coordination_task_id);

  const handleRecordSubmission = () => {
    if (!newRevisionNote.trim()) return;
    logActivity.mutate({
      permitId: permit.id,
      eventType: 'submission',
      note: newRevisionNote
    }, {
      onSuccess: () => {
        setNewRevisionNote('');
      }
    });
  };

  return (
    <div 
      ref={panelRef}
      id="permit-detail-panel-container"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={!isMaximized ? { width: `${panelWidth}%` } : {}}
      className={`relative bg-white dark:bg-slate-900 shadow-[rgba(0,0,0,0.1)_-4px_0px_10px_0px] border-l border-slate-200 dark:border-slate-800 z-10 flex flex-col shrink-0 max-w-full focus:outline-none ${
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
      <div className="flex items-center p-4 border-b border-slate-200 dark:border-slate-800 relative w-full h-16 shrink-0 bg-slate-50 dark:bg-slate-950/50">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 truncate pr-4">
            {permit.title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold text-slate-500 bg-slate-200 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded">
              {permit.display_id || 'PER-???'}
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
              Revision {permit.revision_number || 0}
            </span>
          </div>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-slate-50 dark:bg-slate-950/50 pl-2">
          <button 
            onClick={() => window.open(`/project/${projectId}/permit/${permit.id}`, '_blank')}
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

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
        
        {activeTab === 'Details' && (
          <div className="space-y-8">
            {/* Pinned Description / Notes Accordion */}
            <details 
              className="group border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm"
              open={descOpen}
              onToggle={(e) => setDescOpen(e.newState === 'open')}
            >
              <summary className="flex items-center justify-between p-3 cursor-pointer select-none outline-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-colors rounded-xl group-open:rounded-b-none group-open:border-b group-open:border-slate-200 dark:group-open:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                    Description / Notes
                  </span>
                  {/* Subtle Visual Indicator if content exists */}
                  {hasDescriptionContent(permit?.description) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400"></span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 pr-2">
                  {/* Text preview when collapsed and empty */}
                  {!hasDescriptionContent(permit?.description) && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 group-open:hidden">
                      + Add description...
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </div>
              </summary>
              
              <div className="p-2 bg-white dark:bg-slate-800 rounded-b-xl">
                <RichTextEditor
                  key={permit.id + '-desc'}
                  content={permit.description || ''}
                  disabled={!permissions?.can_edit_records}
                  placeholder="Add description, scope notes, or context..."
                  onSave={(html) => {
                    if (html !== (permit.description || '')) {
                      updatePermit.mutate({
                        id: permit.id,
                        updates: { description: html }
                      });
                    }
                  }}
                />
              </div>
            </details>

            {/* Record Submission Section */}
            <section className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Send size={16} className="text-sky-500" />
                Record Submission
              </h3>
              <div className="space-y-3">
                <textarea 
                  value={newRevisionNote}
                  onChange={e => setNewRevisionNote(e.target.value)}
                  placeholder="Submission notes, link to plans, etc..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 min-h-[80px] dark:text-white"
                />
                <button 
                  onClick={handleRecordSubmission}
                  disabled={!newRevisionNote.trim() || logActivity.isPending}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  <Save size={16} /> Submit & Increment Revision
                </button>
              </div>
            </section>

            {/* Plan Review Comments */}
            <section>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <MessageSquare size={16} className="text-slate-400" />
                Plan Review Comments
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                <PermitCommentGrid projectId={projectId} permitId={permitId} comments={comments} />
              </div>
            </section>

            {/* Linked Coordination Tasks */}
            <section>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <LinkIcon size={16} className="text-slate-400" />
                Linked Tasks
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-2">
                {currentLinks.map(link => {
                  const task = opportunities?.find(o => o.id === link.coordination_task_id);
                  if (!task) return null;
                  return (
                    <div key={link.coordination_task_id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded shrink-0">
                          {task.display_id}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                          {task.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => unlinkTask.mutate({ permitId: permit.id, taskId: task.id })}
                        disabled={unlinkTask.isPending}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                        title="Unlink Task"
                      >
                        <Unlink size={14} />
                      </button>
                    </div>
                  );
                })}
                
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Available Tasks</h4>
                  <select 
                    onChange={e => {
                      if (e.target.value) {
                        linkTask.mutate({ permitId: permit.id, taskId: e.target.value });
                        e.target.value = ""; // Reset select
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                    defaultValue=""
                  >
                    <option value="" disabled>Select task to link...</option>
                    {opportunities?.filter(o => o.record_type === 'Coordination' && !linkedTaskIds.includes(o.id)).map(o => (
                      <option key={o.id} value={o.id}>
                        {o.display_id} - {o.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Elevated Key Date Toggle */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-4 mt-4">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Elevate to Key Date</span>
                <span className="text-xs text-slate-400">Surfaces this permit's target approval date on the executive timeline.</span>
              </div>
              <button
                onClick={() => updatePermit.mutate({ id: permit.id, updates: { is_elevated_key_date: !permit.is_elevated_key_date } })}
                disabled={!permissions?.can_edit_records}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                  permit.is_elevated_key_date ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                } ${!permissions?.can_edit_records ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  permit.is_elevated_key_date ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Attachments' && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-slate-800/50">
            <Paperclip size={32} className="mb-3 text-slate-400" />
            <p className="font-medium text-slate-600 dark:text-slate-300">Drag and drop files here, or click to browse</p>
            <p className="text-sm mt-1 text-slate-400">Supports PDF, JPG, PNG, DOCX</p>
          </div>
        )}

        {activeTab === 'Activity' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 min-h-[400px]">
            <ActivityFeed permitId={permit.id} projectId={projectId} />
          </div>
        )}

      </div>
    </div>
  );
}
