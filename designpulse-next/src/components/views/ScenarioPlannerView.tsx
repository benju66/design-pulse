'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { Plus, Settings2, Eye, Columns3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BudgetMetricsBar } from '@/components/ui/BudgetMetricsBar';
import { ScenarioColumn } from '@/components/scenario/ScenarioColumn';
import { ScopeManagerModal } from '@/components/scenario/ScopeManagerModal';
import { useVeScenarios, useCreateScenario } from '@/hooks/useScenarioQueries';
import { useVePackages } from '@/hooks/useSandboxQueries';
import { useOpportunities, useAllProjectOptions } from '@/hooks/useOpportunityQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { calculateBudgetMetrics } from '@/utils/financialMath';
import type { PackageScopeConfig } from '@/types/models';

interface ScenarioPlannerViewProps {
  projectId: string;
}

export function ScenarioPlannerView({ projectId }: ScenarioPlannerViewProps) {
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  // Data fetching
  const { data: scenarios = [], isLoading: scenariosLoading } = useVeScenarios(projectId);
  const { data: packages = [] } = useVePackages(projectId);
  const { data: opportunities = [] } = useOpportunities(projectId);
  const { data: allOptions = [] } = useAllProjectOptions(projectId);
  const { data: settings } = useProjectSettings(projectId);

  const createScenario = useCreateScenario(projectId);

  // Permissions — RLS enforces actual permissions; UI just shows/hides buttons
  const canEdit = true;

  // Budget baseline
  const originalBudget = settings?.original_budget ?? 0;
  const baselineMetrics = useMemo(
    () => calculateBudgetMetrics(opportunities, allOptions, originalBudget),
    [opportunities, allOptions, originalBudget]
  );

  // Scope labels
  const scopes: PackageScopeConfig[] = settings?.package_scopes ?? [];
  const scopeLabelsById = useMemo(
    () => new Map(scopes.map(s => [s.id, s.label])),
    [scopes]
  );

  const isLoading = scenariosLoading;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Columns3 size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Scenario Planner</h2>
            <p className="text-xs text-slate-400">Compare VE package scenarios side-by-side</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsScopeModalOpen(true)}
              >
                <Settings2 size={14} className="mr-1.5" />
                Manage Scopes
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => createScenario.mutate({})}
                disabled={createScenario.isPending}
              >
                {createScenario.isPending ? (
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : (
                  <Plus size={14} className="mr-1.5" />
                )}
                New Scenario
              </Button>
            </>
          )}
          {!canEdit && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              <Eye size={12} />
              View Only
            </span>
          )}
        </div>
      </div>

      {/* Budget Baseline */}
      <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <BudgetMetricsBar
          metrics={baselineMetrics}
          originalBudget={originalBudget}
          label="Current Budget Baseline"
        />
      </div>

      {/* Main content — horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : scenarios.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mb-4">
              <Columns3 size={28} className="text-violet-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              No Scenarios Yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Create scenarios to compare different VE package combinations
              side-by-side and see how they impact your project budget.
            </p>
            {canEdit && (
              <Button
                variant="primary"
                onClick={() => createScenario.mutate({})}
                disabled={createScenario.isPending}
              >
                <Plus size={14} className="mr-1.5" />
                Create Your First Scenario
              </Button>
            )}
          </div>
        ) : (
          /* Scenario columns */
          <div className="flex gap-4 h-full">
            {scenarios.map(scenario => (
              <ScenarioColumn
                key={scenario.id}
                scenario={scenario}
                packages={packages}
                opportunities={opportunities}
                allOptions={allOptions as any}
                originalBudget={originalBudget}
                canEdit={canEdit}
                baselineMetrics={baselineMetrics}
                scopeLabelsById={scopeLabelsById}
                projectId={projectId}
                isSelected={selectedScenarioId === scenario.id}
                onSelect={() => setSelectedScenarioId(prev => prev === scenario.id ? null : scenario.id)}
              />
            ))}

            {/* Quick-add column */}
            {canEdit && (
              <button
                onClick={() => createScenario.mutate({})}
                disabled={createScenario.isPending}
                className={cn(
                  'min-w-[200px] h-full rounded-2xl border-2 border-dashed transition-all',
                  'border-slate-200 dark:border-slate-700',
                  'text-slate-300 dark:text-slate-600',
                  'hover:border-violet-300 dark:hover:border-violet-700',
                  'hover:text-violet-400 dark:hover:text-violet-500',
                  'flex flex-col items-center justify-center gap-2',
                )}
              >
                <Plus size={24} />
                <span className="text-sm font-medium">Add Scenario</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scope manager modal */}
      <ScopeManagerModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}
