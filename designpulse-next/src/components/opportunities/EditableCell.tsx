"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { useParams } from 'next/navigation';
import { useUIStore } from '@/stores/useUIStore';
import { CellContext, Row, Column } from '@tanstack/react-table';
import { Opportunity, CostType, CostCode, ProjectCsiSpec } from '@/types/models';
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

{/* eslint-disable-next-line react/display-name */}
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

{/* eslint-disable-next-line react/display-name */}
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
      <option value="Draft">Draft</option>
      <option value="In Drafting">In Drafting</option>
      <option value="Pending Plan Update">Pending Plan Update</option>
      <option value="Ready for Review">Ready for Review</option>
      <option value="Implemented">Implemented</option>
      <option value="Not Applicable">Not Applicable</option>
    </select>
  );
}, (prev, next) => commonComparator(prev, next, false));

{/* eslint-disable-next-line react/display-name */}
export const BuildingAreaCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const params = useParams();
  const projectId = params?.projectId as string | null;
  // [C-6 FIX] If the parent table passed buildingAreas via meta (e.g. CoordinationTable),
  // skip useProjectSettings entirely. Passing null disables the TanStack Query fetch.
  const metaBuildingAreas = (table.options.meta as any)?.buildingAreas as string[] | undefined;
  const { data: settings } = useProjectSettings(metaBuildingAreas ? null : projectId);
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const buildingAreas = metaBuildingAreas || (settings?.building_areas as string[]) || ['Corridor / Common', 'Unit Interiors', 'Back of House'];
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

{/* eslint-disable-next-line react/display-name */}
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

// DivisionCell — Option A: Pure derived read-only display (no mutation, no onBlur).
//
// Division is deterministically derived from the row's cost_code at render time:
//   cost_code → rawCostCodes.find() → parent_division → rawCostCodes.find(is_division)
//
// Falls back gracefully to the stored `row.original.division` string for legacy rows
// or codes that have no parent_division mapping (e.g., unmapped custom codes).
//
// Rules satisfied:
//   C1  — no any casts; rawCostCodes from typed global TableMeta
//   C10 — memo comparator only compares row.original fields, never meta
//   C23 — no onBlur pattern; this cell never fires a mutation
// eslint-disable-next-line react/display-name
export const DivisionCell = React.memo(
  ({ row, table }: CellContext<Opportunity, unknown>) => {
    // Typed access via global TableMeta — Rule C1
    const rawCostCodes = table.options.meta?.rawCostCodes ?? [];
    const costCode = row.original.cost_code;

    // Compute division purely from cost_code → parent_division lookup.
    // iOS-safe: no negative lookbehind, no regex — simple array finds.
    const derivedDivision = (() => {
      if (!costCode || rawCostCodes.length === 0) return null;
      // Find the matching row regardless of is_division flag.
      const matched = rawCostCodes.find(c => c.code === costCode);
      if (!matched) return null;
      if (matched.parent_division) {
        // Regular child code: look up its division header.
        const parentDiv = rawCostCodes.find(
          c => c.code === matched.parent_division && c.is_division
        );
        return parentDiv ? `${parentDiv.code} \u2013 ${parentDiv.description}` : null;
      }
      if (matched.is_division) {
        // Division-level code used directly (e.g. 260000 - Electrical).
        return `${matched.code} \u2013 ${matched.description}`;
      }
      return null;
    })();

    // Fallback: show stored division string for legacy rows / unmapped codes.
    const storedDivision = row.original.division ?? null;
    const displayValue = derivedDivision ?? storedDivision;

    return (
      <div className="w-full h-full px-2 py-1 flex items-center min-h-[28px]">
        {displayValue ? (
          <span
            title={displayValue}
            className={`text-xs truncate block w-full ${
              derivedDivision
                ? 'font-medium text-slate-700 dark:text-slate-200'
                : 'italic text-slate-400 dark:text-slate-500'
            }`}
          >
            {displayValue}
          </span>
        ) : (
          <span className="text-xs text-slate-300 dark:text-slate-600 select-none">—</span>
        )}
      </div>
    );
  },
  // Rule C10: memo comparator never inspects meta — only stable row.original fields
  (prev, next) =>
    prev.row.original.cost_code === next.row.original.cost_code &&
    prev.row.original.division  === next.row.original.division
);

import { SmartCostCodeCombobox } from '@/components/ui/SmartCostCodeCombobox';

{/* eslint-disable-next-line react/display-name */}
export const CostCodeCell = React.memo(({ getValue, row, table }: CellContext<Opportunity, unknown>) => {
  const initialCode    = getValue() as string | null | undefined;
  const initialCostType = row.original.cost_type as CostType | null | undefined;
  const initialSpecNumberId = row.original.spec_number_id as string | null | undefined;

  const updateMutation = table.options.meta?.updateData;
  const rawCostCodes   = table.options.meta?.rawCostCodes || [];
  const csiSpecs       = table.options.meta?.csiSpecs || [];
  const permissions    = table.options.meta?.permissions || { can_edit_records: false };
  
  // Bottom-Up Locking: Disable if a granular CSI Spec is assigned
  const disabled = !permissions.can_edit_records || !!initialSpecNumberId;

  const handleChange = (updates: { cost_code?: string; division?: string; cost_type?: string; spec_number_id?: string | null }) => {
    if (updateMutation) {
      updateMutation.mutate({ id: row.original.id, updates: updates as Partial<Opportunity> });
    }
  };

  return (
    <SmartCostCodeCombobox
      mode="cost_code_only"
      value={initialCode}
      costType={initialCostType}
      specNumberId={initialSpecNumberId}
      onChange={handleChange as any}
      rawCostCodes={rawCostCodes as CostCode[]}
      csiSpecs={csiSpecs as ProjectCsiSpec[]}
      disabled={disabled}
      showCostTypeSegment={false} // Cost type belongs in Detail Panel, not the dense grid cell
    />
  );
}, (prev, next) => prev.row.original === next.row.original);

{/* eslint-disable-next-line react/display-name */}
export const CsiSpecCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const initialCode    = row.original.cost_code as string | null | undefined;
  const initialSpecNumberId = row.original.spec_number_id as string | null | undefined;

  const updateMutation = table.options.meta?.updateData;
  const rawCostCodes   = table.options.meta?.rawCostCodes || [];
  const csiSpecs       = table.options.meta?.csiSpecs || [];
  const permissions    = table.options.meta?.permissions || { can_edit_records: false };
  const disabled       = !permissions.can_edit_records;

  // Phase 7: Derive source from the matched spec for lineage indicator
  const matchedSpec = initialSpecNumberId ? csiSpecs.find(s => s.id === initialSpecNumberId) : null;
  const isCompanyDefault = matchedSpec?.source === 'company_default';

  const handleChange = (updates: { cost_code?: string; division?: string; cost_type?: string; spec_number_id?: string | null }) => {
    if (updateMutation) {
      updateMutation.mutate({ id: row.original.id, updates: updates as Partial<Opportunity> });
    }
  };

  return (
    <div className="relative w-full h-full group">
      <SmartCostCodeCombobox
        mode="csi_spec_only"
        value={initialCode}
        specNumberId={initialSpecNumberId}
        onChange={handleChange as any}
        rawCostCodes={rawCostCodes as CostCode[]}
        csiSpecs={csiSpecs as ProjectCsiSpec[]}
        disabled={disabled}
        showCostTypeSegment={false} // Architectural focus
      />
      {/* Phase 7: Company Default source indicator */}
      {isCompanyDefault && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="text-[10px] text-amber-600 dark:text-amber-400" title="Company Default">🏢</span>
        </div>
      )}
    </div>
  );
}, (prev, next) => prev.row.original === next.row.original);


export const DisplayIdCell = React.memo(({ getValue, row, column }: CellContext<Opportunity, unknown>) => {
  const value = getValue() as string | null | undefined;
  const recordType = row.original.record_type;
  const displayValue = value || '';

  const badgeClass = recordType === 'Coordination'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800';

  const titleText = recordType === 'Coordination'
    ? 'Design Coordination item'
    : 'Value Engineering item';

  return (
    <CellWrapper
      disabled={true}
      row={row}
      column={column}
      className="w-full h-full flex items-center cursor-default"
      displayValue={
        <span 
          className={`px-1.5 py-0.5 rounded text-xs font-bold ${badgeClass}`}
          title={titleText}
        >
          {displayValue}
        </span>
      }
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

export const EstimateSyncStatusCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const value = getValue() as string | null | undefined;
  if (!value) return <div className="w-full h-full" />;

  let badgeClass = '';
  if (value === 'Draft') {
    badgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  } else if (value === 'Pending Estimate Update') {
    badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  } else if (value === 'Incorporated') {
    badgeClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  }

  return (
    <div className="w-full h-full px-2 py-1 flex items-center justify-center min-h-[28px]">
      {badgeClass ? (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap ${badgeClass}`}>
          {value === 'Pending Estimate Update' ? 'Pending Update' : value}
        </span>
      ) : (
        <span className="text-xs text-slate-500">{value}</span>
      )}
    </div>
  );
}, (prev, next) => prev.getValue() === next.getValue());

EstimateSyncStatusCell.displayName = 'EstimateSyncStatusCell';

