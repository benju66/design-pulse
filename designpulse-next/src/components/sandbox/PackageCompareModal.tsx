'use client';

import { useMemo } from 'react';
import { X, Star, FileDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';
import type { VePackageWithItems } from '@/types/sandbox';
import type { Opportunity, OpportunityOption } from '@/types/models';
import { useSandboxMetrics } from '@/hooks/useSandboxMetrics';

interface PackageCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: VePackageWithItems[];
  projectId: string;
  allOpportunities: Opportunity[];
  allOptions: OpportunityOption[];
  originalBudget: number;
}

const COLOR_BORDER_TOP: Record<string, string> = {
  violet: 'border-t-violet-500', blue: 'border-t-blue-500', emerald: 'border-t-emerald-500',
  rose: 'border-t-rose-500', amber: 'border-t-amber-500', cyan: 'border-t-cyan-500',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** Wrapper to use useSandboxMetrics per-package inside the modal body */
function PackageColumn({
  pkg, projectId, allOpportunities, allOptions, originalBudget, unionOppIds, isBestValue,
}: {
  pkg: VePackageWithItems;
  projectId: string;
  allOpportunities: Opportunity[];
  allOptions: OpportunityOption[];
  originalBudget: number;
  unionOppIds: string[];
  isBestValue: boolean;
}) {
  const metrics = useSandboxMetrics(projectId, pkg.items, allOpportunities, allOptions);

  // Build a lookup for this package's items by opportunity ID
  const metricsItems = metrics.items;
  const itemByOppId = useMemo(() => {
    const map: Record<string, typeof metricsItems[number]> = {};
    for (const item of metricsItems) {
      map[item.opportunityId] = item;
    }
    return map;
  }, [metricsItems]);

  const revisedBudget = originalBudget + metrics.totals.netImpact;

  return (
    <div className={cn(
      'min-w-[280px] flex flex-col border-r border-slate-200 dark:border-slate-700 last:border-r-0 border-t-4',
      COLOR_BORDER_TOP[pkg.color] || 'border-t-violet-500',
    )}>
      {/* Column header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{pkg.name}</h3>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {unionOppIds.map(oppId => {
          const item = itemByOppId[oppId];

          if (!item) {
            return (
              <div key={oppId} className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-300 dark:text-slate-600 italic">
                —
              </div>
            );
          }

          return (
            <div
              key={oppId}
              className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-medium">
                  {item.displayId}
                </span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                  {item.title}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {item.assumedOptionTitle || '— current —'}
                </span>
                <span className={cn(
                  'text-xs font-bold tabular-nums ml-2 shrink-0',
                  item.resolvedCostImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
                  item.resolvedCostImpact > 0 ? 'text-rose-600 dark:text-rose-400' :
                  'text-slate-400'
                )}>
                  {item.resolvedCostImpact > 0 ? '+' : ''}{fmt(item.resolvedCostImpact)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Column footer: totals */}
      <div className="px-4 py-3 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 dark:text-slate-500">Items</span>
          <span className="font-bold text-slate-600 dark:text-slate-300">{metrics.items.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-slate-400 dark:text-slate-500">Net Impact</span>
          <span className={cn(
            'font-bold tabular-nums',
            metrics.totals.netImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
            metrics.totals.netImpact > 0 ? 'text-rose-600 dark:text-rose-400' :
            'text-slate-400'
          )}>
            {metrics.totals.netImpact > 0 ? '+' : ''}{fmt(metrics.totals.netImpact)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-slate-400 dark:text-slate-500">Revised Budget</span>
          <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">{fmt(revisedBudget)}</span>
        </div>
        {isBestValue && (
          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <Star size={12} className="fill-current" /> Best Value
          </div>
        )}
      </div>
    </div>
  );
}

export function PackageCompareModal({
  isOpen, onClose, packages, projectId, allOpportunities, allOptions, originalBudget,
}: PackageCompareModalProps) {
  // Build union of all opportunity IDs across all packages
  const unionOppIds = useMemo(() => {
    const set = new Set<string>();
    for (const pkg of packages) {
      for (const item of pkg.items) {
        set.add(item.opportunity_id);
      }
    }
    // Sort by display_id for consistent ordering
    return Array.from(set).sort((a, b) => {
      const oppA = allOpportunities.find(o => o.id === a);
      const oppB = allOpportunities.find(o => o.id === b);
      return (oppA?.display_id || '').localeCompare(oppB?.display_id || '');
    });
  }, [packages, allOpportunities]);

  // Determine best value package (lowest net impact)
  const bestValuePkgId = useMemo(() => {
    if (packages.length < 2) return null;
    // We compute a simple net impact per package based on item count
    // The actual best value is determined per-column in PackageColumn
    let bestId: string | null = null;
    let bestNet = Infinity;
    // Simple heuristic: the package with most items and lowest total
    for (const pkg of packages) {
      const items = pkg.items;
      let net = 0;
      for (const item of items) {
        const opp = allOpportunities.find(o => o.id === item.opportunity_id);
        if (!opp) continue;
        const oppOptions = allOptions.filter(o => o.opportunity_id === item.opportunity_id);
        if (item.assumed_option_id) {
          const assumed = oppOptions.find(o => o.id === item.assumed_option_id);
          net += assumed ? (Number(assumed.cost_impact) || 0) : (Number(opp.cost_impact) || 0);
        } else {
          net += Number(opp.cost_impact) || 0;
        }
      }
      if (net < bestNet) {
        bestNet = net;
        bestId = pkg.id;
      }
    }
    return bestId;
  }, [packages, allOpportunities, allOptions]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="full">
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Compare VE Packages</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-w-0">
            {packages.map(pkg => (
              <PackageColumn
                key={pkg.id}
                pkg={pkg}
                projectId={projectId}
                allOpportunities={allOpportunities}
                allOptions={allOptions}
                originalBudget={originalBudget}
                unionOppIds={unionOppIds}
                isBestValue={bestValuePkgId === pkg.id}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <Button variant="secondary" size="sm" disabled title="Coming soon">
            <FileDown size={14} />
            Export PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
