"use client";
import { useMemo } from 'react';
import { Opportunity } from '@/types/models';

interface Props {
  opportunities: Opportunity[];
}

export default function VarianceWaterfallChart({ opportunities }: Props) {
  const trades = useMemo(() => {
    const map = opportunities.reduce((acc, opp) => {
      const code = opp.cost_code || 'Uncategorized';
      if (!acc[code]) acc[code] = 0;
      acc[code] += Number(opp.cost_impact) || 0;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(map)
      .map(([code, variance]) => ({ code, variance }))
      .sort((a, b) => b.variance - a.variance);
  }, [opportunities]);

  const maxDeviation = useMemo(() => {
    if (trades.length === 0) return 1;
    return Math.max(1, ...trades.map(t => Math.abs(t.variance)));
  }, [trades]);

  return (
    <div className="relative w-full max-w-4xl mx-auto pt-2">
      {/* Zero Centerline */}
      <div className="absolute left-[50%] top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-700 z-0"></div>
      <div className="absolute left-[50%] top-[-10px] -translate-x-1/2 text-[10px] text-slate-400 font-bold">$0</div>

      <div className="flex flex-col gap-2 relative z-10 mt-2">
        {trades.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-4">No data to display. Add options to see variances.</div>
        )}
        {trades.map((trade) => {
          const isSavings = trade.variance < 0;
          const barWidth = `${(Math.abs(trade.variance) / maxDeviation) * 50}%`;

          return (
            <div key={trade.code} className="flex items-center w-full group">
              <div className="w-[20%] pr-4 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                {trade.code}
              </div>
              
              <div className="w-[60%] relative h-6 bg-slate-50 dark:bg-slate-800/50 rounded flex items-center">
                {isSavings ? (
                  <div 
                    className="absolute right-[50%] h-full bg-emerald-500 rounded-l-md transition-all duration-500 ease-out group-hover:bg-emerald-400"
                    style={{ width: barWidth }}
                  />
                ) : (
                  <div 
                    className="absolute left-[50%] h-full bg-rose-500 rounded-r-md transition-all duration-500 ease-out group-hover:bg-rose-400"
                    style={{ width: barWidth }}
                  />
                )}
              </div>

              <div className="w-[20%] pl-4 text-xs font-mono font-medium flex items-center gap-2">
                <span className={isSavings ? 'text-emerald-600 dark:text-emerald-400' : trade.variance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
                  {trade.variance > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(trade.variance)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
