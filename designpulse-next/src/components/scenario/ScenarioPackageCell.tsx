'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { X, ChevronDown, ChevronRight, Package, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { VePackageWithItems } from '@/types/sandbox';
import type { OpportunityOption } from '@/types/models';

interface ScenarioPackageCellProps {
  pkg: VePackageWithItems;
  scenarioId: string;
  scopeLabel?: string;
  onRemove?: () => void;
  canEdit: boolean;
  optionsById: Map<string, OpportunityOption>;
  opportunitiesById: Map<string, { id: string; title: string; display_id?: string | null }>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export function ScenarioPackageCell({
  pkg,
  scenarioId,
  scopeLabel,
  onRemove,
  canEdit,
  optionsById,
  opportunitiesById,
}: ScenarioPackageCellProps) {
  const [expanded, setExpanded] = useState(false);

  // Composite ID ensures uniqueness across columns (DR-DND-3)
  const compositeId = `${scenarioId}::${pkg.id}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: compositeId,
    data: { type: 'scenario-cell', pkg, scenarioId },
    disabled: !canEdit, // DR-DND-4
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate net impact for this package
  const netImpact = pkg.items.reduce((sum, item) => {
    if (!item.assumed_option_id) return sum;
    const opt = item.assumed_option_id ? optionsById.get(item.assumed_option_id) : undefined;
    return sum + (Number(opt?.cost_impact) || 0);
  }, 0);

  const Chevron = expanded && !isDragging ? ChevronDown : ChevronRight;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl border transition-all',
        'bg-white dark:bg-slate-900/60',
        isDragging
          ? 'opacity-60 border-sky-400 dark:border-sky-500 ring-2 ring-sky-400/20 z-50 shadow-lg'
          : 'border-slate-200 dark:border-slate-800 hover:shadow-sm',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag handle */}
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors shrink-0"
            aria-label="Drag to reorder"
            aria-roledescription="sortable"
          >
            <GripVertical size={14} />
          </div>
        )}

        {/* Color bar */}
        <div
          className="w-1 h-8 rounded-full shrink-0"
          style={{ backgroundColor: `var(--color-${pkg.color}-500, #8b5cf6)` }}
        />

        {/* Expand toggle */}
        {!isDragging && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-expanded={expanded}
            aria-label="Toggle package details"
          >
            <Chevron size={14} />
          </button>
        )}

        {/* Package name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Package size={12} className="text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
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
        </div>

        {/* Net impact */}
        <span
          className={cn(
            'text-xs font-semibold shrink-0',
            netImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
            netImpact > 0 ? 'text-rose-600 dark:text-rose-400' :
            'text-slate-400'
          )}
        >
          {netImpact !== 0 ? (netImpact > 0 ? '+' : '') + fmt(netImpact) : '$0'}
        </span>

        {/* Remove button */}
        {canEdit && onRemove && !isDragging && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors p-0.5"
            aria-label="Remove package from scenario"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Expanded: item list */}
      {expanded && !isDragging && pkg.items.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 space-y-1">
          {pkg.items.map(item => {
            const opp = opportunitiesById.get(item.opportunity_id);
            const opt = item.assumed_option_id ? optionsById.get(item.assumed_option_id) : undefined;
            return (
              <div key={item.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400 font-mono shrink-0">{opp?.display_id || '—'}</span>
                <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{opp?.title || 'Unknown'}</span>
                {opt && (
                  <span className="text-sky-600 dark:text-sky-400 shrink-0 truncate max-w-[100px]">
                    → {opt.title || 'Option'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
