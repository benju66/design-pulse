'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { X, Search, Plus, Package, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAddScenarioPackage } from '@/hooks/useScenarioQueries';
import { useCreatePackage } from '@/hooks/useSandboxQueries';
import type { VePackageWithItems } from '@/types/sandbox';

interface PackageBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioId: string;
  projectId: string;
  existingPackageIds: string[];
  packages: VePackageWithItems[];
  scopeLabelsById: Map<string, string>;
}

export function PackageBuilderDrawer({
  isOpen,
  onClose,
  scenarioId,
  projectId,
  existingPackageIds,
  packages,
  scopeLabelsById,
}: PackageBuilderDrawerProps) {
  const [search, setSearch] = useState('');
  const addPackage = useAddScenarioPackage(projectId);
  const createPackage = useCreatePackage(projectId);

  // Show ALL packages (don't hide already-added ones — show them with a checkmark)
  const displayPackages = useMemo(() => {
    if (!search.trim()) return packages;
    const q = search.toLowerCase();
    return packages.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.scope_id && scopeLabelsById.get(p.scope_id)?.toLowerCase().includes(q))
    );
  }, [packages, search, scopeLabelsById]);

  const existingSet = useMemo(() => new Set(existingPackageIds), [existingPackageIds]);

  const handleAdd = (packageId: string) => {
    addPackage.mutate({ scenarioId, packageId });
  };

  const handleCreateAndAdd = async () => {
    try {
      const newPkg = await createPackage.mutateAsync({ name: 'New Package' });
      addPackage.mutate({ scenarioId, packageId: newPkg.id });
    } catch {
      // Error handled by mutation's onError
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 z-40 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Add Packages</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
          />
        </div>
      </div>

      {/* Package list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {displayPackages.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            {search ? 'No matching packages' : 'No packages available'}
          </div>
        ) : (
          displayPackages.map(pkg => {
            const isAdded = existingSet.has(pkg.id);
            return (
              <button
                key={pkg.id}
                onClick={() => !isAdded && handleAdd(pkg.id)}
                disabled={isAdded || addPackage.isPending}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left',
                  isAdded
                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 cursor-default'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50/50 dark:hover:bg-sky-900/10 active:scale-[0.99]',
                )}
              >
                <div
                  className="w-1.5 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: `var(--color-${pkg.color}-500, #8b5cf6)` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Package size={12} className={cn('shrink-0', isAdded ? 'text-emerald-500' : 'text-slate-400')} />
                    <span className={cn(
                      'text-sm font-medium truncate',
                      isAdded ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
                    )}>
                      {pkg.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400">
                      {pkg.items.length} item{pkg.items.length !== 1 ? 's' : ''}
                    </span>
                    {pkg.scope_id && scopeLabelsById.get(pkg.scope_id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {scopeLabelsById.get(pkg.scope_id)}
                      </span>
                    )}
                  </div>
                </div>
                {isAdded ? (
                  <Check size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer — create new */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateAndAdd}
          disabled={createPackage.isPending}
          className="w-full"
        >
          <Plus size={14} className="mr-1.5" />
          Create New Package
        </Button>
      </div>
    </div>
  );
}
