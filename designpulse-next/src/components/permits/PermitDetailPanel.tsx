"use client";
import { useState, useRef } from 'react';
import { PermitRevision } from '@/types/models';
import { useLogPermitRevision, usePermits, usePermitTaskLinks, useLinkPermitTask, useUnlinkPermitTask } from '@/hooks/usePermitQueries';
import { useOpportunities } from '@/hooks/useProjectQueries';
import { X, Save, Clock, Link as LinkIcon, Unlink, Maximize, Minimize, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useUIStore } from '@/stores/useUIStore';

export default function PermitDetailPanel({ projectId, permitId }: { projectId: string, permitId: string }) {
  const { data: permits } = usePermits(projectId);
  const permit = permits?.find(p => p.id === permitId);
  
  const { data: tasks } = usePermitTaskLinks(projectId);
  const { data: opportunities } = useOpportunities(projectId);
  const logRevision = useLogPermitRevision(projectId);
  const linkTask = useLinkPermitTask(projectId);
  const unlinkTask = useUnlinkPermitTask(projectId);
  
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const [newRevisionNote, setNewRevisionNote] = useState('');
  const [newStatus, setNewStatus] = useState('Preparing');
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelWidth, setPanelWidth] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  const handleAddRevision = () => {
    if (!newRevisionNote.trim()) return;
    logRevision.mutate({
      permitId: permit.id,
      newRevision: {
        date: new Date().toISOString(),
        note: newRevisionNote,
        status: newStatus,
        author: 'Current User', // In real app, pull from Auth
      }
    }, {
      onSuccess: () => {
        setNewRevisionNote('');
        setNewStatus(permit.status || 'Preparing');
      }
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
          className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-20 hover:bg-sky-500/20 active:bg-sky-500/40 transition-colors"
        />
      )}
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

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-8">
        
        {/* Revision History */}
        <section>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Clock size={16} />
            Revision History
          </h3>
          
          <div className="space-y-3 mb-4">
            {(Array.isArray(permit.revision_history) ? (permit.revision_history as unknown as PermitRevision[]) : []).map((rev: PermitRevision, index: number) => (
              <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Status: {rev.status}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(rev.date), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                  {rev.note}
                </p>
              </div>
            ))}
            {(!permit.revision_history || (permit.revision_history as unknown as PermitRevision[]).length === 0) && (
              <p className="text-sm text-slate-500 italic">No revisions logged yet.</p>
            )}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Log New Revision</h4>
            <div className="space-y-2">
              <select 
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
              >
                <option value="Preparing">Preparing</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Comments Received">Comments Received</option>
                <option value="Approved">Approved</option>
              </select>
              <textarea 
                value={newRevisionNote}
                onChange={e => setNewRevisionNote(e.target.value)}
                placeholder="Revision notes..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 min-h-[80px] dark:text-white"
              />
              <button 
                onClick={handleAddRevision}
                disabled={!newRevisionNote.trim() || logRevision.isPending}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                <Save size={16} /> Save Revision
              </button>
            </div>
          </div>
        </section>

        {/* Linked Coordination Tasks */}
        <section>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <LinkIcon size={16} />
            Linked Tasks
          </h3>
          <div className="space-y-2">
            {currentLinks.map(link => {
              const task = opportunities?.find(o => o.id === link.coordination_task_id);
              if (!task) return null;
              return (
                <div key={link.coordination_task_id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
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
            
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Available Tasks</h4>
              <select 
                onChange={e => {
                  if (e.target.value) {
                    linkTask.mutate({ permitId: permit.id, taskId: e.target.value });
                    e.target.value = ""; // Reset select
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                defaultValue=""
              >
                <option value="" disabled>Select task to link...</option>
                {opportunities?.filter(o => o.record_type === 'CD' && !linkedTaskIds.includes(o.id)).map(o => (
                  <option key={o.id} value={o.id}>
                    {o.display_id} - {o.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
