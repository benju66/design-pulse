'use client';

import { useState, useRef, useEffect } from 'react';
import { Package, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useVePackages, useAddPackageItems, useCreatePackage } from '@/hooks/useSandboxQueries';
import { useUIStore } from '@/stores/useUIStore';

interface AddToPackageMenuProps {
  projectId: string;
  selectedIds: string[];
}

const COLOR_DOT: Record<string, string> = {
  violet: 'bg-violet-500', blue: 'bg-blue-500', emerald: 'bg-emerald-500',
  rose: 'bg-rose-500', amber: 'bg-amber-500', cyan: 'bg-cyan-500',
};

export function AddToPackageMenu({ projectId, selectedIds }: AddToPackageMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: packages = [] } = useVePackages(projectId);
  const addItems = useAddPackageItems(projectId);
  const createPkg = useCreatePackage(projectId);

  // Click-outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleAddToExisting = async (packageId: string) => {
    await addItems.mutateAsync({ packageId, opportunityIds: selectedIds });
    useUIStore.getState().setSandboxPanelOpen(true);
    setIsOpen(false);
  };

  const handleCreateAndAdd = async () => {
    const newPkg = await createPkg.mutateAsync({});
    await addItems.mutateAsync({ packageId: newPkg.id, opportunityIds: selectedIds });
    useUIStore.getState().setSandboxPanelOpen(true);
    setIsOpen(false);
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Package size={14} />
        Add to Package
        <ChevronDown size={12} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          {packages.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
              No packages yet
            </div>
          ) : (
            packages.map(pkg => (
              <button
                key={pkg.id}
                onClick={() => handleAddToExisting(pkg.id)}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', COLOR_DOT[pkg.color] || 'bg-violet-500')} />
                <span className="truncate">{pkg.name}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto shrink-0">
                  ({pkg.items.length})
                </span>
              </button>
            ))
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

          <button
            onClick={handleCreateAndAdd}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-violet-600 dark:text-violet-400"
          >
            <Plus size={14} />
            Create New Package
          </button>
        </div>
      )}
    </div>
  );
}
