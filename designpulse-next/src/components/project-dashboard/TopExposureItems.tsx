"use client";
import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Opportunity, OpportunityOption } from '@/types/models';

// ── Types ────────────────────────────────────────────────────────────────────
interface TopExposureItemsProps {
  opportunities: Opportunity[];
  allOptions: OpportunityOption[];
  onRowClick: (opportunityId: string) => void;
}

interface ExposureRow {
  id: string;
  displayId: string;
  title: string;
  buildingArea: string;
  worstCaseCost: number;
  optionsCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (val: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);

// ── Component ────────────────────────────────────────────────────────────────
export const TopExposureItems = React.memo(function TopExposureItems({
  opportunities,
  allOptions,
  onRowClick,
}: TopExposureItemsProps) {
  const rows = useMemo<ExposureRow[]>(() => {
    // Pre-group options by opportunity_id
    const optionsByOppId: Record<string, OpportunityOption[]> = {};
    allOptions.forEach((opt) => {
      const existing = optionsByOppId[opt.opportunity_id];
      if (existing) {
        existing.push(opt);
      } else {
        optionsByOppId[opt.opportunity_id] = [opt];
      }
    });

    // Only Draft items represent unresolved exposure
    const draftItems = opportunities.filter(
      (opp) => opp.status === 'Draft' && (opp.record_type || 'VE') === 'VE'
    );

    return draftItems
      .map((opp) => {
        const oppOptions = optionsByOppId[opp.id] || [];
        const hasOptions = oppOptions.length > 0;

        let worstCase: number;
        if (hasOptions) {
          const includedOptions = oppOptions.filter((o) => o.include_in_budget);
          if (includedOptions.length > 0) {
            worstCase = includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
          } else {
            worstCase = Math.max(...oppOptions.map((o) => Number(o.cost_impact) || 0));
          }
        } else {
          worstCase = Number(opp.cost_impact) || 0;
        }

        return {
          id: opp.id,
          displayId: opp.display_id || '-',
          title: opp.title || 'Untitled',
          buildingArea: opp.building_area || '-',
          worstCaseCost: worstCase,
          optionsCount: oppOptions.length,
        };
      })
      .sort((a, b) => Math.abs(b.worstCaseCost) - Math.abs(a.worstCaseCost))
      .slice(0, 5);
  }, [opportunities, allOptions]);

  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
        <AlertTriangle size={20} className="text-slate-300 dark:text-slate-600 mb-2" />
        <span className="text-sm text-slate-400 dark:text-slate-500">No unresolved exposure items</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
        Top Exposure Items
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2 pr-3">ID</th>
              <th className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2 pr-3">Title</th>
              <th className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2 pr-3">Area</th>
              <th className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2 text-right">Worst Case</th>
              <th className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2 text-right pl-3">Opts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.id)}
                className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <td className="text-xs font-mono text-slate-500 dark:text-slate-400 py-2.5 pr-3 whitespace-nowrap">
                  {row.displayId}
                </td>
                <td className="text-xs font-medium text-slate-700 dark:text-slate-300 py-2.5 pr-3 max-w-[200px] truncate">
                  {row.title}
                </td>
                <td className="text-xs text-slate-500 dark:text-slate-400 py-2.5 pr-3 whitespace-nowrap">
                  {row.buildingArea}
                </td>
                <td className={`text-xs font-bold py-2.5 text-right tabular-nums whitespace-nowrap ${
                  row.worstCaseCost > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formatCurrency(row.worstCaseCost)}
                </td>
                <td className="text-xs text-slate-500 dark:text-slate-400 py-2.5 text-right tabular-nums pl-3">
                  {row.optionsCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
