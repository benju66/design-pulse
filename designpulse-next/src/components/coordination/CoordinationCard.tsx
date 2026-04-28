import React, { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Opportunity, DisciplineConfig } from '@/types/models';
import { useUpdateOpportunity, useProjectSettings, useProjectMembers } from '@/hooks/useProjectQueries';
import { CheckCircle2, Circle } from 'lucide-react';
import { DEFAULT_DISCIPLINES } from '@/lib/constants';

interface CoordinationCardProps {
  opportunity: Opportunity;
  projectId: string;
}

export const CoordinationCard = ({ opportunity, projectId }: CoordinationCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    data: { opportunity },
  });
  
  const updateMutation = useUpdateOpportunity(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { data: members = [] } = useProjectMembers(projectId);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : undefined,
  } : undefined;

  const isDueSoon = () => {
    if (!opportunity.due_date) return false;
    const due = new Date(opportunity.due_date);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return diff < 3 * 24 * 60 * 60 * 1000; // 3 days
  };

  const dueColor = isDueSoon() ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400';

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

  const togglePill = (e: React.MouseEvent, discipline: DisciplineConfig) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentStatus = localDetails[discipline.id]?.status || 'Not Required';
    // Cycle logic: Not Required -> Pending -> Complete -> Not Required
    let newStatus = 'Pending';
    if (currentStatus === 'Pending' || currentStatus === 'Required') newStatus = 'Complete';
    else if (currentStatus === 'Complete') newStatus = 'Not Required';
    
    // 1. Instant local visual update
    setLocalDetails(prev => ({
      ...prev,
      [discipline.id]: {
        ...(prev[discipline.id] || {}),
        status: newStatus
      }
    }));

    // 2. Accumulate in ref
    pendingDetailsRef.current = {
      ...pendingDetailsRef.current,
      [discipline.id]: {
        notes: localDetails[discipline.id]?.notes || '',
        status: newStatus
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

  const renderPill = (discipline: DisciplineConfig) => {
    const status = localDetails[discipline.id]?.status || 'Not Required';
    const isCompleted = status === 'Complete';
    const isPending = status === 'Pending' || status === 'Required';
    
    if (status === 'Not Required') return null; // Hide empty ones to save space on Kanban card

    let colorClass = 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700';
    if (isCompleted) {
       colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    } else if (isPending) {
       colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }

    return (
      <button 
        key={discipline.id}
        onClick={(e) => togglePill(e, discipline)}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${colorClass}`}
        title={discipline.label}
      >
        {isCompleted ? <CheckCircle2 size={10} /> : <Circle size={10} />}
        {discipline.label.substring(0, 4).toUpperCase()}
      </button>
    );
  };

  // Only show the "+" button if some disciplines are hidden, so we have a way to add them
  const hasHiddenDisciplines = disciplines.some((d: DisciplineConfig) => (localDetails[d.id]?.status || 'Not Required') === 'Not Required');

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className={`bg-white dark:bg-slate-800 border ${isDragging ? 'border-sky-500 shadow-xl opacity-80 cursor-grabbing' : 'border-slate-200 dark:border-slate-700 shadow-sm cursor-grab hover:border-slate-300 dark:hover:border-slate-600'} rounded-lg p-3 mb-3 flex flex-col transition-shadow`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
          {opportunity.display_id || '----'}
        </span>
        {opportunity.due_date && (
          <span className={`text-[10px] font-semibold ${dueColor}`}>
            {opportunity.due_date}
          </span>
        )}
      </div>

      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 leading-tight">
        {opportunity.title}
      </h4>

      {opportunity.final_direction && (
        <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400 mb-3 bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded border border-sky-100 dark:border-sky-800/50 line-clamp-2" title={opportunity.final_direction}>
          {opportunity.final_direction.startsWith('Locked: ') 
            ? opportunity.final_direction.substring(8) 
            : opportunity.final_direction}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex flex-wrap gap-1">
          {disciplines.map((d: DisciplineConfig) => renderPill(d))}
          {hasHiddenDisciplines && (
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700">
              + Add
            </div>
          )}
        </div>
        {opportunity.assignee && (() => {
          const emails = opportunity.assignee.split(',').map(e => e.trim()).filter(Boolean);
          const assignedMembers = emails.map(email => {
            const matched = members.find((m: any) => m.email === email || m.name === email);
            return {
              email: matched?.email || email,
              displayName: matched ? (matched.name || matched.email) : email
            };
          });

          if (assignedMembers.length === 0) return null;

          return (
            <div className="flex items-center -space-x-2 ml-2">
              {assignedMembers.slice(0, 3).map((m, i) => (
                <div key={i} className="group relative w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-[10px] font-bold text-sky-700 dark:text-sky-400 shrink-0 cursor-pointer shadow-sm border border-white dark:border-slate-800">
                  {m.displayName.substring(0, 2).toUpperCase()}
                  {!isDragging && (
                    <div className="absolute bottom-full mb-1 right-0 hidden group-hover:block z-[60] bg-slate-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-xl">
                      <div className="font-bold">{m.displayName}</div>
                      {m.email && m.email !== m.displayName && <div className="text-slate-400 text-[10px]">{m.email}</div>}
                    </div>
                  )}
                </div>
              ))}
              {assignedMembers.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-400 shrink-0 cursor-pointer shadow-sm border border-white dark:border-slate-800">
                  +{assignedMembers.length - 3}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
