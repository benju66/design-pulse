"use client";
import React from 'react';
import { CellContext } from '@tanstack/react-table';
import { FileText, MessageSquare } from 'lucide-react';
import { Opportunity, OpportunityOption } from '@/types/models';
import { formatCostCode } from '@/lib/formatCostCode';

const isZero = (v: number) => Math.abs(v) < 0.001;

const commonComparator = (prevProps: CellContext<Opportunity, unknown>, nextProps: CellContext<Opportunity, unknown>) => {
  if (prevProps.getValue() !== nextProps.getValue()) return false;
  if (prevProps.row.original !== nextProps.row.original) return false;
  return true;
};

const deltaCellComparator = (prevProps: CellContext<Opportunity, unknown>, nextProps: CellContext<Opportunity, unknown>) => {
  if (!commonComparator(prevProps, nextProps)) return false;
  
  const prevCode = prevProps.row.original?.cost_code;
  const nextCode = nextProps.row.original?.cost_code;
  
  if (prevCode !== nextCode) return false;
  if (!prevCode) return true;
  
  const prevNote = prevProps.table.options.meta?.varianceNoteMap?.[prevCode];
  const nextNote = nextProps.table.options.meta?.varianceNoteMap?.[prevCode];
  
  return prevNote === nextNote;
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
  if (value === 'Budget Line') colorClass = 'text-slate-500 dark:text-slate-400 font-medium';

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
  const lockedOption = options.find(o => o.is_locked);
  
  if (hasOptions && !lockedOption) {
    const fieldId = column.id as keyof Pick<OpportunityOption, 'cost_impact' | 'days_impact'>;
    const min = Math.min(...options.map(o => Number(o[fieldId]) || 0));
    const max = Math.max(...options.map(o => Number(o[fieldId]) || 0));
    
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
    return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600 justify-end">—</ReadOnlyWrapper>;
  }

  const numValue = Number(rawValue);

  if (isZero(numValue)) {
    return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600 justify-end">—</ReadOnlyWrapper>;
  }

  // Budget Ledger: de-emphasize VE row cost_impact to avoid visual
  // double-counting with the budget line's Approved Δ / Pending Δ columns.
  // Uses table.options.meta.isLedgerView (set at table init, never mutated inline — AGENTS.md C10).
  if (table.options.meta?.isLedgerView
      && !row.original.is_budget_line
      && column.id === 'cost_impact') {
    const display = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0,
    }).format(numValue);
    return (
      <ReadOnlyWrapper className="text-slate-400 dark:text-slate-500 justify-end tabular-nums italic">
        {display}
      </ReadOnlyWrapper>
    );
  }

  const colorClass = column.id === 'cost_impact' && numValue < 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 
                     column.id === 'cost_impact' && numValue > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : '';
                     
  const displayValue = column.id === 'cost_impact' 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(numValue) 
    : numValue.toString();

  return <ReadOnlyWrapper className={`${colorClass} justify-end tabular-nums`}>{displayValue}</ReadOnlyWrapper>;
}, (prev, next) => {
  if (prev.row.original !== next.row.original) return false;
  if (prev.table.options.meta?.isLedgerView !== next.table.options.meta?.isLedgerView) return false;
  return true;
});

export const CostCodeCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const code = row.original.cost_code;
  if (!code || code === 'Unassigned') return <ReadOnlyWrapper className="text-slate-400 italic">Unassigned</ReadOnlyWrapper>;
  
  const rawCostCodes = table.options.meta?.rawCostCodes || [];
  const matched = rawCostCodes.find(c => c.code === code);
  const displayValue = matched ? `${formatCostCode(matched.code)} - ${matched.description}` : formatCostCode(code);
  
  return <ReadOnlyWrapper title={displayValue}>{displayValue}</ReadOnlyWrapper>;
}, commonComparator);

export const CsiSpecCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const code = row.original.spec_number_id;
  if (!code) return <ReadOnlyWrapper className="text-slate-400 italic">--</ReadOnlyWrapper>;
  
  const csiSpecs = table.options.meta?.csiSpecs || [];
  const matched = csiSpecs.find(c => c.id === code);
  const displayValue = matched ? `${matched.csi_number} - ${matched.description}` : code;
  // Phase 7: Source lineage indicator
  const isCompanyDefault = matched?.source === 'company_default';
  
  return (
    <ReadOnlyWrapper title={displayValue}>
      <span className="flex items-center gap-1 min-w-0">
        <span className="truncate">{displayValue}</span>
        {isCompanyDefault && <span className="text-[10px] shrink-0" title="Company Default">🏢</span>}
      </span>
    </ReadOnlyWrapper>
  );
}, commonComparator);

export const DivisionCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const rawCostCodes = table.options.meta?.rawCostCodes ?? [];
  const costCode = row.original.cost_code;

  const derivedDivision = (() => {
    if (!costCode || rawCostCodes.length === 0) return null;
    const matched = rawCostCodes.find(c => c.code === costCode);
    if (!matched) return null;
    if (matched.parent_division) {
      const parentDiv = rawCostCodes.find(c => c.code === matched.parent_division && c.is_division);
      return parentDiv ? `${parentDiv.code} \u2013 ${parentDiv.description}` : null;
    }
    if (matched.is_division) {
      return `${matched.code} \u2013 ${matched.description}`;
    }
    return null;
  })();

  const storedDivision = row.original.division ?? null;
  const displayValue = derivedDivision ?? storedDivision;

  if (!displayValue) return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600">--</ReadOnlyWrapper>;

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
  const projectMembers = table.options.meta?.projectMembers ?? [];
  
  if (!value) return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600">--</ReadOnlyWrapper>;

  const emails = value.split(',').map(e => e.trim()).filter(Boolean);
  const assignedMembers = emails.map(email => {
    const matched = projectMembers.find(m => m.email === email || m.name === email);
    return {
      email: matched?.email || email,
      displayName: matched ? (matched.name || matched.email) : email
    };
  });

  if (assignedMembers.length === 0) return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600">--</ReadOnlyWrapper>;

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

// ── Aggregated Impact Cells (for group row rollups) ─────────────────────────
// ImpactCell accesses optionsMap which breaks for synthetic TanStack group rows.
// These dedicated cells render the aggregated sum with proper formatting.

export const CostImpactAggregatedCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const val = Number(getValue()) || 0;
  if (isZero(val)) {
    return <ReadOnlyWrapper className="justify-end tabular-nums font-bold text-slate-400 dark:text-slate-600">$0</ReadOnlyWrapper>;
  }
  const colorClass = val < 0 ? 'text-emerald-600 dark:text-emerald-400' 
                   : val > 0 ? 'text-rose-600 dark:text-rose-400' 
                   : '';
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  return <ReadOnlyWrapper className={`justify-end tabular-nums font-bold ${colorClass}`}>{formatted}</ReadOnlyWrapper>;
}, commonComparator);

export const DaysImpactAggregatedCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const val = Number(getValue()) || 0;
  if (isZero(val)) {
    return <ReadOnlyWrapper className="justify-end tabular-nums font-bold text-slate-400 dark:text-slate-600">0 days</ReadOnlyWrapper>;
  }
  return <ReadOnlyWrapper className="justify-end tabular-nums font-bold">{val} days</ReadOnlyWrapper>;
}, commonComparator);

// ── Ledger Financial Cells ───────────────────────────────────────────────────
// Used by the Budget Ledger hierarchical view. Show financial values for budget
// rows; render a dash for VE leaf rows. aggregatedCell variants render with
// bold weight for group row rollups.

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Neutral right-aligned currency — Baseline, Revised columns */
export const LedgerFinancialCell = React.memo(({ getValue, row }: CellContext<Opportunity, unknown>) => {
  const val = Number(getValue()) || 0;
  const baseline = Number(row.original.baseline_budget) || 0;
  if (!row.original.is_budget_line || (isZero(val) && isZero(baseline))) {
    return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600 justify-end">—</ReadOnlyWrapper>;
  }
  return <ReadOnlyWrapper className="justify-end tabular-nums text-slate-700 dark:text-slate-200">{currencyFmt.format(val)}</ReadOnlyWrapper>;
}, commonComparator);

/** Bold variant for aggregated group rows */
export const LedgerFinancialAggregatedCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const val = Number(getValue()) || 0;
  if (isZero(val)) {
    return <ReadOnlyWrapper className="justify-end tabular-nums font-bold text-slate-400 dark:text-slate-600">$0</ReadOnlyWrapper>;
  }
  return <ReadOnlyWrapper className="justify-end tabular-nums font-bold text-slate-800 dark:text-slate-100">{currencyFmt.format(val)}</ReadOnlyWrapper>;
}, commonComparator);

/** Delta cell — green for savings (negative), red for overruns (positive) */
export const LedgerDeltaCell = React.memo(({ getValue, row, table }: CellContext<Opportunity, unknown>) => {
  const val = Number(getValue()) || 0;
  const varianceNoteMap = table.options.meta?.varianceNoteMap;
  const noteText = varianceNoteMap
    ? varianceNoteMap[row.original.cost_code ?? ''] ?? null
    : null;

  if (!row.original.is_budget_line || (isZero(val) && !noteText)) {
    return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600 justify-end">—</ReadOnlyWrapper>;
  }

  const colorClass = val < 0
    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
    : val > 0
    ? 'text-rose-600 dark:text-rose-400 font-medium'
    : 'text-slate-400 dark:text-slate-600';

  return (
    <ReadOnlyWrapper className={`justify-end tabular-nums ${colorClass}`}>
      <span className="flex items-center gap-1">
        {isZero(val) ? '—' : (val >= 0 ? '+' : '') + currencyFmt.format(val)}
        {noteText && (
          <span title={noteText.length > 120 ? noteText.substring(0, 120) + '…' : noteText}>
            <MessageSquare
              size={12}
              className="shrink-0 text-sky-500 dark:text-sky-400"
            />
          </span>
        )}
      </span>
    </ReadOnlyWrapper>
  );
}, deltaCellComparator);

/** Bold aggregated delta for group rows */
export const LedgerDeltaAggregatedCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const val = Number(getValue()) || 0;
  if (isZero(val)) {
    return <ReadOnlyWrapper className="justify-end tabular-nums font-bold text-slate-400 dark:text-slate-600">$0</ReadOnlyWrapper>;
  }
  const colorClass = val < 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : val > 0
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-500 dark:text-slate-400';
  return <ReadOnlyWrapper className={`justify-end tabular-nums font-bold ${colorClass}`}>{(val >= 0 ? '+' : '') + currencyFmt.format(val)}</ReadOnlyWrapper>;
}, commonComparator);

/** Projected final — shows variance chip vs baseline on hover */
export const LedgerProjectedCell = React.memo(function LedgerProjectedCell({ getValue, row }: CellContext<Opportunity, unknown>) {
  const val = Number(getValue()) || 0;
  const baseline = Number(row.original.baseline_budget) || 0;
  if (!row.original.is_budget_line || (isZero(val) && isZero(baseline))) {
    return <ReadOnlyWrapper className="text-slate-400 dark:text-slate-600 justify-end">—</ReadOnlyWrapper>;
  }
  
  const variance = val - baseline;
  const varColor = variance < 0
    ? 'text-emerald-500 dark:text-emerald-400'
    : variance > 0
    ? 'text-rose-500 dark:text-rose-400'
    : 'text-slate-400';
  return (
    <div className="w-full h-full px-3 py-2 text-sm min-h-[28px] flex items-center justify-end gap-2 group relative">
      <span className="tabular-nums text-slate-700 dark:text-slate-200">{currencyFmt.format(val)}</span>
      {!isZero(variance) && (
        <span className={`text-[10px] font-medium tabular-nums ${varColor} hidden group-hover:inline-block`}>
          ({(variance >= 0 ? '+' : '') + currencyFmt.format(variance)})
        </span>
      )}
    </div>
  );
}, commonComparator);

/** Bold aggregated projected for group rows */
export const LedgerProjectedAggregatedCell = React.memo(({ getValue }: CellContext<Opportunity, unknown>) => {
  const val = Number(getValue()) || 0;
  if (isZero(val)) {
    return <ReadOnlyWrapper className="justify-end tabular-nums font-bold text-slate-400 dark:text-slate-600">$0</ReadOnlyWrapper>;
  }
  return <ReadOnlyWrapper className="justify-end tabular-nums font-bold text-slate-800 dark:text-slate-100">{currencyFmt.format(val)}</ReadOnlyWrapper>;
}, commonComparator);

// ── Phase 2: Compound Cells (Ledger-only) ────────────────────────────────────

/** Item Definition — merges display_id + title + building_area + assumption icon */
export const ItemDefinitionCell = React.memo(({ row }: CellContext<Opportunity, unknown>) => {
  const title = row.original.title || '';
  const displayId = row.original.display_id || '';
  const area = row.original.building_area || '';
  const assumptions = row.original.item_assumptions;
  return (
    <div className="w-full h-full px-3 py-2 min-h-[36px] flex flex-col justify-center gap-0.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</span>
        {assumptions && assumptions.trim().length > 0 && (
          <span title={assumptions.length > 120 ? assumptions.substring(0, 120) + '…' : assumptions}>
            <FileText
              size={13}
              className="shrink-0 text-amber-500 dark:text-amber-400"
            />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
          row.original.is_budget_line
            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300'
        }`}>
          {row.original.is_budget_line ? 'BL' : 'VE'}
        </span>
        {displayId && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{displayId}</span>
        )}
        {area && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">{area}</span>
        )}
      </div>
    </div>
  );
}, commonComparator);

/** Cost Classification — merges cost_code + division + spec_number_id */
export const CostClassificationCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const code = row.original.cost_code;
  const specId = row.original.spec_number_id;
  const rawCostCodes = table.options.meta?.rawCostCodes ?? [];
  const csiSpecs = table.options.meta?.csiSpecs ?? [];
  const codeDisplay = code ? formatCostCode(code) : null;
  const matched = code ? (rawCostCodes as Array<{ code: string; description?: string; is_division?: boolean | null; parent_division?: string | null }>).find(c => c.code === code) : null;
  const codeLabel = matched?.description ? `${codeDisplay} – ${matched.description}` : codeDisplay;
  const divisionLabel = (() => {
    if (!matched) return null;
    if (matched.parent_division) {
      const div = (rawCostCodes as Array<{ code: string; description?: string; is_division?: boolean | null }>).find(c => c.code === matched.parent_division && c.is_division);
      return div ? `Div ${div.code.substring(0, 2)} – ${div.description}` : null;
    }
    return matched.is_division ? `Div ${matched.code.substring(0, 2)} – ${matched.description}` : null;
  })();
  const specMatch = specId ? (csiSpecs as Array<{ id: string; csi_number: string }>).find(c => c.id === specId) : null;
  return (
    <div className="w-full h-full px-3 py-2 min-h-[36px] flex flex-col justify-center gap-0.5" title={codeLabel || ''}>
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums truncate">
        {codeLabel || <span className="text-slate-400 italic">Unassigned</span>}
      </span>
      {(divisionLabel || specMatch) && (
        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
          {divisionLabel}{divisionLabel && specMatch ? ' • ' : ''}{specMatch ? specMatch.csi_number : ''}
        </span>
      )}
    </div>
  );
}, commonComparator);

/** Management — merges assignee + priority + due_date */
export const ManagementCell = React.memo(({ row, table }: CellContext<Opportunity, unknown>) => {
  const assigneeRaw = row.original.assignee;
  const priority = row.original.priority;
  const dueDate = row.original.due_date;
  const projectMembers = (table.options.meta?.projectMembers ?? []) as Array<{ email: string; name: string | null }>;
  const priorityDot: Record<string, string> = { Critical: 'bg-rose-500', High: 'bg-amber-500', Medium: 'bg-sky-500', Low: 'bg-slate-400' };
  const avatars = assigneeRaw ? assigneeRaw.split(',').map(e => e.trim()).filter(Boolean).slice(0, 2) : [];
  return (
    <div className="w-full h-full px-3 py-2 min-h-[36px] flex items-center gap-2">
      <div className="flex -space-x-1.5 shrink-0">
        {avatars.map((email, i) => {
          const m = projectMembers.find(pm => pm.email === email);
          const initials = (m?.name || email).substring(0, 2).toUpperCase();
          return (
            <div key={i} className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm border border-white dark:border-slate-800">
              {initials}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[priority || ''] || 'bg-slate-300'}`} />
          <span className="text-[11px] text-slate-600 dark:text-slate-400">{priority || '—'}</span>
        </div>
        {dueDate && <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">{dueDate}</span>}
      </div>
    </div>
  );
}, commonComparator);
