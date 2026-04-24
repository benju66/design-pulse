"use client";
import React, { useState, useEffect } from 'react';
import { useAllProjectOptions, useProjectSettings } from '@/hooks/useProjectQueries';
import { useParams } from 'next/navigation';

import { useUIStore } from '@/stores/useUIStore';

export const TextCell = React.memo(({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const updateMutation = table.options.meta?.updateData;
  
  const isActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const inputRef = React.useRef(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (!isFocused) {
      setValue(initialValue);
    }
  }, [initialValue, isFocused]);

  const onBlur = () => {
    setIsFocused(false);
    if (value !== initialValue) {
      updateMutation.mutate({
        id: row.original.id,
        updates: { [column.id]: value }
      });
    }
  };

  return (
    <input
      ref={inputRef}
      value={value || ''}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => {
        setIsFocused(true);
        setActiveCell({ rowIndex: row.index, columnId: column.id });
      }}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
      type="text"
    />
  );
}, (prev, next) => prev.getValue() === next.getValue());

export const StatusCell = React.memo(({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const updateMutation = table.options.meta?.updateData;
  const isActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const selectRef = React.useRef(null);

  useEffect(() => {
    if (isActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isActive]);

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue}
      onChange={(e) => {
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
}, (prev, next) => prev.getValue() === next.getValue());

export const ScopeCell = React.memo(({ getValue, row, column, table }) => {
  const params = useParams();
  const projectId = params?.projectId;
  const { data: settings } = useProjectSettings(projectId);
  const initialValue = getValue();
  const updateMutation = table.options.meta?.updateData;
  const scopes = settings?.scopes || ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  const isActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const selectRef = React.useRef(null);

  useEffect(() => {
    if (isActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isActive]);

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue || ''}
      onChange={(e) => {
        updateMutation.mutate({ id: row.original.id, updates: { scope: e.target.value } });
      }}
      className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100"
    >
      <option value="" disabled>Select Scope...</option>
      {scopes.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}, (prev, next) => prev.getValue() === next.getValue());

export const ImpactCell = React.memo(({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const updateMutation = table.options.meta?.updateData;
  
  const params = useParams();
  const projectId = params?.projectId;
  const { data: allOptions = [] } = useAllProjectOptions(projectId);
  const options = React.useMemo(() => allOptions.filter(o => o.opportunity_id === row.original.id), [allOptions, row.original.id]);
  const isActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const inputRef = React.useRef(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (!isFocused) {
      setValue(initialValue);
    }
  }, [initialValue, isFocused]);

  const onBlur = () => {
    setIsFocused(false);
    if (value !== initialValue) {
      updateMutation.mutate({
        id: row.original.id,
        updates: { [column.id]: Number(value) || 0 }
      });
    }
  };

  const hasOptions = options.length > 0;
  const lockedOption = options.find(o => o.is_locked);
  
  if (hasOptions && !lockedOption) {
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

  return (
    <input
      ref={inputRef}
      value={value ?? ''}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => {
        setIsFocused(true);
        setActiveCell({ rowIndex: row.index, columnId: column.id });
      }}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100 ${
        column.id === 'cost_impact' && value < 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''
      }`}
      type="number"
    />
  );
}, (prev, next) => prev.getValue() === next.getValue());
