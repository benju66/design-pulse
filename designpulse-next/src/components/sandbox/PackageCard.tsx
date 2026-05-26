'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical, ChevronDown, ChevronUp, Trash2, Copy, Palette, Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { VePackageWithItems } from '@/types/sandbox';
import type { Opportunity, OpportunityOption } from '@/types/models';
import { useSandboxMetrics } from '@/hooks/useSandboxMetrics';
import { useRemovePackageItem, useSetAssumedOption, useUpdatePackage, useDeletePackage, useDuplicatePackage } from '@/hooks/useSandboxQueries';
import { PackageItemRow } from './PackageItemRow';

interface PackageCardProps {
  pkg: VePackageWithItems;
  projectId: string;
  canEdit: boolean;
  allOpportunities: Opportunity[];
  allOptions: OpportunityOption[];
  originalBudget: number;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}

const COLOR_BORDER: Record<string, string> = {
  violet: 'border-l-violet-500', blue: 'border-l-blue-500', emerald: 'border-l-emerald-500',
  rose: 'border-l-rose-500', amber: 'border-l-amber-500', cyan: 'border-l-cyan-500',
};
const COLOR_RING: Record<string, string> = {
  violet: 'ring-violet-400', blue: 'ring-blue-400', emerald: 'ring-emerald-400',
  rose: 'ring-rose-400', amber: 'ring-amber-400', cyan: 'ring-cyan-400',
};
const COLOR_DOT: Record<string, string> = {
  violet: 'bg-violet-500', blue: 'bg-blue-500', emerald: 'bg-emerald-500',
  rose: 'bg-rose-500', amber: 'bg-amber-500', cyan: 'bg-cyan-500',
};
const COLORS = ['violet', 'blue', 'emerald', 'rose', 'amber', 'cyan'];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export function PackageCard({
  pkg, projectId, canEdit, allOpportunities, allOptions, originalBudget,
  isActive, onActivate, onDeactivate,
}: PackageCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(pkg.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const metrics = useSandboxMetrics(projectId, pkg.items, allOpportunities, allOptions);
  const removeItem = useRemovePackageItem(projectId);
  const setAssumedOption = useSetAssumedOption(projectId);
  const updatePkg = useUpdatePackage(projectId);
  const deletePkg = useDeletePackage(projectId);
  const duplicatePkg = useDuplicatePackage(projectId);

  // Click-outside handler for kebab menu
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setIsColorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMenuOpen]);

  // Focus rename input
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== pkg.name) {
      updatePkg.mutate({ id: pkg.id, updates: { name: trimmed } });
    }
    setIsRenaming(false);
  }, [renameValue, pkg.name, pkg.id, updatePkg]);

  const revisedBudget = originalBudget + metrics.totals.netImpact;

  return (
    <div
      className={cn(
        'rounded-xl border border-l-4 shadow-sm transition-all',
        'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        COLOR_BORDER[pkg.color] || 'border-l-violet-500',
        isActive && `ring-2 shadow-md ${COLOR_RING[pkg.color] || 'ring-violet-400'}`,
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => {
          if (isActive) { onDeactivate(); } else { onActivate(); }
        }}
      >
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setRenameValue(pkg.name); setIsRenaming(false); } }}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-sky-500 outline-none flex-1 min-w-0 px-0 py-0"
          />
        ) : (
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
            {pkg.name}
          </span>
        )}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
          ({pkg.items.length})
        </span>

        {canEdit && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <MoreVertical size={14} className="text-slate-400" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[180px]">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setIsMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <Pencil size={12} /> Rename
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsColorMenuOpen(!isColorMenuOpen); }}
                    className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    <Palette size={12} /> Change Color
                  </button>
                  {isColorMenuOpen && (
                    <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 flex gap-1.5">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          onClick={(e) => { e.stopPropagation(); updatePkg.mutate({ id: pkg.id, updates: { color: c } }); setIsMenuOpen(false); setIsColorMenuOpen(false); }}
                          className={cn('w-5 h-5 rounded-full transition-transform hover:scale-125', COLOR_DOT[c], c === pkg.color && 'ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-800')}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicatePkg.mutate(pkg); setIsMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <Copy size={12} /> Duplicate
                </button>
                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); deletePkg.mutate(pkg.id); setIsMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
        >
          {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>
      </div>

      {/* Body: items list */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-700/50">
          {metrics.items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              {canEdit ? 'Select grid rows and click "Add to Package"' : 'No items in this package'}
            </div>
          ) : (
            metrics.items.map(item => (
              <PackageItemRow
                key={item.packageItemId}
                item={item}
                canEdit={canEdit}
                onRemove={() => removeItem.mutate(item.packageItemId)}
                onSetAssumedOption={(optId) => setAssumedOption.mutate({ packageItemId: item.packageItemId, assumedOptionId: optId })}
              />
            ))
          )}
        </div>
      )}

      {/* Footer: financial summary */}
      {isExpanded && metrics.items.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700/50 px-3 py-2 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-xl">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-500">{metrics.items.length} items</span>
            <span className={cn(
              'font-bold tabular-nums',
              metrics.totals.netImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
              metrics.totals.netImpact > 0 ? 'text-rose-600 dark:text-rose-400' :
              'text-slate-400 dark:text-slate-500'
            )}>
              Net: {metrics.totals.netImpact > 0 ? '+' : ''}{fmt(metrics.totals.netImpact)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] mt-0.5">
            <span className="text-slate-400 dark:text-slate-500">Revised Budget</span>
            <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">{fmt(revisedBudget)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
