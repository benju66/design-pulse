"use client";
import { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Table, Column } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';
import { UseMutationResult } from '@tanstack/react-query';

interface GhostRowProps {
  table: Table<Opportunity>;
  createMutation: UseMutationResult<Opportunity, Error, Partial<Opportunity>, unknown>;
}

export default function GhostRow({ table, createMutation }: GhostRowProps) {
  const [pendingRow, setPendingRow] = useState<Partial<Opportunity>>({});
  const [ghostError, setGhostError] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const submitGhostRow = () => {
    if (!pendingRow.title?.trim()) {
      setGhostError(true);
      setTimeout(() => setGhostError(false), 2000);
      if (titleInputRef.current) titleInputRef.current.focus();
      return;
    }
    const newId = crypto.randomUUID();
    createMutation.mutate({ ...pendingRow, id: newId }, { 
      onSuccess: () => {
        setPendingRow({});
        if (titleInputRef.current) titleInputRef.current.focus();
      } 
    });
  };

  const clearPendingRow = () => setPendingRow({});
  const hasPendingData = Object.keys(pendingRow).length > 0;

  return (
    <tr className="bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/50 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
      {table.getVisibleLeafColumns().map((column: Column<Opportunity, unknown>) => {
        if (column.id === 'select' || column.id === 'open_panel') return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800" />;
        
        if (column.id === 'options') {
          return (
            <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle text-center">
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={submitGhostRow}
                  className="p-1 bg-sky-500 hover:bg-sky-600 text-white rounded shadow-sm transition-colors"
                  title="Add Opportunity"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={clearPendingRow}
                  disabled={!hasPendingData}
                  className={`p-1 rounded shadow-sm transition-colors ${
                    hasPendingData 
                      ? 'bg-slate-200 hover:bg-rose-500 text-slate-500 hover:text-white cursor-pointer' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  }`}
                  title="Clear Row"
                >
                  <X size={16} />
                </button>
              </div>
            </td>
          );
        }
        if (column.id === 'expander') {
          return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle text-slate-400 text-center text-xs font-bold">+</td>;
        }
        if (column.id === 'title') {
          return (
            <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-top">
              <input
                ref={titleInputRef}
                autoFocus
                type="text"
                placeholder="+ Add Item..."
                value={pendingRow.title || ''}
                onChange={(e) => setPendingRow(prev => ({ ...prev, title: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitGhostRow();
                  }
                }}
                className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400/70 dark:placeholder-slate-500/70 italic ${ghostError ? 'ring-2 ring-rose-500 animate-pulse' : ''}`}
              />
            </td>
          );
        }
        
        return (
          <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle">
            <span className="text-sm text-slate-400 px-2 py-1 italic block w-full h-full opacity-60 text-center cursor-not-allowed select-none">-</span>
          </td>
        );
      })}
    </tr>
  );
}
