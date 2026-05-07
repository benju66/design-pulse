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

  const maxDeviation = useMemo(() => {
    if (rows.length === 0) return 1;
    // Max absolute extent of any bar (either the locked point or the projected point)
    return Math.max(1, ...rows.map(r => 
      Math.max(
        Math.abs(Number(r.ve_impact) || 0), 
        Math.abs((Number(r.ve_impact) || 0) + (Number(r.pending_impact) || 0))
      )
    ));
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
    <div className="relative w-full max-w-4xl mx-auto pt-2">
      {/* Zero Centerline */}
      <div className="absolute left-[50%] top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-700 z-0"></div>
      <div className="absolute left-[50%] top-[-10px] -translate-x-1/2 text-[10px] text-slate-400 font-bold">$0</div>

      <div className="flex flex-col gap-3 relative z-10 mt-2">
        {rows.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-4">No active variances to display for this budget.</div>
        )}
        {rows.map((row) => {
          const locked = Number(row.ve_impact) || 0;
          const pending = Number(row.pending_impact) || 0;
          const net = locked + pending;
          
          // Geometric Mini-Waterfall positioning relative to 50% center
          const lockedStart = Math.min(0, locked);
          const lockedWidth = Math.abs(locked);
          const lockedLeftPct = 50 + (lockedStart / maxDeviation) * 50;
          const lockedWidthPct = (lockedWidth / maxDeviation) * 50;

          const pendingStart = Math.min(locked, locked + pending);
          const pendingWidth = Math.abs(pending);
          const pendingLeftPct = 50 + (pendingStart / maxDeviation) * 50;
          const pendingWidthPct = (pendingWidth / maxDeviation) * 50;

          // Zero-JS Tooltip formatting
          const baseBudget = Number(row.budget_amount) || 0;
          
          // AGENTS.md C30 - Compound Display Name
          const displayName = row.cost_code === 'Unassigned' 
            ? 'Unassigned' 
            : `${formatCostCode(row.cost_code)} - ${row.description}`;

          return (
            <div key={row.cost_code} className="flex items-center w-full group relative">
              
              {/* ZERO-JS TOOLTIP (AGENTS.md C17) */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100]">
                <div className="font-bold mb-1 border-b border-slate-600 pb-1">{displayName}</div>
                <div className="flex justify-between"><span>Base Budget:</span> <span>{formatCurrency(baseBudget)}</span></div>
                <div className="flex justify-between text-emerald-400"><span>Locked VE:</span> <span>{formatCurrency(locked)}</span></div>
                <div className="flex justify-between text-amber-400"><span>Pending Exposure:</span> <span>{formatCurrency(pending)}</span></div>
                <div className="flex justify-between font-bold mt-1 pt-1 border-t border-slate-600">
                  <span>Projected Position:</span> 
                  <span>{formatCurrency(baseBudget + net)}</span>
                </div>
              </div>

              {/* Label */}
              <div className="w-[30%] pr-4 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate" title={displayName}>
                {displayName}
              </div>
              
              {/* Bars container */}
              <div className="w-[50%] relative h-6 bg-slate-50 dark:bg-slate-800/50 rounded flex items-center">
                {/* Locked Bar */}
                {locked !== 0 && (
                  <div 
                    className={`absolute h-full rounded-md transition-all duration-500 ease-out z-20 ${locked < 0 ? 'bg-emerald-500 group-hover:bg-emerald-400' : 'bg-rose-500 group-hover:bg-rose-400'}`}
                    style={{ left: `${lockedLeftPct}%`, width: `${lockedWidthPct}%` }}
                  />
                )}
                {/* Pending Bar */}
                {pending !== 0 && (
                  <div 
                    className={`absolute h-full rounded-md transition-all duration-500 ease-out z-10 opacity-60 ${pending < 0 ? 'bg-emerald-300 dark:bg-emerald-600' : 'bg-rose-300 dark:bg-rose-600'} flex items-center overflow-hidden`}
                    style={{ left: `${pendingLeftPct}%`, width: `${pendingWidthPct}%` }}
                  >
                    {/* Hatched pattern overlay for pending */}
                    <div className="w-full h-full opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, currentColor 4px, currentColor 8px)' }}></div>
                  </div>
                )}
              </div>

              {/* Values */}
              <div className="w-[20%] pl-4 text-xs font-mono font-medium flex items-center gap-2">
                <span className={net < 0 ? 'text-emerald-600 dark:text-emerald-400' : net > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
                  {net > 0 ? '+' : ''}{formatCurrency(net)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
