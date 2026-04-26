import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Table } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

interface CoordinationGhostRowProps {
  table: Table<Opportunity>;
  createMutation: any;
}

export const CoordinationGhostRow = ({ table, createMutation }: CoordinationGhostRowProps) => {
  const [title, setTitle] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && title.trim()) {
      e.preventDefault();
      createMutation.mutate({ 
        title: title.trim(),
        record_type: 'Coordination',
        cost_impact: 0,
        days_impact: 0,
        status: 'Draft',
        priority: 'Medium',
      });
      setTitle(''); // Reset instantly for quick entry
    }
  };

  const visibleLeafColumns = table.getVisibleLeafColumns();

  return (
    <tr className="bg-slate-50 dark:bg-slate-900/50 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
      <td className="px-2 border-r border-slate-200 dark:border-slate-800 text-center">
        <Plus size={16} className="text-slate-400 mx-auto" />
      </td>
      <td className="px-2 py-1 text-sm text-slate-400 dark:text-slate-500 font-mono border-r border-slate-200 dark:border-slate-800">
        New
      </td>
      <td className="p-0 border-r border-slate-200 dark:border-slate-800">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type new coordination item and press Enter..."
          className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:italic placeholder:text-slate-400"
        />
      </td>
      <td colSpan={visibleLeafColumns.length - 3} className="px-2 py-1.5 text-sm italic text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800">
        {createMutation.isPending ? 'Saving...' : 'Press Enter to save (automatically marked as Coordination type)'}
      </td>
    </tr>
  );
};
