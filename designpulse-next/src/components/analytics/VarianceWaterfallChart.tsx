"use client";
import { useMemo } from 'react';
import { useProjectBudgetWaterfall } from '@/hooks/useEstimateQueries';
import { formatCostCode } from '@/lib/formatCostCode';

interface Props {
  projectId: string;
  versionId: string | null;
}

export default function VarianceWaterfallChart({ projectId, versionId }: Props) {
  const { data: rawRows, isLoading } = useProjectBudgetWaterfall(projectId, versionId);

  // Filter out rows that have absolutely no variance (locked or pending) to keep the chart clean
  const rows = useMemo(() => {
    if (!rawRows) return [];
    return rawRows
      .filter(r => (Number(r.ve_impact) !== 0 || Number(r.pending_impact) !== 0))
      .sort((a, b) => {
        const netA = Number(a.ve_impact) + Number(a.pending_impact);
        const netB = Number(b.ve_impact) + Number(b.pending_impact);
        return netA - netB; // Sort Savings (negative) to Top, Overages (positive) to Bottom
      });
  }, [rawRows]);

  const maxProjectedBudget = useMemo(() => {
    if (rows.length === 0) return 1;
    // Max extent of any budget (Base or Base + Net)
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

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="relative w-full max-w-5xl mx-auto pt-2">
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

          // Zero-JS Tooltip formatting
          const displayName = row.cost_code === 'Unassigned' 
            ? 'Unassigned' 
            : `${formatCostCode(row.cost_code)} - ${row.description}`;

          return (
            <div key={row.cost_code} className="flex items-center w-full group relative px-4">
              
              {/* ZERO-JS TOOLTIP */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100]">
                <div className="font-bold mb-1 border-b border-slate-600 pb-1">{displayName}</div>
                <div className="flex justify-between"><span>Base Budget:</span> <span>{formatCurrency(base)}</span></div>
                <div className="flex justify-between text-emerald-400"><span>Locked VE:</span> <span>{formatCurrency(locked)}</span></div>
                <div className="flex justify-between text-amber-400"><span>Pending Exposure:</span> <span>{formatCurrency(pending)}</span></div>
                <div className="flex justify-between font-bold mt-1 pt-1 border-t border-slate-600">
                  <span>Projected Position:</span> 
                  <span>{formatCurrency(base + net)}</span>
                </div>
              </div>

              {/* Label */}
              <div className="w-[25%] pr-4 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate" title={displayName}>
                {displayName}
              </div>
              
              {/* Bars container */}
              <div className="w-[45%] relative h-6 rounded flex items-center border-l border-slate-300 dark:border-slate-700">
                {/* Base Budget Bar */}
                <div 
                  className="absolute h-full rounded-md bg-slate-200 dark:bg-slate-700/60 z-10 transition-all duration-500 ease-out"
                  style={{ left: '0%', width: `${baseWidthPct}%` }}
                />
                
                {/* Locked Bar */}
                {locked !== 0 && (
                  <div 
                    className={`absolute h-full rounded-md transition-all duration-500 ease-out z-20 ${locked < 0 ? 'bg-emerald-500 group-hover:bg-emerald-400 opacity-90' : 'bg-rose-500 group-hover:bg-rose-400'}`}
                    style={{ left: `${lockedLeftPct}%`, width: `${lockedWidthPct}%` }}
                  />
                )}
                
                {/* Pending Bar */}
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
                <span className="w-1/3 text-right text-slate-500 dark:text-slate-400">{formatCurrency(base)}</span>
                <span className={`w-1/3 text-right ${net < 0 ? 'text-emerald-600 dark:text-emerald-400' : net > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                  {net > 0 ? '+' : ''}{formatCurrency(net)}
                </span>
                <span className="w-1/3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(base + net)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
