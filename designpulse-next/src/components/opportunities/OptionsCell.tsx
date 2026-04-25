"use client";
import React from 'react';
import { Row, Table } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

interface OptionsCellProps {
  row: Row<Opportunity>;
  table: Table<Opportunity>;
}

export const OptionsCell = React.memo(({ row, table }: OptionsCellProps) => {
  const optionsMap = table.options.meta?.optionsMap || {};
  const options = optionsMap[row.original.id] || [];
  
  if (!options || options.length === 0) {
    return <div className="flex items-center justify-center p-2 h-full"><span className="text-xs text-slate-300 dark:text-slate-600 italic">-</span></div>;
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="relative flex items-center justify-center p-2 group h-full cursor-default z-10">
      <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-semibold border border-slate-200 dark:border-slate-700 group-hover:border-sky-300 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/30 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors shadow-sm">
        [ {options.length} {options.length === 1 ? 'Option' : 'Options'} ]
      </div>
      
      {/* Popover */}
      <div className="absolute top-1/2 left-full ml-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[100] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform -translate-x-2 group-hover:translate-x-0">
        <div className="p-3">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Contenders</h4>
          <ul className="space-y-2">
            {options.map(opt => (
              <li key={opt.id} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700/50 pb-1 last:border-0 last:pb-0">
                <span className={`font-medium truncate mr-2 ${opt.is_locked ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
                  {opt.is_locked && '★ '}{opt.title}
                </span>
                <span className={`whitespace-nowrap font-mono text-xs font-semibold ${(opt.cost_impact || 0) < 0 ? 'text-emerald-500' : (opt.cost_impact || 0) > 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                  {(opt.cost_impact || 0) > 0 ? '+' : ''}{formatCurrency(opt.cost_impact || 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  const prevOptions = prevProps.table.options.meta?.optionsMap?.[prevProps.row.original.id] || [];
  const nextOptions = nextProps.table.options.meta?.optionsMap?.[nextProps.row.original.id] || [];
  
  if (prevOptions.length !== nextOptions.length) return false;
  for (let i = 0; i < prevOptions.length; i++) {
    if (prevOptions[i] !== nextOptions[i]) return false;
  }
  
  return true;
});
