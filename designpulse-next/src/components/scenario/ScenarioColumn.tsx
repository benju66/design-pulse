'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { MoreVertical, Copy, Trash2, Plus, Shield, Pencil, Check, X } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/Button';
import { BudgetMetricsBar } from '@/components/ui/BudgetMetricsBar';
import { ScenarioPackageCell } from './ScenarioPackageCell';
import { ApplyScenarioModal } from './ApplyScenarioModal';
import {
  useUpdateScenario,
  useDeleteScenario,
  useDuplicateScenario,
  useRemoveScenarioPackage,
} from '@/hooks/useScenarioQueries';
import { calculateScenarioBudgetMetrics } from '@/utils/financialMath';
import type { BudgetMetrics } from '@/utils/financialMath';
import type { VeScenarioWithPackages } from '@/types/scenario';
import type { VePackageWithItems } from '@/types/sandbox';
import type { OpportunityOption } from '@/types/models';

interface ScenarioColumnProps {
  scenario: VeScenarioWithPackages;
  packages: VePackageWithItems[];
  opportunities: Array<{ id: string; status: string | null; cost_impact: number | null; title: string; display_id?: string | null }>;
  allOptions: OpportunityOption[];
  originalBudget: number;
  canEdit: boolean;
  baselineMetrics: BudgetMetrics;
  scopeLabelsById: Map<string, string>;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onOpenBank: () => void;
}

export function ScenarioColumn({
  scenario,
  packages,
  opportunities,
  allOptions,
  originalBudget,
  canEdit,
  baselineMetrics,
  scopeLabelsById,
  projectId,
  isSelected,
  onSelect,
  onOpenBank,
}: ScenarioColumnProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(scenario.name);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside handler for kebab menu (Rule C16 compliant)
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMenuOpen]);

  const updateScenario = useUpdateScenario(projectId);
  const deleteScenario = useDeleteScenario(projectId);
  const duplicateScenario = useDuplicateScenario(projectId);
  const removePackage = useRemoveScenarioPackage(projectId);

  // Droppable target for the column body
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: scenario.id,
    data: { type: 'scenario-column', scenarioId: scenario.id },
  });

  // Build packages lookup
  const packagesById = useMemo(() => new Map(packages.map(p => [p.id, p])), [packages]);

  // Build lookup Maps for child cells — O(n) once, O(1) lookups
  const optionsById = useMemo(() => new Map(allOptions.map(o => [o.id, o])), [allOptions]);
  const opportunitiesById = useMemo(
    () => new Map(opportunities.map(o => [o.id, o])),
    [opportunities]
  );

  // Assigned packages in sort order
  const assignedPackages = useMemo(() => {
    return [...scenario.scenarioPackages]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(sp => packagesById.get(sp.package_id))
      .filter((p): p is VePackageWithItems => !!p);
  }, [scenario.scenarioPackages, packagesById]);

  // Sortable IDs — composite for cross-column uniqueness
  const sortableIds = useMemo(
    () => assignedPackages.map(p => `${scenario.id}::${p.id}`),
    [assignedPackages, scenario.id],
  );

  // DR-2: Build overrides Map with first-package-wins
  const overrides = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...scenario.scenarioPackages].sort((a, b) => a.sort_order - b.sort_order);
    for (const sp of sorted) {
      const pkg = packagesById.get(sp.package_id);
      if (!pkg) continue;
      for (const item of pkg.items) {
        if (item.assumed_option_id && !map.has(item.opportunity_id)) {
          map.set(item.opportunity_id, item.assumed_option_id);
        }
      }
    }
    return map;
  }, [scenario.scenarioPackages, packagesById]);

  // Calculate scenario metrics
  const scenarioMetrics = useMemo(
    () => calculateScenarioBudgetMetrics(opportunities, allOptions, originalBudget, overrides),
    [opportunities, allOptions, originalBudget, overrides]
  );

  const handleRename = useCallback(() => {
    if (editName.trim() && editName !== scenario.name) {
      updateScenario.mutate({ id: scenario.id, updates: { name: editName.trim() } });
    }
    setIsEditing(false);
  }, [editName, scenario.name, scenario.id, updateScenario]);

  const handleAddPackageClick = useCallback(() => {
    onSelect();
    onOpenBank();
  }, [onSelect, onOpenBank]);

  return (
    <>
      <div
        onClick={onSelect}
        className={cn(
          'min-w-[320px] max-w-[380px] flex flex-col rounded-2xl transition-all cursor-pointer',
          'bg-white dark:bg-slate-900',
          'shadow-sm',
          (isSelected || isApplyOpen)
            ? 'border-2 border-sky-400 dark:border-sky-500 ring-2 ring-sky-400/20 dark:ring-sky-500/20'
            : 'border border-slate-200 dark:border-slate-800',
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                className="flex-1 text-sm font-bold bg-transparent border-b border-sky-400 text-slate-800 dark:text-white focus:outline-none"
                autoFocus
              />
              <button onClick={handleRename} className="p-1 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300" aria-label="Save name">
                <Check size={14} />
              </button>
              <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" aria-label="Cancel rename">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">{scenario.name}</h3>
              {canEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditName(scenario.name); setIsEditing(true); }}
                  className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-sky-500 transition-colors shrink-0"
                  aria-label="Rename scenario"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
          )}

          {/* Package count badge */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
            {assignedPackages.length} pkg{assignedPackages.length !== 1 ? 's' : ''}
          </span>

          {/* Kebab menu */}
          {canEdit && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
                aria-label="Scenario actions"
              >
                <MoreVertical size={16} />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg z-10 py-1" role="menu">
                  <button
                    onClick={(e) => { e.stopPropagation(); duplicateScenario.mutate(scenario); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    role="menuitem"
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteScenario.mutate(scenario.id); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    role="menuitem"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body — droppable + sortable package list */}
        <div
          ref={setDropRef}
          className={cn(
            'flex-1 overflow-y-auto p-3 space-y-2 transition-colors',
            isOver && 'bg-sky-50/50 dark:bg-sky-900/10 border-2 border-dashed border-sky-300 dark:border-sky-700 rounded-lg',
          )}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {assignedPackages.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                {isOver ? 'Drop here to add' : 'No packages added yet'}
              </div>
            ) : (
              assignedPackages.map(pkg => (
                <ScenarioPackageCell
                  key={pkg.id}
                  pkg={pkg}
                  scenarioId={scenario.id}
                  scopeLabel={pkg.scope_id ? scopeLabelsById.get(pkg.scope_id) : undefined}
                  onRemove={() => removePackage.mutate({ scenarioId: scenario.id, packageId: pkg.id })}
                  canEdit={canEdit}
                  optionsById={optionsById}
                  opportunitiesById={opportunitiesById}
                />
              ))
            )}
          </SortableContext>

          {/* Add package button */}
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAddPackageClick(); }}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all',
                'border-slate-200 dark:border-slate-700',
                'text-slate-400 hover:text-sky-500 hover:border-sky-300 dark:hover:border-sky-700',
                'text-sm font-medium',
              )}
            >
              <Plus size={14} />
              Add Package
            </button>
          )}
        </div>

        {/* Footer — budget metrics */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2">
          <BudgetMetricsBar
            metrics={scenarioMetrics}
            originalBudget={originalBudget}
            baseline={baselineMetrics}
            compact
          />
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setIsApplyOpen(true); }}
              disabled={overrides.size === 0}
              className="w-full"
            >
              <Shield size={14} className="mr-1.5" />
              Apply Scenario ({overrides.size})
            </Button>
          )}
        </div>
      </div>

      {/* Apply modal */}
      {isApplyOpen && (
        <ApplyScenarioModal
          isOpen={isApplyOpen}
          onClose={() => setIsApplyOpen(false)}
          scenario={scenario}
          packages={assignedPackages}
          projectId={projectId}
          allOpportunities={opportunities}
        />
      )}
    </>
  );
}
