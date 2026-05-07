"use client";
import React from 'react';
import { CellContext } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';
import { formatCostCode } from '@/lib/formatCostCode';

const commonComparator = (prevProps: CellContext<Opportunity, unknown>, nextProps: CellContext<Opportunity, unknown>) => {
  if (prevProps.getValue() !== nextProps.getValue()) return false;
  if (prevProps.row.original !== nextProps.row.original) return false;
  return true;
};

// --- BASE WRAPPER ---
interface CellWrapperProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const ReadOnlyWrapper = ({ children, className, title }: CellWrapperProps) => (
  <div 
    title={title}
    className={`w-full h-full px-3 py-2 text-sm min-h-[28px] truncate flex items-center ${className || 'text-slate-900 dark:text-slate-100'}`}
  >
    {children}
  </div>
);

// --- CELLS ---

export const TextCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const value = (getValue() as string) || '';
  return <ReadOnlyWrapper title={value}>{value}</ReadOnlyWrapper>;
}, commonComparator);

export const StatusCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const value = (getValue() as string) || 'Draft';
  
  let colorClass = 'text-slate-600 dark:text-slate-400';
  if (value === 'Approved') colorClass = 'text-emerald-600 dark:text-emerald-400 font-medium';
  if (value === 'Pending Review') colorClass = 'text-sky-600 dark:text-sky-400 font-medium';
  if (value === 'Rejected') colorClass = 'text-rose-600 dark:text-rose-400';

  return <ReadOnlyWrapper className={colorClass}>{value}</ReadOnlyWrapper>;
}, commonComparator);

export const CoordinationStatusCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const value = (getValue() as string) || 'Not Required';
  return <ReadOnlyWrapper>{value}</ReadOnlyWrapper>;
}, commonComparator);

export const BuildingAreaCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const value = (getValue() as string) || '--';
  return <ReadOnlyWrapper className={!getValue() ? 'text-slate-400 italic' : ''}>{value}</ReadOnlyWrapper>;
}, commonComparator);

export const PriorityCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const value = (getValue() as string) || 'Set Priority';
  
  const priorityColors: Record<string, string> = {
    'Critical': 'text-rose-600 dark:text-rose-400 font-bold',
    'High': 'text-amber-600 dark:text-amber-400 font-semibold',
    'Medium': 'text-sky-600 dark:text-sky-400 font-medium',
    'Low': 'text-slate-500 dark:text-slate-400',
    'Set Priority': 'text-slate-400 italic'
  };

  return <ReadOnlyWrapper className={priorityColors[value]}>{value}</ReadOnlyWrapper>;
}, commonComparator);

export const ImpactCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const rawValue = getValue() as number | string | null | undefined;
  
  // Handle Option ranges for parent rows that aren't locked
  const optionsMap = table.options.meta?.optionsMap || {};
  const options = optionsMap[row.original.id] || [];
  const hasOptions = options.length > 0;
  const lockedOption = options.find((o: any) => o.is_locked);
  
  if (hasOptions && !lockedOption) {
    const min = Math.min(...options.map((o: any) => Number(o[column.id]) || 0));
    const max = Math.max(...options.map((o: any) => Number(o[column.id]) || 0));
    
    const formatVal = (v: number) => column.id === 'cost_impact' 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
      : `${v} days`;

    return (
      <ReadOnlyWrapper className="italic text-slate-400 dark:text-slate-500 justify-end">
        {min === max ? formatVal(min) : `${formatVal(min)} to ${formatVal(max)}`}
      </ReadOnlyWrapper>
    );
  }

  // Handle standard scalar values
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return <ReadOnlyWrapper className="justify-end">--</ReadOnlyWrapper>;
  }

  const numValue = Number(rawValue);
  const colorClass = column.id === 'cost_impact' && numValue < 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 
                     column.id === 'cost_impact' && numValue > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : '';
                     
  const displayValue = column.id === 'cost_impact' 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(numValue) 
    : numValue.toString();

  return <ReadOnlyWrapper className={`${colorClass} justify-end`}>{displayValue}</ReadOnlyWrapper>;
}, (prev, next) => {
  if (prev.row.original !== next.row.original) return false;
  return true;
});

export const CostCodeCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const code = row.original.cost_code;
  if (!code || code === 'Unassigned') return <ReadOnlyWrapper className="text-slate-400 italic">Unassigned</ReadOnlyWrapper>;
  
  const rawCostCodes = table.options.meta?.rawCostCodes || [];
  const matched = rawCostCodes.find((c: any) => c.code === code);
  const displayValue = matched ? `${formatCostCode(matched.code)} - ${matched.description}` : formatCostCode(code);
  
  return <ReadOnlyWrapper title={displayValue}>{displayValue}</ReadOnlyWrapper>;
}, commonComparator);

export const CsiSpecCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const code = row.original.spec_number_id;
  if (!code) return <ReadOnlyWrapper className="text-slate-400 italic">--</ReadOnlyWrapper>;
  
  const csiSpecs = table.options.meta?.csiSpecs || [];
  const matched = csiSpecs.find((c: any) => c.id === code);
  const displayValue = matched ? `${matched.csi_number} - ${matched.description}` : code;
  
  return <ReadOnlyWrapper title={displayValue}>{displayValue}</ReadOnlyWrapper>;
}, commonComparator);

export const DivisionCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const rawCostCodes = table.options.meta?.rawCostCodes ?? [];
  const costCode = row.original.cost_code;

  const derivedDivision = (() => {
    if (!costCode || rawCostCodes.length === 0) return null;
    const matched = rawCostCodes.find((c: any) => c.code === costCode);
    if (!matched) return null;
    if (matched.parent_division) {
      const parentDiv = rawCostCodes.find((c: any) => c.code === matched.parent_division && c.is_division);
      return parentDiv ? `${parentDiv.code} \u2013 ${parentDiv.description}` : null;
    }
    if (matched.is_division) {
      return `${matched.code} \u2013 ${matched.description}`;
    }
    return null;
  })();

  const storedDivision = row.original.division ?? null;
  const displayValue = derivedDivision ?? storedDivision;

  if (!displayValue) return <ReadOnlyWrapper className="text-slate-300 dark:text-slate-600">--</ReadOnlyWrapper>;

  return (
    <ReadOnlyWrapper title={displayValue} className={derivedDivision ? 'font-medium text-slate-700 dark:text-slate-200' : 'italic text-slate-400 dark:text-slate-500'}>
      {displayValue}
    </ReadOnlyWrapper>
  );
}, (prev, next) => prev.row.original.cost_code === next.row.original.cost_code && prev.row.original.division === next.row.original.division);

export const DisplayIdCell = React.memo(({ getValue, row }: CellContext<Opportunity, unknown>) => {
  const value = getValue() as string | null | undefined;
  const recordType = row.original.record_type;

  if (recordType === 'Coordination') {
    return (
      <ReadOnlyWrapper>
        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title="Escalated from Design Coordination">
          {value || ''}
        </span>
      </ReadOnlyWrapper>
    );
  }

  return <ReadOnlyWrapper className="text-slate-600 dark:text-slate-400 font-mono">{value || ''}</ReadOnlyWrapper>;
}, commonComparator);

export const AssigneeCell = React.memo(({ getValue, table }: CellContext<Opportunity, unknown>) => {
  const value = getValue() as string | null | undefined;
  const projectMembers = (table.options.meta as any)?.projectMembers || [];
  
  if (!value) return <ReadOnlyWrapper className="text-slate-300 dark:text-slate-600">--</ReadOnlyWrapper>;

  const emails = value.split(',').map(e => e.trim()).filter(Boolean);
  const assignedMembers = emails.map(email => {
    const matched = projectMembers.find((m: any) => m.email === email || m.name === email);
    return {
      email: matched?.email || email,
      displayName: matched ? (matched.name || matched.email) : email
    };
  });

  if (assignedMembers.length === 0) return <ReadOnlyWrapper className="text-slate-300 dark:text-slate-600">--</ReadOnlyWrapper>;

  const tooltipTitle = assignedMembers.map(m => `${m.displayName}${m.email && m.email !== m.displayName ? `\n${m.email}` : ''}`).join('\n\n');

  return (
    <ReadOnlyWrapper title={tooltipTitle}>
      <div className="flex items-center w-full h-full overflow-hidden gap-1">
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
    </ReadOnlyWrapper>
  );
}, commonComparator);
