"use client";
import React, { useMemo } from 'react';
import { Opportunity } from '@/types/models';
import { useProjectSettings } from '@/hooks/useProjectQueries';

interface BudgetSummaryProps {
  projectId: string;
  opportunities: Opportunity[];
}

export default function BudgetSummaryV2({ projectId, opportunities }: BudgetSummaryProps) {
  const { data: settings } = useProjectSettings(projectId);

  const trades = useMemo(() => {
    const map = opportunities.reduce((acc, opp) => {
      // Include all items that have a cost impact. Ignore those with 0 variance unless you want to show them.
      const code = opp.cost_code || 'Uncategorized';
      if (!acc[code]) acc[code] = 0;
      acc[code] += Number(opp.cost_impact) || 0;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(map)
      .map(([code, variance]) => ({ code, variance }))
      // .filter(t => t.variance !== 0) // Keep zero variance trades out to declutter the chart? Let's keep them if there's any.
      .sort((a, b) => b.variance - a.variance);
  }, [opportunities]);

  const maxDeviation = useMemo(() => {
    if (trades.length === 0) return 1;
    return Math.max(1, ...trades.map(t => Math.abs(t.variance)));
  }, [trades]);

  const totalOriginal = Number(settings?.original_budget) || 5000000;
  const netVariance = trades.reduce((sum, t) => sum + t.variance, 0);
  const revisedBudget = totalOriginal + netVariance;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Trade Variance Waterfall</h3>
          <p className="text-xs text-slate-500">Visualizing cost impact by trade code relative to baseline</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Original Budget</div>
            <div className="text-base font-semibold text-slate-600 dark:text-slate-300">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalOriginal)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Revised Forecast</div>
            <div className={`text-xl font-bold ${netVariance > 0 ? 'text-rose-600' : netVariance < 0 ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(revisedBudget)}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
