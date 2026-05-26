'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { X, Search, Plus, Package, GripVertical, Check } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/Button';
import { useCreatePackage } from '@/hooks/useSandboxQueries';
import type { VePackageWithItems } from '@/types/sandbox';
import type { VeScenarioWithPackages } from '@/types/scenario';

const EMPTY_DOTS: never[] = [];

interface PackageBankPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  packages: VePackageWithItems[];
  scopeLabelsById: Map<string, string>;
  scenarios: VeScenarioWithPackages[];
  selectedScenarioId: string | null;
  canEdit: boolean;
  onClickAdd: (packageId: string) => void;
}

// DR-DND-7: Bank items use useDraggable (NOT useSortable) — no SortableContext wrapper
function DraggablePackageCard({
  pkg,
  scopeLabel,
  isInSelected,
  scenarioDots,
  canDrag,
  canClick,
  onClickAdd,
}: {
  pkg: VePackageWithItems;
  scopeLabel?: string;
  isInSelected: boolean;
  scenarioDots: Array<{ name: string; color: string }>;
  canDrag: boolean;
  canClick: boolean;
  onClickAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bank::${pkg.id}`,
    data: { type: 'bank-package', pkg },
    disabled: !canDrag,
  });



  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 px-3 py-3 rounded-xl border transition-all text-left',
        isDragging
          ? 'opacity-40 border-sky-400 dark:border-sky-600 ring-2 ring-sky-400/20'
          : isInSelected
            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
      )}
    >
      {/* Drag handle */}
      {canDrag && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors shrink-0"
          aria-label="Drag to add to scenario"
        >
          <GripVertical size={14} />
        </div>
      )}

      {/* Click area */}
      <button
        onClick={canClick && !isInSelected ? onClickAdd : undefined}
        disabled={!canClick || isInSelected}
        className={cn(
          'flex-1 flex items-center gap-2 min-w-0 text-left',
          canClick && !isInSelected ? 'cursor-pointer' : 'cursor-default',
        )}
        title={!canClick ? 'Select a scenario first' : isInSelected ? 'Already in selected scenario' : `Add to scenario`}
      >
        <div
          className="w-1.5 h-10 rounded-full shrink-0"
          style={{ backgroundColor: `var(--color-${pkg.color}-500, #8b5cf6)` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Package size={12} className={cn('shrink-0', isInSelected ? 'text-emerald-500' : 'text-slate-400')} />
            <span className={cn(
              'text-sm font-medium truncate',
              isInSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200',
            )}>
              {pkg.name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">
              {pkg.items.length} item{pkg.items.length !== 1 ? 's' : ''}
            </span>
            {scopeLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {scopeLabel}
              </span>
            )}

          </div>
          {/* Scenario dots */}
          {scenarioDots.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {scenarioDots.map((dot, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                  title={dot.name}
                >
                  {dot.name.length > 8 ? dot.name.slice(0, 8) + '…' : dot.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Status icon */}
      {isInSelected ? (
        <Check size={14} className="text-emerald-500 shrink-0" />
      ) : null}
    </div>
  );
}

export function PackageBankPanel({
  isOpen,
  onClose,
  projectId,
  packages,
  scopeLabelsById,
  scenarios,
  selectedScenarioId,
  canEdit,
  onClickAdd,
}: PackageBankPanelProps) {
  const [search, setSearch] = useState('');
  const createPackage = useCreatePackage(projectId);

  const selectedScenario = selectedScenarioId
    ? scenarios.find(s => s.id === selectedScenarioId)
    : null;

  const selectedPkgIds = useMemo(
    () => new Set(selectedScenario?.scenarioPackages.map(sp => sp.package_id) ?? []),
    [selectedScenario],
  );

  // Build scenario-dots map: which scenarios contain each package
  const scenarioDotsMap = useMemo(() => {
    const map = new Map<string, Array<{ name: string; color: string }>>();
    for (const s of scenarios) {
      for (const sp of s.scenarioPackages) {
        const dots = map.get(sp.package_id) || [];
        dots.push({ name: s.name, color: 'violet' });
        map.set(sp.package_id, dots);
      }
    }
    return map;
  }, [scenarios]);

  const displayPackages = useMemo(() => {
    if (!search.trim()) return packages;
    const q = search.toLowerCase();
    return packages.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.scope_id && scopeLabelsById.get(p.scope_id)?.toLowerCase().includes(q))
    );
  }, [packages, search, scopeLabelsById]);

  if (!isOpen) return null;

  return (
    <div className="w-80 shrink-0 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">Package Bank</h3>
          {selectedScenario && (
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium truncate block">
              Click adds to: {selectedScenario.name}
            </span>
          )}
          {!selectedScenario && (
            <span className="text-[10px] text-slate-400 block">
              Select a scenario or drag to add
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Close package bank"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search packages…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            aria-label="Search packages"
          />
        </div>
      </div>

      {/* Package list — NO SortableContext (DR-DND-7) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {displayPackages.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            {search ? 'No matching packages' : 'No packages available'}
          </div>
        ) : (
          displayPackages.map(pkg => (
            <DraggablePackageCard
              key={pkg.id}
              pkg={pkg}
              scopeLabel={pkg.scope_id ? scopeLabelsById.get(pkg.scope_id) : undefined}
              isInSelected={selectedPkgIds.has(pkg.id)}
              scenarioDots={scenarioDotsMap.get(pkg.id) || EMPTY_DOTS}
              canDrag={canEdit}
              canClick={canEdit && !!selectedScenarioId}
              onClickAdd={() => onClickAdd(pkg.id)}
            />
          ))
        )}
      </div>

      {/* Footer — create new */}
      {canEdit && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={() => createPackage.mutate({ name: 'New Package' })}
            disabled={createPackage.isPending}
            className="w-full"
          >
            <Plus size={14} className="mr-1.5" />
            Create New Package
          </Button>
        </div>
      )}
    </div>
  );
}
