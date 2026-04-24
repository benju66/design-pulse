import React, { useMemo } from 'react';
import { useProjectSettings, useAllProjectOptions } from '@/hooks/useProjectQueries';

const TooltipPopover = ({ title, description }) => (
  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[100] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform -translate-y-2 group-hover:translate-y-0 pointer-events-none">
    <div className="p-3 text-left">
      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{title}</h4>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{description}</p>
    </div>
  </div>
);

export default function BudgetSummary({ projectId, opportunities = [] }) {
  const { data: settings } = useProjectSettings(projectId);
  const originalBudget = settings ? Number(settings.original_budget) : 0;

  const { data: allOptions = [] } = useAllProjectOptions(projectId);

  const { approvedChanges, pendingChanges, potentialExposure } = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let exposure = 0;

    const optionsByOppId = allOptions.reduce((acc, opt) => {
      acc[opt.opportunity_id] = acc[opt.opportunity_id] || [];
      acc[opt.opportunity_id].push(opt);
      return acc;
    }, {});
    
    opportunities.forEach(opp => {
      if (opp.status === 'Rejected') return;

      const oppOptions = optionsByOppId[opp.id] || [];
      const hasOptions = oppOptions.length > 0;
      const lockedOption = oppOptions.find(o => o.is_locked);
      
      const oppImpact = Number(opp.cost_impact) || 0;

      if (opp.status === 'Approved' || lockedOption) {
        const impact = lockedOption ? (Number(lockedOption.cost_impact) || 0) : oppImpact;
        approved += impact;
      } else if (opp.status === 'Pending Review' || opp.status === 'Pending' || opp.status === 'Pending Plan Update') {
        if (!hasOptions) {
          pending += oppImpact;
        } else {
          const includedOptions = oppOptions.filter(o => o.include_in_budget);
          if (includedOptions.length > 0) {
            const includedImpact = includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
            pending += includedImpact;
          } else {
            const maxImpact = Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
            pending += maxImpact;
          }
        }
      } else {
        // Draft / Exposure Items
        if (!hasOptions) {
          exposure += oppImpact;
        } else {
          const includedOptions = oppOptions.filter(o => o.include_in_budget);
          if (includedOptions.length > 0) {
            const includedImpact = includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
            exposure += includedImpact;
          } else {
            const maxImpact = Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
            exposure += maxImpact;
          }
        }
      }
    });

    return { approvedChanges: approved, pendingChanges: pending, potentialExposure: exposure };
  }, [opportunities, allOptions]);

  const revisedBudget = originalBudget + approvedChanges;
  const projectedBudget = revisedBudget + pendingChanges;

  const formatCurrency = (val, forcePlus = false) => {
    if (isNaN(val)) return '$0';
    const num = Number(val);
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(num));
    if (num < 0) return `-${formatted}`;
    if (num > 0 && forcePlus) return `+${formatted}`;
    return formatted;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Cluster 1: Financial Commitments */}
      <div className="flex flex-col border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 px-1">Financial Commitments</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          {/* Original Budget */}
          <div className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Original Budget</span>
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(originalBudget)}</span>
        <TooltipPopover 
          title="Original Budget" 
          description="The baseline financial target established at the start of the phase." 
        />
      </div>

          {/* Approved Changes */}
          <div className="relative group bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">Approved Changes</span>
        <span className={`text-2xl font-bold ${approvedChanges < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
          {formatCurrency(approvedChanges, true)}
        </span>
        <TooltipPopover 
          title="Approved Changes" 
          description="The total sum of all fully approved or locked VE items and alternates." 
        />
      </div>

          {/* Revised Budget */}
          <div className="relative group bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-sky-600 dark:text-sky-400 font-medium">Revised Budget</span>
        <span className="text-2xl font-bold text-sky-700 dark:text-sky-300">{formatCurrency(revisedBudget)}</span>
        <TooltipPopover 
          title="Revised Budget" 
          description="Original Budget + Approved Changes." 
        />
          </div>
        </div>
      </div>

      {/* Cluster 2: Risk & Forecast */}
      <div className="flex flex-col border-2 border-dashed border-slate-300 dark:border-slate-600 bg-amber-50/20 dark:bg-amber-900/5 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-amber-600/80 dark:text-amber-500/80 uppercase tracking-wider mb-4 px-1">Risk & Forecast</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          {/* Pending Changes */}
          <div className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pending Changes</span>
        <span className={`text-2xl font-bold ${pendingChanges < 0 ? 'text-emerald-500' : pendingChanges > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
          {formatCurrency(pendingChanges, true)}
        </span>
        <TooltipPopover 
          title="Pending Changes" 
          description="Items currently under review. If multiple options exist, the highest cost is used conservatively." 
        />
      </div>

          {/* Projected Budget */}
          <div className="relative group bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-4 flex flex-col shadow-sm ring-1 ring-slate-900/5 dark:ring-white/5">
        <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">Projected Budget</span>
        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(projectedBudget)}</span>
        <TooltipPopover 
          title="Projected Budget" 
          description="Revised Budget + Pending Changes. The expected final cost if all pending items are approved." 
        />
      </div>

          {/* Potential Exposure */}
          <div className="relative group bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Potential Exposure</span>
        <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(potentialExposure, true)}</span>
        <TooltipPopover 
          title="Potential Exposure" 
          description="The worst-case cost scenario for all early-stage draft items not yet under formal review." 
        />
          </div>
        </div>
      </div>
    </div>
  );
}
