"use client";
import React from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { BudgetMetrics } from '@/utils/financialMath';

// ── Types ────────────────────────────────────────────────────────────────────
interface BudgetHealthStripProps {
  originalBudget: number;
  /** Active estimate version's total_budget — the current working budget. */
  revisedBudget: number;
  metrics: BudgetMetrics;
  pendingIncorporationCount: number;
  pendingIncorporationValue: number;
}

interface KpiCardData {
  label: string;
  value: number;
  colorClass: string;
  tooltip: string;
  forcePlus?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (val: number, forcePlus = false): string => {
  if (isNaN(val)) return '$0';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.abs(val));
  if (val < 0) return `-${formatted}`;
  if (val > 0 && forcePlus) return `+${formatted}`;
  return formatted;
};

// ── Component ────────────────────────────────────────────────────────────────
export const BudgetHealthStrip = React.memo(function BudgetHealthStrip({
  originalBudget,
  revisedBudget,
  metrics,
  pendingIncorporationCount,
  pendingIncorporationValue,
}: BudgetHealthStripProps) {
  // Projected = Revised Budget + Pending Changes (forecast at completion)
  const projectedBudget = revisedBudget + metrics.pendingChanges;

  const cards: KpiCardData[] = [
    {
      label: 'Original Budget',
      value: originalBudget,
      colorClass: 'text-slate-900 dark:text-white',
      tooltip: 'The baseline financial target (GMP / initial contract value) established at the start of the phase.',
    },
    {
      label: 'Approved Changes',
      value: metrics.approvedChanges,
      colorClass: metrics.approvedChanges < 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : metrics.approvedChanges > 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-slate-900 dark:text-white',
      tooltip: 'Total sum of all fully approved or locked VE items and alternates.',
      forcePlus: true,
    },
    {
      label: 'Pending Changes',
      value: metrics.pendingChanges,
      colorClass: metrics.pendingChanges < 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : metrics.pendingChanges > 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-slate-900 dark:text-white',
      tooltip: 'Items under review — worst-case cost per option when multiple contenders exist.',
      forcePlus: true,
    },
    {
      label: 'Potential Exposure',
      value: metrics.potentialExposure,
      colorClass: 'text-amber-600 dark:text-amber-400',
      tooltip: 'Worst-case cost of unresolved Draft items — max of options per opportunity.',
      forcePlus: true,
    },
    {
      label: 'Revised Budget',
      value: revisedBudget,
      colorClass: 'text-sky-600 dark:text-sky-400',
      tooltip: 'Current working budget from the latest active estimate version. Includes incorporated VE items, buyout results, and scope changes.',
    },
    {
      label: 'Projected Budget',
      value: projectedBudget,
      colorClass: 'text-slate-900 dark:text-white font-extrabold',
      tooltip: 'Revised Budget + Pending Changes — your best-estimate forecast at completion.',
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const Icon = card.value < 0 ? TrendingDown : card.value > 0 ? TrendingUp : Minus;
          return (
            <div
              key={card.label}
              className="relative group flex flex-col gap-1.5"
            >
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <div className="flex items-center gap-2">
                {card.forcePlus && card.value !== 0 && (
                  <Icon
                    size={14}
                    className={card.value < 0 ? 'text-emerald-500' : 'text-rose-500'}
                  />
                )}
                <span className={`text-lg font-bold tabular-nums ${card.colorClass}`}>
                  {formatCurrency(card.value, card.forcePlus)}
                </span>
              </div>
              {/* Zero-JS Tooltip */}
              <div className="absolute bottom-full mb-2 left-0 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[100] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none p-3">
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  {card.label}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                  {card.tooltip}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Incorporation Sub-KPI */}
      {pendingIncorporationCount > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {pendingIncorporationCount} item{pendingIncorporationCount !== 1 ? 's' : ''}{' '}
            ({formatCurrency(pendingIncorporationValue, true)}) awaiting estimate incorporation
          </span>
        </div>
      )}
    </div>
  );
});
