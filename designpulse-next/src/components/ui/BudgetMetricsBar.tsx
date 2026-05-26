'use client';

import { cn } from '@/lib/cn';
import type { BudgetMetrics } from '@/utils/financialMath';

// ============================================================================
// BudgetMetricsBar — Standalone presentational component for Scenario Planner
// ============================================================================
// DR-8: This is NOT extracted from BudgetSummary (which has 7 cards, 2 render
// modes, and a separate usePendingEstimateUpdates query). This is a new
// standalone component sharing only the BudgetMetrics data type.

interface BudgetMetricsBarProps {
  metrics: BudgetMetrics;
  originalBudget: number;
  label?: string;
  baseline?: BudgetMetrics;    // when provided, shows Δ arrows per metric
  compact?: boolean;           // single-row mode for scenario columns
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n));

const formatSigned = (n: number) => {
  if (isNaN(n)) return '$0';
  const formatted = fmt(n);
  if (n < 0) return `-${formatted}`;
  if (n > 0) return `+${formatted}`;
  return formatted;
};

interface KpiCardProps {
  label: string;
  value: string;
  colorClass: string;
  bgClass?: string;
  delta?: number;
  compact?: boolean;
  emphasized?: boolean;
}

function KpiCard({ label, value, colorClass, bgClass, delta, compact, emphasized }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        bgClass || 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
        emphasized && 'ring-1 ring-slate-900/5 dark:ring-white/5 border-2 border-slate-300 dark:border-slate-700'
      )}
    >
      <span
        className={cn(
          'font-medium block',
          compact ? 'text-[10px]' : 'text-xs',
          colorClass
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'font-bold block',
          compact ? 'text-sm' : 'text-lg',
          emphasized ? 'font-extrabold text-slate-900 dark:text-white' : colorClass
        )}
      >
        {value}
      </span>
      {delta !== undefined && delta !== 0 && (
        <span
          className={cn(
            'text-[10px] font-bold block mt-0.5',
            delta < 0 ? 'text-emerald-500' : 'text-rose-500'
          )}
        >
          {delta < 0 ? '↓' : '↑'} {formatSigned(delta)}
        </span>
      )}
    </div>
  );
}

export function BudgetMetricsBar({
  metrics,
  originalBudget,
  label,
  baseline,
  compact = false,
}: BudgetMetricsBarProps) {
  const cards: KpiCardProps[] = [
    {
      label: 'Original Budget',
      value: fmt(originalBudget),
      colorClass: 'text-slate-500 dark:text-slate-400',
    },
    {
      label: 'Approved Changes',
      value: formatSigned(metrics.approvedChanges),
      colorClass: 'text-emerald-600 dark:text-emerald-500',
      bgClass: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30',
      delta: baseline ? metrics.approvedChanges - baseline.approvedChanges : undefined,
    },
    {
      label: 'Pending Changes',
      value: formatSigned(metrics.pendingChanges),
      colorClass: metrics.pendingChanges < 0
        ? 'text-emerald-500'
        : metrics.pendingChanges > 0
        ? 'text-rose-500'
        : 'text-slate-500 dark:text-slate-400',
      delta: baseline ? metrics.pendingChanges - baseline.pendingChanges : undefined,
    },
    {
      label: 'Potential Exposure',
      value: formatSigned(metrics.potentialExposure),
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
      delta: baseline ? metrics.potentialExposure - baseline.potentialExposure : undefined,
    },
    {
      label: 'Revised Budget',
      value: fmt(metrics.revisedBudget),
      colorClass: 'text-sky-600 dark:text-sky-400',
      bgClass: 'bg-sky-50/50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800',
      delta: baseline ? metrics.revisedBudget - baseline.revisedBudget : undefined,
    },
    {
      label: 'Projected Budget',
      value: fmt(metrics.projectedBudget),
      colorClass: 'text-slate-700 dark:text-slate-300',
      emphasized: true,
      delta: baseline ? metrics.projectedBudget - baseline.projectedBudget : undefined,
    },
  ];

  return (
    <div>
      {label && (
        <h4
          className={cn(
            'font-bold uppercase tracking-wider mb-2',
            compact ? 'text-[9px] text-slate-400' : 'text-[10px] text-slate-500 dark:text-slate-400'
          )}
        >
          {label}
        </h4>
      )}
      <div
        className={cn(
          'grid gap-2',
          compact
            ? 'grid-cols-3'
            : 'grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-6'
        )}
      >
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} compact={compact} />
        ))}
      </div>
    </div>
  );
}
