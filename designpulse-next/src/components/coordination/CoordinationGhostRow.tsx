import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Table } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

interface CoordinationGhostRowProps {
  table: Table<Opportunity>;
  createMutation: any;
}

export const CoordinationGhostRow = ({ table, createMutation }: CoordinationGhostRowProps) => {
  const [title, setTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!createMutation.isPending && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [createMutation.isPending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && title.trim()) {
      e.preventDefault();
      const optimisticId = crypto.randomUUID();
      createMutation.mutate({ 
        id: optimisticId,
        title: title.trim(),
        record_type: 'Coordination',
        cost_impact: 0,
        days_impact: 0,
        status: 'Draft',
        coordination_status: 'Draft',
        priority: 'Medium',
      });
      setTitle(''); // Reset instantly for quick entry
    }
  };

  const visibleLeafColumns = table.getVisibleLeafColumns();

  return (
    <tr className="bg-slate-50 dark:bg-slate-900/50 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
      {visibleLeafColumns.map((col) => {
        if (col.id === 'select' || col.id === 'open_panel') {
          return (
            <td key={col.id} className="px-2 border-r border-slate-200 dark:border-slate-800 text-center">
              {col.id === 'select' && <Plus size={16} className="text-slate-400 dark:text-slate-500 mx-auto" />}
            </td>
          );
        }

        if (col.id === 'display_id' || col.id === 'record_type') {
          return (
            <td key={col.id} className="px-2 py-1 text-sm text-slate-400 dark:text-slate-500 font-mono border-r border-slate-200 dark:border-slate-800">
              {col.id === 'display_id' ? 'New' : 'Coordination'}
            </td>
          );
        }

        if (col.id === 'title') {
          return (
            <td key={col.id} className="p-0 border-r border-slate-200 dark:border-slate-800 relative">
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={createMutation.isPending}
                placeholder={createMutation.isPending ? 'Saving...' : 'Type new coordination task and press Enter...'}
                className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:italic placeholder:text-slate-400 disabled:opacity-50"
              />
            </td>
          );
        }

        // Disable other cells
        return (
          <td key={col.id} className="p-0 border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/20">
            <div className="w-full h-full px-2 py-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed">
              --
            </div>
          </td>
        );
      })}
    </tr>
  );
};
