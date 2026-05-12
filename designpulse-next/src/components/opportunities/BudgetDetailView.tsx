"use client";
import { useEstimateLineDetails } from "@/hooks/useEstimateQueries";
import { Loader2, Database, AlertCircle } from "lucide-react";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

interface BudgetDetailViewProps {
  projectId: string;
  costCode: string;
}

export function BudgetDetailView({ projectId, costCode }: BudgetDetailViewProps) {
  const { data: lines, isLoading, isError } = useEstimateLineDetails(projectId, costCode);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading budget breakdown...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-rose-500">
        <AlertCircle className="w-8 h-8 mb-4" />
        <p>Failed to load budget details</p>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Database className="w-8 h-8 mb-4 opacity-50" />
        <p>No active budget lines found for {costCode}</p>
      </div>
    );
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.budget_amount, 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Budget Breakdown
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Cost Code: <span className="font-medium text-slate-900 dark:text-white">{costCode}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-0">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Type</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Description</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Unit Cost</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {line.cost_type || 'Other'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-900 dark:text-white">{line.description}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                  {line.unit_qty} {line.uom || ''}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                  {formatCurrency(line.unit_cost)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.budget_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
