"use client";
import { useMemo, useState } from 'react';
import { useProjectEstimateVersions, useProjectBudgetWaterfall } from '@/hooks/useEstimateQueries';
import VarianceWaterfallChart from './analytics/VarianceWaterfallChart';
import { useUIStore } from '@/stores/useUIStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

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

  const isCollapsed = useUIStore(state => state.isBudgetSummaryCollapsed);
  const toggleCollapse = useUIStore(state => state.toggleBudgetSummary);

  const formatCurrency = (val: number, forcePlus = false) => {
    if (isNaN(val)) return '$0';
    const num = Number(val);
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(num));
    if (num < 0) return `-${formatted}`;
    if (num > 0 && forcePlus) return `+${formatted}`;
    return formatted;
  };

  return (
    <motion.div layout className="w-full mb-4">
      <AnimatePresence mode="popLayout" initial={false}>
        {isCollapsed ? (
          <motion.div
            layout
            key="micro"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex-wrap w-full"
          >
            <div className="flex items-center flex-wrap gap-4 px-2">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Trade Variance Waterfall</span>
              
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Baseline:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalOriginal)}</span>
              </div>
              
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Locked:</span>
                <span className={`text-sm font-bold ${netVariance < 0 ? 'text-emerald-600 dark:text-emerald-400' : netVariance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  {formatCurrency(netVariance, true)}
                </span>
              </div>
              
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Revised:</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">{formatCurrency(revisedBudget)}</span>
              </div>
            </div>
            
            <div className="ml-auto flex items-center pl-4 border-l border-slate-200 dark:border-slate-700">
              <button 
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                title="Expand Summary"
              >
                <ChevronDown size={18} strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            layout
            key="macro"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm relative"
          >
            <div className="absolute -top-3 -right-3 z-10">
              <button 
                onClick={toggleCollapse}
                className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shadow-sm transition-all hover:scale-105"
                title="Collapse Summary"
              >
                <ChevronUp size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex justify-between items-start mb-6 pr-8">
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
                    {formatCurrency(totalOriginal)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Locked Variance</div>
                  <div className={`text-base font-semibold ${netVariance > 0 ? 'text-rose-600' : netVariance < 0 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                    {formatCurrency(netVariance, true)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Revised Forecast</div>
                  <div className={`text-xl font-bold ${revisedBudget > totalOriginal ? 'text-rose-600' : revisedBudget < totalOriginal ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
                    {formatCurrency(revisedBudget)}
                  </div>
                </div>
              </div>
            </div>

            <VarianceWaterfallChart projectId={projectId} versionId={selectedVersionId} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
