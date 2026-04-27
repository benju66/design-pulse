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
  disabled?: boolean;
}

export const CellWrapper = ({ row, column, displayValue, inputElement, className, table, disabled }: CellWrapperProps) => {
  const activeCell = table?.options?.meta?.activeCell || { rowIndex: null, columnId: null };
  const setActiveCell = table?.options?.meta?.setActiveCell || (() => {});
  const isCellActive = activeCell.rowIndex === row.index && activeCell.columnId === column.id;
  const gridMode = useUIStore(state => state.gridMode);
  const setGridMode = useUIStore(state => state.setGridMode);
  const isEditing = isCellActive && gridMode === 'edit' && !disabled;
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCellActive && gridMode === 'edit' && disabled) {
      setGridMode('navigate'); // Instantly bounce them back out to prevent freezing
    }
  }, [isCellActive, gridMode, disabled, setGridMode]);

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
      onDoubleClick={() => {
        if (!disabled) setGridMode('edit');
      }}
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

  const isLocked = ['Pending Plan Update', 'GC / Owner Review', 'Implemented'].includes(row.original.status || '');
  const disabled = column.id === 'title' && isLocked;

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    if (value !== initialValue && updateMutation) {
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: value } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: string) => void) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      setGridMode('navigate');
      onBlur();
    }
  };

  return (
    <CellWrapper
      disabled={disabled}
      row={row}
      column={column}
      table={table}
      displayValue={value || ''}
      inputElement={(_isActive, setGridMode) => (
        <input
          ref={inputRef}
          autoFocus
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onBlur}
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
  
  const isLocked = ['Pending Plan Update', 'GC / Owner Review', 'Implemented'].includes(row.original.status || '');
  const disabled = isLocked;
  
  useEffect(() => {
    setValue(initialValue ?? '');
  }, [initialValue]);

  const optionsMap = table.options.meta?.optionsMap || {};
  const options = optionsMap[row.original.id] || [];

  const onBlur = () => {
    if (value !== initialValue && updateMutation) {
      const numericValue = value === '' ? null : Number(value);
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: numericValue } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: string) => void) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      setGridMode('navigate');
      onBlur();
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
      disabled={disabled}
      row={row}
      column={column}
      table={table}
      className={colorClass}
      displayValue={displayValue}
      inputElement={(_isActive, setGridMode) => (
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => handleKeyDown(e, setGridMode)}
          type="number"
          className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100 ${colorClass}`}
        />
      )}
    />
  );
}, (prev, next) => commonComparator(prev, next, true));

export const DivisionCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const [value, setValue] = useState(initialValue || '');
  const updateMutation = table.options.meta?.updateData;
  const inputRef = useRef<HTMLInputElement>(null);

  const rawCostCodes = (table.options.meta as any)?.rawCostCodes || [];
  const divisionOptions = rawCostCodes
    .filter((c: any) => c.is_division)
    .map((c: any) => `${c.code} - ${c.description}`);

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const onBlur = () => {
    if (value !== initialValue && updateMutation) {
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: value } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: string) => void) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      setGridMode('navigate');
      onBlur();
    }
  };

  return (
    <>
      <CellWrapper
        row={row}
        column={column}
        table={table}
        displayValue={value || ''}
        inputElement={(_isActive, setGridMode) => (
          <input
            ref={inputRef}
            autoFocus
            list="divisions-list"
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => handleKeyDown(e, setGridMode)}
            className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
            type="text"
          />
        )}
      />
      <datalist id="divisions-list">
        {divisionOptions.map((opt: string) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const CostCodeCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const [value, setValue] = useState(initialValue || '');
  const updateMutation = table.options.meta?.updateData;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const rawCostCodes = (table.options.meta as any)?.rawCostCodes || [];
  const currentDivisionStr = row.original.division || '';
  const currentDivisionCode = currentDivisionStr.split(' ')[0] || '';

  const onBlur = () => {
    if (value !== initialValue && updateMutation) {
      const updates: any = { [column.id]: value };
      
      // Auto-fill Division based on selected Cost Code
      if (value) {
        const parsedCode = value.split(' - ')[0]?.trim();
        const matchedCode = rawCostCodes.find((c: any) => c.code === parsedCode && !c.is_division);
        
        if (matchedCode && matchedCode.parent_division) {
          const parentDivObj = rawCostCodes.find((c: any) => c.code === matchedCode.parent_division && c.is_division);
          if (parentDivObj) {
            updates.division = `${parentDivObj.code} - ${parentDivObj.description}`;
          }
        }
      }

      updateMutation.mutate({ id: row.original.id, updates });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: string) => void) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      setGridMode('navigate');
      onBlur();
    }
  };

  const costCodeOptions = rawCostCodes
    .filter((c: any) => {
      if (c.is_division) return false;
      if (currentDivisionCode && c.parent_division) {
        return c.parent_division === currentDivisionCode;
      }
      return true; // if no division selected, show all non-division codes
    })
    .map((c: any) => `${c.code} - ${c.description}`);

  return (
    <>
      <CellWrapper
        row={row}
        column={column}
        table={table}
        displayValue={value || ''}
        inputElement={(_isActive, setGridMode) => (
          <input
            ref={inputRef}
            autoFocus
            list={`cost-codes-list-${row.original.id}`}
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => handleKeyDown(e, setGridMode)}
            className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
            type="text"
          />
        )}
      />
      <datalist id={`cost-codes-list-${row.original.id}`}>
        {costCodeOptions.map((opt: string) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const DisplayIdCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const value = getValue() as string | null | undefined;
  const recordType = row.original.record_type;
  const displayValue = value || '';

  if (recordType === 'Coordination') {
    return (
      <CellWrapper
        disabled={true}
        row={row}
        column={column}
        table={table}
        className="w-full h-full flex items-center cursor-default"
        displayValue={
          <span 
            className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
            title="Escalated from Design Coordination"
          >
            {displayValue}
          </span>
        }
        inputElement={() => null}
      />
    );
  }

  return (
    <CellWrapper
      disabled={true}
      row={row}
      column={column}
      table={table}
      className="text-slate-600 dark:text-slate-400 font-mono text-sm cursor-default"
      displayValue={displayValue}
      inputElement={() => null}
    />
  );
}, (prev, next) => commonComparator(prev, next, false));
