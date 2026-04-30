"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useProjectSettings } from '@/hooks/useProjectQueries';
import { useParams } from 'next/navigation';
import { useUIStore } from '@/stores/useUIStore';
import { CellContext, Row, Column } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';
import { AssigneeSelect } from './AssigneeSelect';

const commonComparator = (prevProps: CellContext<Opportunity, unknown>, nextProps: CellContext<Opportunity, unknown>, _checkOptions = false) => {
  if (prevProps.getValue() !== nextProps.getValue()) return false;
  if (prevProps.row.original !== nextProps.row.original) return false;
  return true;
};

interface CellWrapperProps {
  row: Row<Opportunity>;
  column: Column<Opportunity, unknown>;
  displayValue: React.ReactNode;
  inputElement: (isActive: boolean, setGridMode: (mode: 'navigate' | 'edit') => void) => React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const CellWrapper = ({ row, column, displayValue, inputElement, className, disabled }: CellWrapperProps) => {
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const setActiveCell = useUIStore(state => state.setActiveCell);
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
      className={`w-full h-full px-2 py-1 text-sm min-h-[28px] outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 truncate cursor-text ${className || 'text-slate-900 dark:text-slate-100'} ${isCellActive && !isEditing ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
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

  const isLocked = row.original.status === 'Approved';
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const disabled = (column.id === 'title' && isLocked) || !permissions.can_edit_records;

  const isSubmitting = useRef(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    if (isSubmitting.current) return;
    if (value !== initialValue && updateMutation) {
      isSubmitting.current = true;
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: value } }, {
        onSettled: () => { isSubmitting.current = false; }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: 'navigate' | 'edit') => void) => {
    const moveActiveCell = (table.options.meta as any)?.moveActiveCellRef?.current;
    if (e.key === 'Enter') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setValue(initialValue);
      setGridMode('navigate');
    }
  };

  return (
    <CellWrapper
      disabled={disabled}
      row={row}
      column={column}
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
  const setGridMode = useUIStore(state => state.setGridMode);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue}
      disabled={!permissions.can_edit_records}
      onChange={(e) => {
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { status: e.target.value } });
        }
        setGridMode('navigate');
      }}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100 ${isCellActive ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      <option value="Draft">Draft</option>
      <option value="Pending Review">Pending Review</option>
      <option value="Approved">Approved</option>
      <option value="Rejected">Rejected</option>
    </select>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const CoordinationStatusCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const setGridMode = useUIStore(state => state.setGridMode);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue || 'Not Required'}
      disabled={!permissions.can_edit_records}
      onChange={(e) => {
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { coordination_status: e.target.value } });
        }
        setGridMode('navigate');
      }}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100 ${isCellActive ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      <option value="Not Required">Not Required</option>
      <option value="Pending Plan Update">Pending Plan Update</option>
      <option value="Ready for Review">Ready for Review</option>
      <option value="Implemented">Implemented</option>
    </select>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const BuildingAreaCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const params = useParams();
  const projectId = params?.projectId as string | null;
  const { data: settings } = useProjectSettings(projectId);
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const buildingAreas = (settings?.building_areas as string[]) || ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  const setGridMode = useUIStore(state => state.setGridMode);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue || ''}
      disabled={!permissions.can_edit_records}
      onChange={(e) => {
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { building_area: e.target.value || null } });
        }
        setGridMode('navigate');
      }}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100 ${isCellActive ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      <option value="" className="text-slate-400">Select Building Area</option>
      {buildingAreas.map((area) => (
        <option key={area} value={area}>{area}</option>
      ))}
    </select>
  );
}, (prev, next) => commonComparator(prev, next, false));

export const PriorityCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const setGridMode = useUIStore(state => state.setGridMode);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const isCellActive = useUIStore(state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id);
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  const priorityColors: Record<string, string> = {
    'Critical': 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 font-bold',
    'High': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 font-semibold',
    'Medium': 'text-sky-600 dark:text-sky-400 font-medium',
    'Low': 'text-slate-500 dark:text-slate-400',
    'Set Priority': 'text-slate-400 dark:text-slate-500 italic'
  };

  const currentClass = priorityColors[initialValue || ''] || priorityColors['Set Priority'];

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue || 'Set Priority'}
      disabled={!permissions.can_edit_records}
      onChange={(e) => {
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { priority: e.target.value } });
        }
        setGridMode('navigate');
      }}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm cursor-pointer ${currentClass} ${isCellActive ? 'ring-2 ring-sky-400' : ''}`}
    >
      <option value="Set Priority" className="text-slate-400 italic">Set Priority</option>
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
  
  const isLocked = row.original.status === 'Approved';
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const disabled = isLocked || !permissions.can_edit_records;
  
  const isSubmitting = useRef(false);

  useEffect(() => {
    setValue(initialValue ?? '');
  }, [initialValue]);

  const optionsMap = table.options.meta?.optionsMap || {};
  const options = optionsMap[row.original.id] || [];

  const onBlur = () => {
    if (isSubmitting.current) return;
    if (value !== initialValue && updateMutation) {
      isSubmitting.current = true;
      const numericValue = value === '' ? null : Number(value);
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: numericValue } }, {
        onSettled: () => { isSubmitting.current = false; }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: 'navigate' | 'edit') => void) => {
    const moveActiveCell = (table.options.meta as any)?.moveActiveCellRef?.current;
    if (e.key === 'Enter') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setValue(initialValue ?? '');
      setGridMode('navigate');
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
      <div className="w-full h-full px-2 py-1 text-sm min-h-[28px] truncate italic text-slate-400 dark:text-slate-500 cursor-default">
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
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const disabled = !permissions.can_edit_records;

  const rawCostCodes = (table.options.meta as any)?.rawCostCodes || [];
  const divisionOptions = rawCostCodes
    .filter((c: any) => c.is_division)
    .map((c: any) => `${c.code} - ${c.description}`);

  const isSubmitting = useRef(false);

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const onBlur = () => {
    if (isSubmitting.current) return;
    if (value !== initialValue && updateMutation) {
      isSubmitting.current = true;
      updateMutation.mutate({ id: row.original.id, updates: { [column.id]: value } }, {
        onSettled: () => { isSubmitting.current = false; }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: 'navigate' | 'edit') => void) => {
    const moveActiveCell = (table.options.meta as any)?.moveActiveCellRef?.current;
    if (e.key === 'Enter') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      if (moveActiveCell) moveActiveCell(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setValue(initialValue || '');
      setGridMode('navigate');
    }
  };

  return (
    <>
      <CellWrapper
        disabled={disabled}
        row={row}
        column={column}
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
  const permissions = table.options.meta?.permissions || { can_edit_records: false };
  const disabled = !permissions.can_edit_records;

  const isSubmitting = useRef(false);

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const rawCostCodes = table.options.meta?.rawCostCodes || [];
  const currentDivisionStr = row.original.division || '';
  const currentDivisionCode = currentDivisionStr.split(' ')[0] || '';

  const onBlur = () => {
    if (isSubmitting.current) return;
    if (value !== initialValue && updateMutation) {
      isSubmitting.current = true;
      const updates: Record<string, unknown> = { [column.id]: value };
      if (value) {
        const parsedCode = value.split(' - ')[0]?.trim();
        const matchedCode = rawCostCodes.find((c) => c.code === parsedCode && !c.is_division);
        if (matchedCode && matchedCode.parent_division) {
          const parentDivObj = rawCostCodes.find((c) => c.code === matchedCode.parent_division && c.is_division);
          if (parentDivObj) {
            updates.division = `${parentDivObj.code} - ${parentDivObj.description}`;
          }
        }
      }
      updateMutation.mutate({ id: row.original.id, updates }, {
        onSettled: () => { isSubmitting.current = false; }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setGridMode: (mode: 'navigate' | 'edit') => void) => {
    const moveActiveCell = (table.options.meta as Record<string, unknown>)?.moveActiveCellRef as { current?: (d: string) => void } | undefined;
    if (e.key === 'Enter') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      moveActiveCell?.current?.('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onBlur();
      setGridMode('navigate');
      moveActiveCell?.current?.(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setValue(initialValue || '');
      setGridMode('navigate');
    }
  };

  const costCodeOptions = rawCostCodes
    .filter((c) => {
      if (c.is_division) return false;
      if (currentDivisionCode && c.parent_division) {
        return c.parent_division === currentDivisionCode;
      }
      return true;
    })
    .map((c) => `${c.code} - ${c.description}`);

  return (
    <>
      <CellWrapper
        disabled={disabled}
        row={row}
        column={column}
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

// ---------------------------------------------------------------------------
// CostCodeSpecCell — Phase 3 Rosetta Stone Smart Dropdown
// Replaces the legacy datalist with a two-tier popover:
//   Top: Smart combobox (base codes + project CSI specs with → mapping)
//   Bottom: Segmented control for Cost Type
// Guardrails:
//   - Click-outside: useRef containment (Rule C16, no stopPropagation)
//   - Mutation: onChange on selection (Rule C23, no onBlur race condition)
//   - Escape: CANCELS and closes (Rule C18, inline grid cell behavior)
//   - Memoization: strictly on row.original identity (Rule C10)
//   - iOS-safe search: character stripping, no negative lookbehinds (Rule A)
// ---------------------------------------------------------------------------
import { Search } from 'lucide-react';
import { CostType, ProjectCsiSpec } from '@/types/models';

const COST_TYPE_PILL: Record<CostType, string> = {
  Labor:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Material:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Subcontract: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Equipment:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Other:       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const COST_TYPES: CostType[] = ['Labor', 'Material', 'Subcontract', 'Equipment', 'Other'];

// iOS-safe normalization: strip non-alphanumeric, lowercase (no negative lookbehind)
function normalizeSearch(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const CostCodeSpecCell = React.memo(({ getValue, row, table }: CellContext<Opportunity, unknown>) => {
  const initialCode    = getValue() as string | null | undefined;
  const initialCostType = row.original.cost_type as CostType | null | undefined;

  const updateMutation = table.options.meta?.updateData;
  const rawCostCodes   = table.options.meta?.rawCostCodes || [];
  const csiSpecs       = table.options.meta?.csiSpecs || [];
  const permissions    = table.options.meta?.permissions || { can_edit_records: false };
  const disabled       = !permissions.can_edit_records;

  const [isOpen,       setIsOpen]       = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const containerRef   = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Rule C16: useRef containment for click-outside — NEVER stopPropagation
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen) {
      // Micro-delay ensures the DOM is mounted before focusing
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const nq = normalizeSearch(searchQuery);

  const filteredBaseCodes = rawCostCodes.filter((c) => {
    if (c.is_division) return false;
    if (!searchQuery) return true;
    return normalizeSearch(c.code).includes(nq) || normalizeSearch(c.description || '').includes(nq);
  });

  const filteredCsiSpecs = (csiSpecs as ProjectCsiSpec[]).filter((spec) => {
    if (!searchQuery) return true;
    return (
      spec.normalized_csi_number.includes(nq) ||
      normalizeSearch(spec.csi_number).includes(nq) ||
      normalizeSearch(spec.description || '').includes(nq)
    );
  });

  // Rule C23: atomic onChange mutation — never onBlur
  const handleSelectBaseCode = (code: string) => {
    if (!updateMutation) return;
    const updates: Partial<Opportunity> = { cost_code: code };
    const matched = rawCostCodes.find((c) => c.code === code && !c.is_division);
    if (matched?.parent_division) {
      const parentDiv = rawCostCodes.find((c) => c.code === matched.parent_division && c.is_division);
      if (parentDiv) updates.division = `${parentDiv.code} - ${parentDiv.description}`;
    }
    updateMutation.mutate({ id: row.original.id, updates });
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCsiSpec = (spec: ProjectCsiSpec) => {
    if (!updateMutation || !spec.cost_code) return;
    const updates: Partial<Opportunity> = { cost_code: spec.cost_code };
    const matched = rawCostCodes.find((c) => c.code === spec.cost_code && !c.is_division);
    if (matched?.parent_division) {
      const parentDiv = rawCostCodes.find((c) => c.code === matched.parent_division && c.is_division);
      if (parentDiv) updates.division = `${parentDiv.code} - ${parentDiv.description}`;
    }
    updateMutation.mutate({ id: row.original.id, updates });
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCostType = (type: CostType) => {
    if (!updateMutation) return;
    // Atomic: fires immediately on click, no blur required
    updateMutation.mutate({ id: row.original.id, updates: { cost_type: type } });
  };

  const isEmpty = !initialCode;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* ── Read-only display ── */}
      <div
        onClick={() => { if (!disabled) setIsOpen(true); }}
        className={`
          w-full h-full px-2 py-1 text-sm min-h-[28px] flex items-center gap-1.5
          ${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}
          ${isOpen ? 'ring-2 ring-inset ring-sky-500 bg-sky-50/50 dark:bg-sky-900/20' : ''}
        `}
      >
        <span className={`font-mono text-xs truncate ${isEmpty ? 'text-slate-400 italic' : 'text-slate-900 dark:text-slate-100'}`}>
          {initialCode || 'Set Code…'}
        </span>
        {initialCostType && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${COST_TYPE_PILL[initialCostType]}`}>
            {initialCostType}
          </span>
        )}
      </div>

      {/* ── Smart Popover ── */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-0.5 z-[200] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-72 overflow-hidden flex flex-col">

          {/* Search input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Rule C18: Escape CANCELS, closes popover (inline grid behavior)
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsOpen(false);
                    setSearchQuery('');
                  }
                }}
                placeholder="Search codes or descriptions…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Results list */}
          <div className="max-h-52 overflow-y-auto">
            {/* Base codes */}
            {filteredBaseCodes.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                  Cost Codes
                </div>
                {filteredBaseCodes.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => handleSelectBaseCode(c.code)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                      initialCode === c.code
                        ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                    }`}
                  >
                    <span className="font-mono font-semibold shrink-0">{c.code}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate text-right text-[11px]">{c.description}</span>
                  </button>
                ))}
              </>
            )}

            {/* CSI specs */}
            {filteredCsiSpecs.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400 dark:text-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                  CSI Specs — This Project
                </div>
                {filteredCsiSpecs.map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => handleSelectCsiSpec(spec)}
                    disabled={!spec.cost_code}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 shrink-0">{spec.csi_number}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate">{spec.description}</span>
                    {spec.cost_code && (
                      <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono whitespace-nowrap">
                        → {spec.cost_code}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}

            {filteredBaseCodes.length === 0 && filteredCsiSpecs.length === 0 && (
              <div className="px-3 py-5 text-xs text-slate-400 text-center italic">
                No matches found
              </div>
            )}
          </div>

          {/* ── Cost Type Segmented Control ── */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
              Cost Type
            </p>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {COST_TYPES.map((type, i) => (
                <button
                  key={type}
                  onClick={() => handleSelectCostType(type)}
                  title={type}
                  className={`
                    flex-1 py-1.5 text-[10px] font-semibold transition-colors
                    ${i > 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''}
                    ${initialCostType === type
                      ? 'bg-sky-500 text-white shadow-inner'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                    }
                  `}
                >
                  {type.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  // Rule C10: memoize strictly on row.original identity — cost_type changes spread the row
}, (prev, next) => prev.row.original === next.row.original);


export const DisplayIdCell = React.memo(({ getValue, row, column }: CellContext<Opportunity, unknown>) => {
  const value = getValue() as string | null | undefined;
  const recordType = row.original.record_type;
  const displayValue = value || '';

  if (recordType === 'Coordination') {
    return (
      <CellWrapper
        disabled={true}
        row={row}
        column={column}
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
      className="text-slate-600 dark:text-slate-400 font-mono text-sm cursor-default"
      displayValue={displayValue}
      inputElement={() => null}
    />
  );
}, (prev, next) => commonComparator(prev, next, false));

export const AssigneeCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const projectMembers = (table.options.meta as any)?.projectMembers || [];
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };
  const disabled = !permissions.can_edit_records;
  
  const activeCell = table.options.meta?.activeCell || { rowIndex: null, columnId: null };
  const setActiveCell = table.options.meta?.setActiveCell || (() => {});
  const isActive = activeCell.rowIndex === row.index && activeCell.columnId === column.id;
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isActive]);

  const emails = initialValue ? initialValue.split(',').map(e => e.trim()).filter(Boolean) : [];
  const assignedMembers = emails.map(email => {
    const matched = projectMembers.find((m: any) => m.email === email || m.name === email);
    return {
      email: matched?.email || email,
      displayName: matched ? (matched.name || matched.email) : email
    };
  });

  const displayElement = assignedMembers.length > 0 ? (
    <div 
      className="flex items-center w-full h-full cursor-pointer overflow-hidden gap-1" 
      title={assignedMembers.map(m => `${m.displayName}${m.email && m.email !== m.displayName ? `\n${m.email}` : ''}`).join('\n\n')}
    >
      {assignedMembers.slice(0, 3).map((m, i) => (
        <div key={i} className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm border border-white dark:border-slate-800 -ml-2 first:ml-0">
          {m.displayName.substring(0, 2).toUpperCase()}
        </div>
      ))}
      {assignedMembers.length > 3 && (
        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm border border-white dark:border-slate-800 -ml-2">
          +{assignedMembers.length - 3}
        </div>
      )}
    </div>
  ) : (
    <div className="w-full h-full flex items-center text-slate-300 dark:text-slate-600">
      --
    </div>
  );

  return (
    <CellWrapper
      disabled={disabled}
      row={row}
      column={column}
      displayValue={displayElement}
      inputElement={(_isActive, setGridMode) => (
        <div className="w-full h-full flex items-center px-1 bg-white dark:bg-slate-900" onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}>
          <AssigneeSelect
            value={initialValue || ''}
            members={projectMembers}
            autoFocus={true}
            onChange={(newValue) => {
              if (updateMutation) {
                updateMutation.mutate({ id: row.original.id, updates: { [column.id]: newValue } });
              }
            }}
            onClose={() => setGridMode('navigate')}
          />
        </div>
      )}
    />
  );
}, (prev, next) => commonComparator(prev, next, false));
