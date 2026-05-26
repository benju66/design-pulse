'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { X, ChevronDown, ChevronRight, Package } from 'lucide-react';
import type { VePackageWithItems } from '@/types/sandbox';

interface ScenarioPackageCellProps {
  pkg: VePackageWithItems;
  scopeLabel?: string;
  onRemove?: () => void;
  canEdit: boolean;
  allOpportunities: Array<{ id: string; title: string; display_id?: string | null }>;
  allOptions: Array<{ id: string; opportunity_id: string; option_label: string | null; cost_impact: number | null }>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export function ScenarioPackageCell({
  pkg,
  scopeLabel,
  onRemove,
  canEdit,
  allOpportunities,
  allOptions,
}: ScenarioPackageCellProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate net impact for this package
  const netImpact = pkg.items.reduce((sum, item) => {
    if (!item.assumed_option_id) return sum;
    const opt = allOptions.find(o => o.id === item.assumed_option_id);
    return sum + (Number(opt?.cost_impact) || 0);
  }, 0);

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        'bg-white dark:bg-slate-900/60',
        'border-slate-200 dark:border-slate-800',
        'hover:shadow-sm',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Color bar */}
        <div
          className="w-1 h-8 rounded-full shrink-0"
          style={{ backgroundColor: `var(--color-${pkg.color}-500, #8b5cf6)` }}
        />

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <Chevron size={14} />
        </button>

        {/* Package name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Package size={12} className="text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
              {pkg.name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">
              {pkg.items.length} item{pkg.items.length !== 1 ? 's' : ''}
            </span>
            {scopeLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {scopeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Net impact */}
        <span
          className={cn(
            'text-xs font-semibold shrink-0',
            netImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
            netImpact > 0 ? 'text-rose-600 dark:text-rose-400' :
            'text-slate-400'
          )}
        >
          {netImpact !== 0 ? (netImpact > 0 ? '+' : '') + fmt(netImpact) : '$0'}
        </span>

        {/* Remove button */}
        {canEdit && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors p-0.5"
            title="Remove from scenario"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Expanded: item list */}
      {expanded && pkg.items.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 space-y-1">
          {pkg.items.map(item => {
            const opp = allOpportunities.find(o => o.id === item.opportunity_id);
            const opt = item.assumed_option_id ? allOptions.find(o => o.id === item.assumed_option_id) : null;
            return (
              <div key={item.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400 font-mono shrink-0">{opp?.display_id || '—'}</span>
                <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{opp?.title || 'Unknown'}</span>
                {opt && (
                  <span className="text-sky-600 dark:text-sky-400 shrink-0 truncate max-w-[100px]">
                    → {opt.option_label || 'Option'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
