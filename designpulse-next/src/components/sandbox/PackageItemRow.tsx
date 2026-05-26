'use client';


import { X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PackageItemMetric } from '@/hooks/useSandboxMetrics';

interface PackageItemRowProps {
  item: PackageItemMetric;
  canEdit: boolean;
  onRemove: () => void;
  onSetAssumedOption: (assumedOptionId: string | null) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  const str = abs >= 1000 ? `$${Math.round(abs / 1000)}K` : fmt(abs);
  return n < 0 ? `-${str}` : `+${str}`;
};

const STATUS_DOT: Record<string, string> = {
  Draft: 'bg-slate-400',
  'Pending Review': 'bg-amber-500',
  Approved: 'bg-emerald-500',
  Rejected: 'bg-rose-500',
};

export function PackageItemRow({ item, canEdit, onRemove, onSetAssumedOption }: PackageItemRowProps) {
  const delta = item.resolvedCostImpact - item.currentCostImpact;
  const showDelta = item.assumedOptionId != null && Math.abs(delta) > 0.01;

  return (
    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      {/* Line 1: ID + Title + Status + Remove */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-medium shrink-0">
          {item.displayId}
        </span>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1 min-w-0">
          {item.title}
        </span>
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[item.status] || 'bg-slate-400')} />
        {item.isStaleRef && (
          <AlertTriangle size={12} className="text-amber-500 shrink-0" />
        )}
        {canEdit && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shrink-0"
            title="Remove from package"
          >
            <X size={12} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Line 2: Contender Select + Cost + Delta */}
      <div className="flex items-center gap-1.5 mt-1 pl-0.5">
        {item.availableOptions.length > 0 ? (
          <select
            value={item.assumedOptionId ?? ''}
            onChange={(e) => onSetAssumedOption(e.target.value || null)}
            disabled={!canEdit}
            className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 max-w-[140px] truncate text-slate-600 dark:text-slate-300 disabled:opacity-60"
          >
            <option value="">— current —</option>
            {item.availableOptions.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.isLocked ? '🔒 ' : ''}{opt.title} ({fmt(opt.costImpact)})
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">(no contenders)</span>
        )}

        <span className="flex-1" />

        <span className={cn(
          'text-xs font-bold tabular-nums',
          item.resolvedCostImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
          item.resolvedCostImpact > 0 ? 'text-rose-600 dark:text-rose-400' :
          'text-slate-400 dark:text-slate-500'
        )}>
          {item.resolvedCostImpact > 0 ? '+' : ''}{fmt(item.resolvedCostImpact)}
        </span>

        {showDelta && (
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            delta < 0
              ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40'
              : 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-900/40'
          )}>
            Δ{fmtCompact(delta)}
          </span>
        )}
      </div>
    </div>
  );
}
