'use client';

import { useMemo } from 'react';
import { ModalShell } from '@/components/ui/ModalShell';
import { Button } from '@/components/ui/Button';
import { Shield, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useApplyScenario } from '@/hooks/useScenarioQueries';
import type { VeScenarioWithPackages } from '@/types/scenario';
import type { VePackageWithItems } from '@/types/sandbox';

interface ApplyScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: VeScenarioWithPackages;
  packages: VePackageWithItems[];
  projectId: string;
  allOpportunities: Array<{ id: string; title: string; display_id?: string | null }>;
}

export function ApplyScenarioModal({
  isOpen,
  onClose,
  scenario,
  packages,
  projectId,
  allOpportunities,
}: ApplyScenarioModalProps) {
  const applyMutation = useApplyScenario(projectId);

  // Compute affected items (first-package-wins, matching DR-2)
  const affectedItems = useMemo(() => {
    const packagesById = new Map(packages.map(p => [p.id, p]));
    const seen = new Map<string, { oppName: string; optionLabel: string }>();

    const sortedPkgs = [...scenario.scenarioPackages].sort((a, b) => a.sort_order - b.sort_order);
    for (const sp of sortedPkgs) {
      const pkg = packagesById.get(sp.package_id);
      if (!pkg) continue;
      for (const item of pkg.items) {
        if (item.assumed_option_id && !seen.has(item.opportunity_id)) {
          seen.set(item.opportunity_id, {
            oppName: item.opportunity_id, // will be resolved below
            optionLabel: item.assumed_option_id,
          });
        }
      }
    }
    return seen;
  }, [scenario, packages]);

  const handleApply = async () => {
    try {
      await applyMutation.mutateAsync(scenario.id);
      onClose();
    } catch {
      // Error handled by mutation's onError
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Apply Scenario</h3>
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              This action will lock contenders
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Applying &quot;{scenario.name}&quot; will lock{' '}
              <strong>{affectedItems.size}</strong> contender{affectedItems.size !== 1 ? 's' : ''}{' '}
              across {affectedItems.size} opportunit{affectedItems.size !== 1 ? 'ies' : 'y'}.
              This overwrites existing locks and updates the project budget.
            </p>
          </div>
        </div>

        {/* Affected items summary */}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Items to Lock ({affectedItems.size})
          </div>
          {affectedItems.size === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-slate-400">
              No items with assumed contenders found
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {Array.from(affectedItems.entries()).map(([oppId]) => {
                  const opp = allOpportunities.find(o => o.id === oppId);
                  return (
                    <div key={oppId} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <Shield size={12} className="text-sky-500 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 truncate flex-1 text-[10px]">
                        {opp ? `${opp.display_id ?? '—'}: ${opp.title}` : `${oppId.slice(0, 8)}…`}
                      </span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="text-sky-600 dark:text-sky-400 truncate text-[10px]">Lock contender</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose} disabled={applyMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleApply}
            disabled={applyMutation.isPending || affectedItems.size === 0}
          >
            {applyMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1.5" />
                Applying…
              </>
            ) : (
              <>
                <Shield size={14} className="mr-1.5" />
                Apply &amp; Lock ({affectedItems.size})
              </>
            )}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
