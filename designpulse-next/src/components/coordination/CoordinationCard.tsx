import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Opportunity, DisciplineConfig } from '@/types/models';
import { useUpdateOpportunity, useProjectSettings } from '@/hooks/useProjectQueries';
import { CheckCircle2, Circle } from 'lucide-react';

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

  const defaultDisciplines: DisciplineConfig[] = [
    { id: 'd_arch', label: 'Arch' },
    { id: 'd_civil', label: 'Civil' },
    { id: 'd_struct', label: 'Struct' },
    { id: 'd_mech', label: 'Mech' },
    { id: 'd_elec', label: 'Elec' },
    { id: 'd_plumb', label: 'Plumb' }
  ];
  const rawDisciplines = (settings as any)?.disciplines;
  const disciplines: DisciplineConfig[] = Array.isArray(rawDisciplines) 
    ? rawDisciplines.map((d: any) => typeof d === 'string' ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d } : d)
    : defaultDisciplines;
  const coordDetails = opportunity.coordination_details || {};

  const togglePill = (e: React.MouseEvent, discipline: DisciplineConfig) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentStatus = coordDetails[discipline.id]?.status || 'Not Required';
    // Cycle logic: Not Required -> Pending -> Complete -> Not Required
    let newStatus = 'Pending';
    if (currentStatus === 'Pending' || currentStatus === 'Required') newStatus = 'Complete';
    else if (currentStatus === 'Complete') newStatus = 'Not Required';
    
    const updatedDetails = {
      ...(coordDetails as Record<string, any>),
      [discipline.id]: {
        notes: (coordDetails as any)[discipline.id]?.notes || '',
        status: newStatus
      }
    };
    
    updateMutation.mutate({ 
      id: opportunity.id, 
      updates: { coordination_details: updatedDetails } 
    });
  };

  const renderPill = (discipline: DisciplineConfig) => {
    const status = coordDetails[discipline.id]?.status || 'Not Required';
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
  const hasHiddenDisciplines = disciplines.some((d: DisciplineConfig) => (coordDetails[d.id]?.status || 'Not Required') === 'Not Required');

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

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex flex-wrap gap-1">
          {disciplines.map((d: DisciplineConfig) => renderPill(d))}
          {hasHiddenDisciplines && (
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700">
              + Add
            </div>
          )}
        </div>
        {opportunity.assignee && (
          <div className="ml-2 w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-[10px] font-bold text-sky-700 dark:text-sky-400 shrink-0" title={opportunity.assignee}>
            {opportunity.assignee.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};
