"use client";
/**
 * VarianceWaterfallChart — Horizontal bar chart showing per-trade budget variance.
 *
 * Fix F2: Refactored to receive data via props — NO internal useProjectBudgetWaterfall
 * hook call. Parent BudgetSummaryV2 already has the data (AGENTS.md C24).
 *
 * Layered Context: filteredCostCodes dims non-matching rows.
 */
import { useMemo } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { useChartTooltip } from '@/hooks/useChartTooltip';
import { formatCostCode } from '@/lib/formatCostCode';
import type { BudgetWaterfallRow } from '@/types/models';

interface Props {
  rows: BudgetWaterfallRow[];
  filteredCostCodes?: string[];
  isLoading?: boolean;
}

interface TipData {
  label: string;
  base: number;
  locked: number;
  pending: number;
  projected: number;
}

const fmtC = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

export default function VarianceWaterfallChart({ rows: rawRows, filteredCostCodes, isLoading }: Props) {
  const { state: tip, handlers } = useChartTooltip<TipData>();

  const isFiltered = filteredCostCodes && filteredCostCodes.length > 0;
  const filteredSet = isFiltered ? new Set(filteredCostCodes) : null;

  // Filter to rows with variance, optionally constrained by cost code filter
  const rows = useMemo(() => {
    let filtered = rawRows.filter(r => (Number(r.ve_impact) !== 0 || Number(r.pending_impact) !== 0));
    if (filteredSet) {
      filtered = filtered.filter(r => filteredSet.has(r.cost_code));
    }
    return filtered.sort((a, b) => {
      const netA = Number(a.ve_impact) + Number(a.pending_impact);
      const netB = Number(b.ve_impact) + Number(b.pending_impact);
      return netA - netB;
    });
  }, [rawRows, filteredSet]);

  const maxProjectedBudget = useMemo(() => {
    if (rows.length === 0) return 1;
    return Math.max(1, ...rows.map(r => {
      const base = Number(r.budget_amount) || 0;
      const locked = Number(r.ve_impact) || 0;
      const pending = Number(r.pending_impact) || 0;
      return Math.max(base, base + locked, base + locked + pending);
    }));
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex w-full h-48 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-5xl mx-auto pt-2">
      {/* Filter chip */}
      {isFiltered && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 px-4">
          Showing {rows.length} of {rawRows.filter(r => Number(r.ve_impact) !== 0 || Number(r.pending_impact) !== 0).length} trades with variance
        </div>
      )}

      <div className="flex text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-4">
        <div className="w-[25%]">Trade / Division</div>
        <div className="w-[45%] text-center">Financial Scale (Base vs Variance)</div>
        <div className="w-[30%] flex justify-between pl-4">
          <span className="w-1/3 text-right">Base</span>
          <span className="w-1/3 text-right">Net Var</span>
          <span className="w-1/3 text-right">Revised</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 relative z-10 mt-2">
        {rows.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-4">No active variances to display for this budget.</div>
        )}
        {rows.map((row) => {
          const base = Number(row.budget_amount) || 0;
          const locked = Number(row.ve_impact) || 0;
          const pending = Number(row.pending_impact) || 0;
          const net = locked + pending;

          const baseWidthPct = (base / maxProjectedBudget) * 100;
          const lockedStart = locked >= 0 ? base : base + locked;
          const lockedWidthPct = (Math.abs(locked) / maxProjectedBudget) * 100;
          const lockedLeftPct = (lockedStart / maxProjectedBudget) * 100;
          const pendingStart = pending >= 0 ? base + locked : base + locked + pending;
          const pendingWidthPct = (Math.abs(pending) / maxProjectedBudget) * 100;
          const pendingLeftPct = (pendingStart / maxProjectedBudget) * 100;

          const displayName = row.cost_code === 'Unassigned'
            ? 'Unassigned'
            : `${formatCostCode(row.cost_code)} - ${row.description}`;

          return (
            <div
              key={row.cost_code}
              className="flex items-center w-full group relative px-4"
              onMouseMove={(e) => handlers.onMouseMove(e, {
                label: displayName,
                base, locked, pending,
                projected: base + net,
              })}
              onMouseLeave={handlers.onMouseLeave}
            >
              {/* Label */}
              <div className="w-[25%] pr-4 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate" title={displayName}>
                {displayName}
              </div>

              {/* Bars container */}
              <div className="w-[45%] relative h-6 rounded flex items-center border-l border-slate-300 dark:border-slate-700">
                <div
                  className="absolute h-full rounded-md bg-slate-200 dark:bg-slate-700/60 z-10 transition-all duration-500 ease-out"
                  style={{ left: '0%', width: `${baseWidthPct}%` }}
                />
                {locked !== 0 && (
                  <div
                    className={`absolute h-full rounded-md transition-all duration-500 ease-out z-20 ${locked < 0 ? 'bg-emerald-500 group-hover:bg-emerald-400 opacity-90' : 'bg-rose-500 group-hover:bg-rose-400'}`}
                    style={{ left: `${lockedLeftPct}%`, width: `${lockedWidthPct}%` }}
                  />
                )}
                {pending !== 0 && (
                  <div
                    className={`absolute h-full rounded-md transition-all duration-500 ease-out z-30 opacity-60 ${pending < 0 ? 'bg-emerald-300 dark:bg-emerald-600' : 'bg-rose-300 dark:bg-rose-600'} flex items-center overflow-hidden`}
                    style={{ left: `${pendingLeftPct}%`, width: `${pendingWidthPct}%` }}
                  >
                    <div className="w-full h-full opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, currentColor 4px, currentColor 8px)' }}></div>
                  </div>
                )}
              </div>

              {/* Values */}
              <div className="w-[30%] pl-4 text-xs font-mono font-medium flex items-center justify-between">
                <span className="w-1/3 text-right text-slate-500 dark:text-slate-400">{fmtC(base)}</span>
                <span className={`w-1/3 text-right ${net < 0 ? 'text-emerald-600 dark:text-emerald-400' : net > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                  {net > 0 ? '+' : ''}{fmtC(net)}
                </span>
                <span className="w-1/3 text-right font-bold text-slate-900 dark:text-white">{fmtC(base + net)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Portal tooltip */}
      <ChartTooltip visible={tip.visible} x={tip.x} y={tip.y}>
        {tip.data && (
          <>
            <div className="font-bold mb-1 border-b border-slate-600 pb-1">{tip.data.label}</div>
            <div className="flex justify-between"><span>Base Budget:</span> <span>{fmtC(tip.data.base)}</span></div>
            <div className="flex justify-between text-emerald-400"><span>Locked VE:</span> <span>{fmtC(tip.data.locked)}</span></div>
            <div className="flex justify-between text-amber-400"><span>Pending Exposure:</span> <span>{fmtC(tip.data.pending)}</span></div>
            <div className="flex justify-between font-bold mt-1 pt-1 border-t border-slate-600">
              <span>Projected Position:</span>
              <span>{fmtC(tip.data.projected)}</span>
            </div>
          </>
        )}
      </ChartTooltip>
    </div>
  );
}
