"use client";

import { Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ProjectEstimateVersion } from '@/types/models';

interface VersionChipPickerProps {
  versions: ProjectEstimateVersion[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function VersionChipPicker({
  versions,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: VersionChipPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onSelectAll}
        disabled={selectedIds.size === versions.length}
        className="text-xs font-semibold px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/60 transition-colors shrink-0"
      >
        Select All
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={selectedIds.size === 0}
        className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
      >
        Clear
      </Button>
      
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-850 shrink-0 mx-1" />
      
      {versions.map((v) => {
        const isSelected = selectedIds.has(v.id);
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onToggle(v.id)}
            disabled={selectedIds.size >= 10 && !isSelected}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all select-none shrink-0 ${
              isSelected
                ? 'bg-sky-500 dark:bg-sky-600 text-white border-sky-500 dark:border-sky-600 shadow-md shadow-sky-500/10 scale-[1.02]'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 disabled:opacity-30 disabled:scale-100'
            }`}
          >
            {isSelected && <Check size={12} strokeWidth={3} className="animate-in zoom-in duration-100 shrink-0" />}
            <span>{v.version_name}</span>
            {v.is_active && (
              <Star
                size={11}
                fill="currentColor"
                className={`shrink-0 ${isSelected ? 'text-amber-200' : 'text-amber-500 animate-pulse'}`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
