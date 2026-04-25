import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Opportunity } from '@/types/models';
import { useUpdateOpportunity } from '@/hooks/useProjectQueries';
import { CheckCircle2, Circle } from 'lucide-react';

interface CoordinationCardProps {
  opportunity: Opportunity;
  projectId: string;
}

export const CoordinationCard = ({ opportunity, projectId }: CoordinationCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    data: {
      opportunity,
    },
  });
  
  const updateMutation = useUpdateOpportunity(projectId);

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

  const togglePill = (e: React.MouseEvent, field: 'arch_completed' | 'mep_completed' | 'struct_completed') => {
    e.stopPropagation();
    e.preventDefault();
    updateMutation.mutate({ 
      id: opportunity.id, 
      updates: { [field]: !opportunity[field] } 
    });
  };

  const renderPill = (label: string, field: 'arch_completed' | 'mep_completed' | 'struct_completed') => {
    const isCompleted = opportunity[field];
    return (
      <button 
        onClick={(e) => togglePill(e, field)}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
          isCompleted 
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
        }`}
      >
        {isCompleted ? <CheckCircle2 size={12} /> : <Circle size={12} />}
        {label}
      </button>
    );
  };

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
          {opportunity.display_id || 'VE----'}
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
        <div className="flex gap-1">
          {renderPill('ARCH', 'arch_completed')}
          {renderPill('MEP', 'mep_completed')}
          {renderPill('STR', 'struct_completed')}
        </div>
        {opportunity.assignee && (
          <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-[10px] font-bold text-sky-700 dark:text-sky-400 shrink-0" title={opportunity.assignee}>
            {opportunity.assignee.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};
