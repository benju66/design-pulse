'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Plus, X, GitCompareArrows, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/stores/useUIStore';
import { useOpportunities, useAllProjectOptions } from '@/hooks/useOpportunityQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { useVePackages, useCreatePackage } from '@/hooks/useSandboxQueries';
import { PackageCard } from './PackageCard';
import { PackageCompareModal } from './PackageCompareModal';

interface SandboxPanelProps {
  projectId: string;
  canEdit: boolean;
}

export function SandboxPanel({ projectId, canEdit }: SandboxPanelProps) {
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const setSandboxPanelOpen = useUIStore(state => state.setSandboxPanelOpen);
  const activeSandboxPackageId = useUIStore(state => state.activeSandboxPackageId);
  const setActiveSandboxPackageId = useUIStore(state => state.setActiveSandboxPackageId);

  // Self-fetch all data via React Query (BUG-12: no prop drilling)
  const { data: opportunities = [] } = useOpportunities(projectId);
  const { data: allOptions = [] } = useAllProjectOptions(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const originalBudget = settings ? Number(settings.original_budget) : 0;
  const { data: packages = [] } = useVePackages(projectId);

  // Scope label resolution (DR-6)
  const scopeLabelsById = useMemo(
    () => new Map((settings?.package_scopes ?? []).map(s => [s.id, s.label])),
    [settings?.package_scopes]
  );

  const createPkg = useCreatePackage(projectId);

  // Escape key to close panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't close if a modal is open or an input is focused
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLSelectElement) return;
        setSandboxPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSandboxPanelOpen]);

  // Clear active package when panel unmounts
  useEffect(() => {
    return () => setActiveSandboxPackageId(null);
  }, [setActiveSandboxPackageId]);

  const handleClose = useCallback(() => {
    setSandboxPanelOpen(false);
    setActiveSandboxPackageId(null);
  }, [setSandboxPanelOpen, setActiveSandboxPackageId]);

  return (
    <>
      <div className="w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shadow-lg transition-all duration-300 animate-in slide-in-from-right-5 fade-in">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <Package size={16} className="text-violet-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1 min-w-0">
            VE Packages
          </h2>
          {packages.length > 0 && (
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full shrink-0">
              {packages.length}
            </span>
          )}
          {!canEdit && (
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Eye size={10} /> View Only
            </span>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => createPkg.mutate({})}
              className="!p-1 !shadow-none"
              title="New Package"
            >
              <Plus size={14} />
            </Button>
          )}
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
            title="Close panel"
          >
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-800/20 flex items-center justify-center mb-3">
                <Package size={24} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                No packages yet
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 max-w-[200px]">
                Create a package and add VE items to compare different budget scenarios.
              </p>
              {canEdit && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => createPkg.mutate({})}
                >
                  <Plus size={14} />
                  Create Package
                </Button>
              )}
            </div>
          ) : (
            packages.map(pkg => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                projectId={projectId}
                canEdit={canEdit}
                allOpportunities={opportunities}
                allOptions={allOptions}
                originalBudget={originalBudget}
                isActive={activeSandboxPackageId === pkg.id}
                onActivate={() => setActiveSandboxPackageId(pkg.id)}
                onDeactivate={() => setActiveSandboxPackageId(null)}
                scopeLabel={pkg.scope_id ? scopeLabelsById.get(pkg.scope_id) : undefined}
              />
            ))
          )}
        </div>

        {/* Footer: Compare */}
        {packages.length >= 2 && (
          <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setIsCompareOpen(true)}
            >
              <GitCompareArrows size={14} />
              Compare Packages
            </Button>
          </div>
        )}
      </div>

      {/* Compare Modal */}
      <PackageCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        packages={packages}
        projectId={projectId}
        allOpportunities={opportunities}
        allOptions={allOptions}
        originalBudget={originalBudget}
      />
    </>
  );
}
