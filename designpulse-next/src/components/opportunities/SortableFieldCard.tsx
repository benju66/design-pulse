"use client";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableFieldCardProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

export const SortableFieldCard = ({ id, title, children }: SortableFieldCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-opacity"
      >
        <GripVertical size={16} />
      </div>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 pr-6">{title}</label>
      {children}
    </div>
  );
};
