import React, { useMemo } from 'react';

export default function BudgetSummary({ opportunities = [] }) {
  // Static Original Budget for now (could be pulled from project settings later)
  const ORIGINAL_BUDGET = 5000000;

  const { pendingChanges, approvedImpact } = useMemo(() => {
    let pending = 0;
    let approved = 0;
    
    opportunities.forEach(opp => {
      const impact = Number(opp.cost_impact) || 0;
      if (opp.status === 'Pending Review' || opp.status === 'Pending') {
        pending += impact;
      } else if (opp.status === 'Approved') {
        approved += impact;
      }
    });

    return { pendingChanges: pending, approvedImpact: approved };
  }, [opportunities]);

  const approvedTotal = ORIGINAL_BUDGET + approvedImpact;

  const formatCurrency = (val) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
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
    </div>
  );
}
