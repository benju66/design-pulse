import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useProjectSettings } from '@/hooks/useProjectQueries';

export default function BudgetSummary({ projectId, opportunities = [] }) {
  const { data: settings } = useProjectSettings(projectId);
  const ORIGINAL_BUDGET = settings?.original_budget ? Number(settings.original_budget) : 5000000;

  const oppIds = useMemo(() => opportunities.map(o => o.id), [opportunities]);

  const { data: allOptions = [] } = useQuery({
    queryKey: ['all_options', oppIds],
    queryFn: async () => {
      if (oppIds.length === 0) return [];
      const { data } = await supabase.from('opportunity_options').select('*').in('opportunity_id', oppIds);
      return data || [];
    },
    enabled: oppIds.length > 0
  });

  const { pendingChanges, approvedImpact, potentialExposure } = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let exposure = 0;
    
    opportunities.forEach(opp => {
      const oppOptions = allOptions.filter(o => o.opportunity_id === opp.id);
      const hasOptions = oppOptions.length > 0;
      const lockedOption = oppOptions.find(o => o.is_locked);
      
      const impact = Number(opp.cost_impact) || 0;

      if (opp.status === 'Approved') {
        if (!hasOptions || lockedOption) {
          approved += impact;
        }
      } else if (opp.status === 'Pending Review' || opp.status === 'Pending') {
        if (!hasOptions || lockedOption) {
          pending += impact;
        }
      }

      // Calculate potential exposure (maximum cost variance)
      if (hasOptions && !lockedOption) {
        const maxImpact = Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
        if (maxImpact > 0) exposure += maxImpact; // Only count positive impacts as exposure
      } else if (!hasOptions && opp.status !== 'Approved' && opp.status !== 'Rejected') {
        if (impact > 0) exposure += impact;
      }
    });

    return { pendingChanges: pending, approvedImpact: approved, potentialExposure: exposure };
  }, [opportunities, allOptions]);

  const approvedTotal = ORIGINAL_BUDGET + approvedImpact;

  const formatCurrency = (val) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Original Budget</span>
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(ORIGINAL_BUDGET)}</span>
      </div>
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pending Changes</span>
        <span className={`text-2xl font-bold ${pendingChanges < 0 ? 'text-emerald-500' : pendingChanges > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
          {pendingChanges > 0 ? '+' : ''}{formatCurrency(pendingChanges)}
        </span>
      </div>
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-sky-600 dark:text-sky-400 font-medium">Approved Total</span>
        <span className="text-2xl font-bold text-sky-700 dark:text-sky-300">{formatCurrency(approvedTotal)}</span>
      </div>
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col">
        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Potential Exposure</span>
        <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">+{formatCurrency(potentialExposure)}</span>
      </div>
    </div>
  );
}
