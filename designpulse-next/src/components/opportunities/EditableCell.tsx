"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useProjectSettings } from '@/hooks/useProjectQueries';
import { useParams } from 'next/navigation';
import { useUIStore } from '@/stores/useUIStore';
import { CellContext, Row, Column, Table } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

const commonComparator = (prevProps: CellContext<Opportunity, unknown>, nextProps: CellContext<Opportunity, unknown>, checkOptions = false) => {
  if (prevProps.getValue() !== nextProps.getValue()) return false;
  if (checkOptions) {
    const prevOptions = prevProps.table.options.meta?.optionsMap?.[prevProps.row.original.id] || [];
    const nextOptions = nextProps.table.options.meta?.optionsMap?.[nextProps.row.original.id] || [];
    
    // FAST ARRAY CHECK: Check length, then check object references inside
    if (prevOptions.length !== nextOptions.length) return false;
    for (let i = 0; i < prevOptions.length; i++) {
      if (prevOptions[i] !== nextOptions[i]) return false; 
    }
  }
  const prevActive = prevProps.table.options.meta?.activeCell || { rowIndex: null, columnId: null };
  const nextActive = nextProps.table.options.meta?.activeCell || { rowIndex: null, columnId: null };
  const wasActive = prevActive.rowIndex === prevProps.row.index && prevActive.columnId === prevProps.column.id;
  const isNowActive = nextActive.rowIndex === nextProps.row.index && nextActive.columnId === nextProps.column.id;
  if (wasActive !== isNowActive) return false;
  return true;
};

interface CellWrapperProps {
  row: Row<Opportunity>;
  column: Column<Opportunity, unknown>;
  displayValue: React.ReactNode;
  inputElement: (isActive: boolean, setGridMode: (mode: string) => void) => React.ReactNode;
  className?: string;
  table: Table<Opportunity>;
}

export const CellWrapper = ({ row, column, displayValue, inputElement, className, table }: CellWrapperProps) => {
  const activeCell = table?.options?.meta?.activeCell || { rowIndex: null, columnId: null };
  const setActiveCell = table?.options?.meta?.setActiveCell || (() => {});
  const isCellActive = activeCell.rowIndex === row.index && activeCell.columnId === column.id;
  const gridMode = useUIStore(state => state.gridMode);
  const isEditing = isCellActive && gridMode === 'edit';
  const setGridMode = useUIStore(state => state.setGridMode);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isCellActive && !isEditing && divRef.current) {
      timeoutId = setTimeout(() => {
        divRef.current?.focus();
      }, 0);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isCellActive, isEditing]);

  if (isEditing) {
    return inputElement(isCellActive, setGridMode);
  }

  return (
    <div
      ref={divRef}
      tabIndex={0}
      onClick={() => {
        setActiveCell({ rowIndex: row.index, columnId: column.id });
        setGridMode('navigate');
      }}
      onDoubleClick={() => setGridMode('edit')}
      className={`w-full h-full px-2 py-1 text-sm min-h-[28px] outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 truncate cursor-text ${className || 'text-slate-900 dark:text-slate-100'}`}
    >
      {displayValue}
    </div>
  );
};

export const TextCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const [value, setValue] = useState(initialValue);
  const updateMutation = table.options.meta?.updateData;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = (setGridMode: (mode: string) => void) => {
    if (value !== initialValue && updateMutation) {
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: value } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: string) => void) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      setGridMode('navigate');
      onBlur(setGridMode);
    }
  };

  return (
    <CellWrapper
      row={row}
      column={column}
      table={table}
      displayValue={value || ''}
      inputElement={(isActive, setGridMode) => (
        <input
          ref={inputRef}
          autoFocus
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onBlur(setGridMode)}
          onKeyDown={(e) => handleKeyDown(e, setGridMode)}
          className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
          type="text"
        />
      )}
    />
  );
}, (prev, next) => commonComparator(prev, next, false));

export const StatusCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string;
  const updateMutation = table.options.meta?.updateData;
  const activeCell = table.options.meta?.activeCell || { rowIndex: null, columnId: null };
  const setActiveCell = table.options.meta?.setActiveCell || (() => {});
  const isActive = activeCell.rowIndex === row.index && activeCell.columnId === column.id;
  const selectRef = useRef<HTMLSelectElement>(null);

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
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { status: e.target.value } });
        }
      }}
      className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100"
    >
      <option value="Draft">Draft</option>
      <option value="Pending Review">Pending Review</option>
      <option value="Approved">Approved</option>
      <option value="Rejected">Rejected</option>
    </select>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const ScopeCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const params = useParams();
  const projectId = params?.projectId as string | null;
  const { data: settings } = useProjectSettings(projectId);
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const scopes = (settings?.scopes as string[]) || ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  const activeCell = table.options.meta?.activeCell || { rowIndex: null, columnId: null };
  const setActiveCell = table.options.meta?.setActiveCell || (() => {});
  const isActive = activeCell.rowIndex === row.index && activeCell.columnId === column.id;
  const selectRef = useRef<HTMLSelectElement>(null);

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
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { scope: e.target.value } });
        }
      }}
      className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100"
    >
      <option value="" disabled>Select Scope...</option>
      {scopes.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const PriorityCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const activeCell = table.options.meta?.activeCell || { rowIndex: null, columnId: null };
  const setActiveCell = table.options.meta?.setActiveCell || (() => {});
  const isActive = activeCell.rowIndex === row.index && activeCell.columnId === column.id;
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isActive]);

  const priorityColors: Record<string, string> = {
    'Critical': 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 font-bold',
    'High': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 font-semibold',
    'Medium': 'text-sky-600 dark:text-sky-400 font-medium',
    'Low': 'text-slate-500 dark:text-slate-400'
  };

  const currentClass = priorityColors[initialValue || ''] || priorityColors['Medium'];

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue || 'Medium'}
      onChange={(e) => {
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { priority: e.target.value } });
        }
      }}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm cursor-pointer ${currentClass}`}
    >
      <option value="Critical" className="font-bold text-rose-600">Critical</option>
      <option value="High" className="font-semibold text-amber-600">High</option>
      <option value="Medium" className="font-medium text-sky-600">Medium</option>
      <option value="Low" className="text-slate-500">Low</option>
    </select>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const ImpactCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as number | string | null | undefined;
  const [value, setValue] = useState<string | number>(initialValue ?? '');
  const updateMutation = table.options.meta?.updateData;
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    setValue(initialValue ?? '');
  }, [initialValue]);

  const optionsMap = table.options.meta?.optionsMap || {};
  const options = optionsMap[row.original.id] || [];

  const onBlur = (setGridMode: (mode: string) => void) => {
    if (value !== initialValue && updateMutation) {
      const numericValue = value === '' ? null : Number(value);
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: numericValue } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: string) => void) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      setGridMode('navigate');
      onBlur(setGridMode);
    }
  };

  const hasOptions = options.length > 0;
  const lockedOption = options.find(o => o.is_locked);
  
  if (hasOptions && !lockedOption) {
    const min = Math.min(...options.map(o => Number((o as any)[column.id]) || 0));
    const max = Math.max(...options.map(o => Number((o as any)[column.id]) || 0));
    
    const formatVal = (v: number) => column.id === 'cost_impact' 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
      : `${v} days`;

    return (
      <div className="w-full h-full px-2 py-1 text-sm italic text-slate-400 dark:text-slate-500 flex items-center">
        {min === max ? formatVal(min) : `${formatVal(min)} to ${formatVal(max)}`}
      </div>
    );
  }

  const displayValue = value === null || value === undefined || value === '' ? '' : 
    column.id === 'cost_impact' && value !== '' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(Number(value)) : value;

  const numValue = Number(value);
  const colorClass = column.id === 'cost_impact' && numValue < 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 
                     column.id === 'cost_impact' && numValue > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : '';

  return (
    <CellWrapper
      row={row}
      column={column}
      table={table}
      className={colorClass}
      displayValue={displayValue}
      inputElement={(isActive, setGridMode) => (
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onBlur(setGridMode)}
          onKeyDown={(e) => handleKeyDown(e, setGridMode)}
          type="number"
          className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100 ${colorClass}`}
        />
      )}
    />
  );
}, (prev, next) => commonComparator(prev, next, true));
