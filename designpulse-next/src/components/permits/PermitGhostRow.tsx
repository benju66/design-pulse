"use client";
import { useState, useRef } from 'react';
import { Table } from '@tanstack/react-table';
import { Permit } from '@/types/models';
import { useCreatePermit } from '@/hooks/usePermitQueries';

interface PermitGhostRowProps {
  table: Table<Permit>;
  createMutation: ReturnType<typeof useCreatePermit>;
}

export const PermitGhostRow = ({ table, createMutation }: PermitGhostRowProps) => {
  const [title, setTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  
  if (!permissions.can_edit_records) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && title.trim()) {
      e.preventDefault();
      createMutation.mutate({ 
        id: crypto.randomUUID(),
        title: title.trim(),
        status: 'Preparing',
        revision_number: 0,
        revision_history: [],
      });
      setTitle('');
    }
  };

  const activeCols = table.getVisibleFlatColumns();

  return (
    <tr className="border-t-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group">
      {activeCols.map((column) => {
        if (column.id === 'display_id') {
          return (
            <td key={column.id} className="p-2 align-middle">
              <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                New
              </span>
            </td>
          );
        }

        if (column.id === 'title') {
          return (
            <td key={column.id} className="p-2 align-middle">
              <div className="relative w-full">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={createMutation.isPending}
                  placeholder="Type new permit title and press Enter..."
                  className="w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 rounded px-2 py-1 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 disabled:opacity-50"
                />
                {createMutation.isPending && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin" />
                    Saving...
                  </div>
                )}
              </div>
            </td>
          );
        }

        return (
          <td key={column.id} className="p-2 align-middle">
            <div className="w-full h-full px-2 py-1 opacity-40 bg-slate-50 dark:bg-slate-800/50 rounded" />
          </td>
        );
      })}
    </tr>
  );
};
