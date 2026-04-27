"use client";
import { useMemo } from 'react';
import { Opportunity } from '@/types/models';
import { useProjectSettings } from '@/hooks/useProjectQueries';
import VarianceWaterfallChart from './analytics/VarianceWaterfallChart';

interface BudgetSummaryProps {
  projectId: string;
  opportunities: Opportunity[];
}

export default function BudgetSummaryV2({ projectId, opportunities }: BudgetSummaryProps) {
  const { data: settings } = useProjectSettings(projectId);

  const netVariance = useMemo(() => {
    return opportunities.reduce((sum, opp) => sum + (Number(opp.cost_impact) || 0), 0);
  }, [opportunities]);

  const totalOriginal = Number(settings?.original_budget) || 5000000;
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

      <VarianceWaterfallChart projectId={projectId} />
    </div>
  );
}
