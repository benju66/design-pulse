'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { Plus, Settings2, Eye, Columns3, Loader2, Archive, Package } from 'lucide-react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  type Over,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { BudgetMetricsBar } from '@/components/ui/BudgetMetricsBar';
import { ScenarioColumn } from '@/components/scenario/ScenarioColumn';
import { PackageBankPanel } from '@/components/scenario/PackageBankPanel';
import { ScopeManagerModal } from '@/components/scenario/ScopeManagerModal';
import {
  useVeScenarios,
  useCreateScenario,
  useAddScenarioPackage,
  useReorderScenarioPackages,
} from '@/hooks/useScenarioQueries';
import { useVePackages } from '@/hooks/useSandboxQueries';
import { useOpportunities, useAllProjectOptions } from '@/hooks/useOpportunityQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { calculateBudgetMetrics } from '@/utils/financialMath';
import type { PackageScopeConfig } from '@/types/models';
import type { VePackageWithItems } from '@/types/sandbox';

interface ScenarioPlannerViewProps {
  projectId: string;
}

// DnD discriminated union for type-safe drag data
interface BankPackageData { type: 'bank-package'; pkg: VePackageWithItems }
interface ScenarioCellData { type: 'scenario-cell'; pkg: VePackageWithItems; scenarioId: string }
interface ScenarioColumnDropData { type: 'scenario-column'; scenarioId: string }
type DndItemData = BankPackageData | ScenarioCellData | ScenarioColumnDropData;

function asDndData(data: Record<string, unknown> | undefined): DndItemData | null {
  if (!data || typeof data.type !== 'string') return null;
  return data as unknown as DndItemData;
}

// DR-DND-2: Lightweight ghost card for DragOverlay (no hooks, no state)
function DragGhostCard({ pkg }: { pkg: VePackageWithItems }) {
  return (
    <div className="w-64 px-3 py-3 rounded-xl border-2 border-sky-400 bg-white dark:bg-slate-900 shadow-xl ring-2 ring-sky-400/20 flex items-center gap-2 cursor-grabbing">
      <div
        className="w-1.5 h-8 rounded-full shrink-0"
        style={{ backgroundColor: `var(--color-${pkg.color}-500, #8b5cf6)` }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Package size={12} className="text-sky-500 shrink-0" />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {pkg.name}
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          {pkg.items.length} item{pkg.items.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export function ScenarioPlannerView({ projectId }: ScenarioPlannerViewProps) {
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Data fetching
  const { data: scenarios = [], isLoading: scenariosLoading } = useVeScenarios(projectId);
  const { data: packages = [] } = useVePackages(projectId);
  const { data: opportunities = [] } = useOpportunities(projectId);
  const { data: allOptions = [] } = useAllProjectOptions(projectId);
  const { data: settings } = useProjectSettings(projectId);

  const createScenario = useCreateScenario(projectId);
  const addPackage = useAddScenarioPackage(projectId);
  const reorderPackages = useReorderScenarioPackages(projectId);

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

  // Packages lookup for DragOverlay
  const packagesById = useMemo(() => new Map(packages.map(p => [p.id, p])), [packages]);

  const isLoading = scenariosLoading;

  // ========================================================================
  // DnD
  // ========================================================================
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // DR-DND-8: Resolve target scenario from either column or cell drop target
  const resolveTargetScenario = useCallback((over: Over): string | null => {
    const data = asDndData(over.data.current as Record<string, unknown> | undefined);
    if (!data) return null;
    if (data.type === 'scenario-column') return data.scenarioId;
    if (data.type === 'scenario-cell') return data.scenarioId;
    return null;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null); // DR-DND-2: clear overlay

    const { active, over } = event;
    if (!over) return;

    const activeData = asDndData(active.data.current as Record<string, unknown> | undefined);
    const overData = asDndData(over.data.current as Record<string, unknown> | undefined);
    if (!activeData || !overData) return; // DR-DND-3: null guard

    // Case 1: Bank package → Scenario column or cell
    if (activeData.type === 'bank-package') {
      const targetScenarioId = resolveTargetScenario(over);
      if (targetScenarioId) {
        // DR-DND-6: duplicate guard
        const scenario = scenarios.find(s => s.id === targetScenarioId);
        if (scenario?.scenarioPackages.some(sp => sp.package_id === activeData.pkg.id)) {
          toast.info('Package already in this scenario');
          return;
        }
        addPackage.mutate({ scenarioId: targetScenarioId, packageId: activeData.pkg.id });
      }
      return;
    }

    // Case 2: Scenario cell → reorder or cross-column copy
    if (activeData.type === 'scenario-cell') {
      const targetScenarioId = resolveTargetScenario(over);
      if (!targetScenarioId) return;
      const sourcePkg = activeData.pkg;

      if (activeData.scenarioId === targetScenarioId) {
        // Within-column reorder
        if (overData.type !== 'scenario-cell') return; // dropped on column bg, no reorder target
        const scenario = scenarios.find(s => s.id === activeData.scenarioId);
        if (!scenario) return;
        const ids = [...scenario.scenarioPackages]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(sp => sp.package_id);
        const oldIndex = ids.indexOf(sourcePkg.id);
        const overPkg = overData.pkg;
        const newIndex = ids.indexOf(overPkg.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove(ids, oldIndex, newIndex);
        reorderPackages.mutate({ scenarioId: activeData.scenarioId, orderedPackageIds: reordered });
      } else {
        // Cross-column copy
        const targetScenario = scenarios.find(s => s.id === targetScenarioId);
        if (targetScenario?.scenarioPackages.some(sp => sp.package_id === sourcePkg.id)) {
          toast.info('Package already in this scenario');
          return;
        }
        addPackage.mutate({ scenarioId: targetScenarioId, packageId: sourcePkg.id });
      }
    }
  }, [scenarios, addPackage, reorderPackages, resolveTargetScenario]);

  // Resolve the active drag item's package for DragOverlay
  const activePkg = useMemo(() => {
    if (!activeId) return null;
    // Bank item: id = "bank::${pkgId}"
    if (activeId.startsWith('bank::')) {
      const pkgId = activeId.slice(6);
      return packagesById.get(pkgId) ?? null;
    }
    // Scenario cell: id = "${scenarioId}::${pkgId}"
    const parts = activeId.split('::');
    if (parts.length === 2) {
      return packagesById.get(parts[1]) ?? null;
    }
    return null;
  }, [activeId, packagesById]);

  // Click-add handler for the bank panel (DR-DND-6: duplicate guard)
  const handleBankClickAdd = useCallback((packageId: string) => {
    if (!selectedScenarioId) return;
    const scenario = scenarios.find(s => s.id === selectedScenarioId);
    if (scenario?.scenarioPackages.some(sp => sp.package_id === packageId)) {
      toast.info('Package already in this scenario');
      return;
    }
    addPackage.mutate({ scenarioId: selectedScenarioId, packageId });
  }, [selectedScenarioId, scenarios, addPackage]);

  const handleOpenBank = useCallback(() => {
    setIsBankOpen(true);
  }, []);

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
                onClick={() => setIsBankOpen(!isBankOpen)}
              >
                <Archive size={14} className="mr-1.5" />
                {isBankOpen ? 'Close Bank' : 'Package Bank'}
              </Button>
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

      {/* Main content — DndContext wraps both columns + bank (DR-DND-5) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners} // DR-DND-1
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden">
          {/* Scenario columns */}
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
                    allOptions={allOptions ?? []}
                    originalBudget={originalBudget}
                    canEdit={canEdit}
                    baselineMetrics={baselineMetrics}
                    scopeLabelsById={scopeLabelsById}
                    projectId={projectId}
                    isSelected={selectedScenarioId === scenario.id}
                    onSelect={() => setSelectedScenarioId(prev => prev === scenario.id ? null : scenario.id)}
                    onOpenBank={handleOpenBank}
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

          {/* Package Bank (right side, inside DndContext — DR-DND-5) */}
          <PackageBankPanel
            isOpen={isBankOpen}
            onClose={() => setIsBankOpen(false)}
            projectId={projectId}
            packages={packages}
            scopeLabelsById={scopeLabelsById}
            scenarios={scenarios}
            selectedScenarioId={selectedScenarioId}
            canEdit={canEdit}
            onClickAdd={handleBankClickAdd}
          />
        </div>

        {/* DragOverlay — DR-DND-2 */}
        <DragOverlay>
          {activePkg ? <DragGhostCard pkg={activePkg} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Scope manager modal */}
      <ScopeManagerModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}
