"use client";
import { useMemo, useState } from 'react';
import { useProjectEstimateVersions, useProjectBudgetWaterfall } from '@/hooks/useEstimateQueries';
import VarianceWaterfallChart from './analytics/VarianceWaterfallChart';

interface BudgetSummaryProps {
  projectId: string;
}

export default function BudgetSummaryV2({ projectId }: BudgetSummaryProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const { data: versions = [] } = useProjectEstimateVersions(projectId);
  const { data: waterfallRows = [] } = useProjectBudgetWaterfall(projectId, selectedVersionId);

  // Compute header totals strictly from the RPC data (AGENTS.md C5)
  const { totalOriginal, revisedBudget, netVariance } = useMemo(() => {
    let original = 0;
    let revised = 0;
    let lockedImpact = 0;
    for (const row of waterfallRows) {
      original += Number(row.budget_amount) || 0;
      revised += Number(row.projected_position) || 0; // Wait, revised should be net_position or projected_position? "Revised Forecast" in UI usually means Base + Locked. Let's use net_position.
      lockedImpact += Number(row.ve_impact) || 0;
    }
    return {
      totalOriginal: original,
      revisedBudget: original + lockedImpact,
      netVariance: lockedImpact
    };
  }, [waterfallRows]);

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-4 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            Trade Variance Waterfall
            {versions.length > 0 && (
              <select
                value={selectedVersionId || ''}
                onChange={(e) => setSelectedVersionId(e.target.value || null)}
                className="ml-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none rounded-md px-2 py-1 cursor-pointer focus:ring-0"
              >
                <option value="">Default (Active Budget)</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.version_name} {v.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Visualizing cost impact by trade code relative to baseline</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Baseline Budget</div>
            <div className="text-base font-semibold text-slate-600 dark:text-slate-300">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalOriginal)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Locked Variance</div>
            <div className={`text-base font-semibold ${netVariance > 0 ? 'text-rose-600' : netVariance < 0 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
              {netVariance > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(netVariance)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Revised Forecast</div>
            <div className={`text-xl font-bold ${revisedBudget > totalOriginal ? 'text-rose-600' : revisedBudget < totalOriginal ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(revisedBudget)}
            </div>
          </div>
        </div>
      </div>

      <VarianceWaterfallChart projectId={projectId} versionId={selectedVersionId} />
    </div>
  );
}
