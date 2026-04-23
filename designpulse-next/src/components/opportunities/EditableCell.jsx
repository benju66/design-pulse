"use client";
import React, { useState, useEffect } from 'react';
import { useOpportunityOptions } from '@/hooks/useProjectQueries';

export const EditableCell = ({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const updateMutation = table.options.meta?.updateData;

  const onBlur = () => {
    if (value !== initialValue) {
      updateMutation.mutate({
        id: row.original.id,
        updates: { [column.id]: value }
      });
    }
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const isImpactField = column.id === 'cost_impact' || column.id === 'days_impact';
  const { data: options = [] } = useOpportunityOptions(isImpactField ? row.original.id : null);

  if (column.id === 'status') {
    return (
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          updateMutation.mutate({ id: row.original.id, updates: { status: e.target.value } });
        }}
        className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100"
      >
        <option value="Draft">Draft</option>
        <option value="Pending Review">Pending Review</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
      </select>
    );
  }

  if (isImpactField) {
    const hasOptions = options.length > 0;
    const lockedOption = options.find(o => o.is_locked);
    
    if (hasOptions && !lockedOption) {
      // It's unlocked! Show range
      const min = Math.min(...options.map(o => Number(o[column.id]) || 0));
      const max = Math.max(...options.map(o => Number(o[column.id]) || 0));
      
      const formatVal = (v) => column.id === 'cost_impact' 
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
        : `${v} days`;

      return (
        <div className="w-full h-full px-2 py-1 text-sm italic text-slate-400 dark:text-slate-500 flex items-center">
          {min === max ? formatVal(min) : `${formatVal(min)} to ${formatVal(max)}`}
        </div>
      );
    }
  }

  return (
    <input
      value={value || ''}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100 ${
        column.id === 'cost_impact' && value < 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''
      }`}
      type={isImpactField ? 'number' : 'text'}
    />
  );
};
