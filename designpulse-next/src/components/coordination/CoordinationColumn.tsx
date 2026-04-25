import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface CoordinationColumnProps {
  id: string;
  title: string;
  children: React.ReactNode;
  count: number;
}

export const CoordinationColumn = ({ id, title, children, count }: CoordinationColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div className="flex flex-col flex-1 min-w-[280px] max-w-[350px] bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm tracking-wide">{title}</h3>
        <span className="bg-white dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
          {count}
        </span>
      </div>
      <div 
        ref={setNodeRef} 
        className={`flex-1 p-3 overflow-y-auto transition-colors ${
          isOver ? 'bg-sky-50 dark:bg-sky-900/10' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};
