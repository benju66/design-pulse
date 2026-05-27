'use client';

import { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { CoordGroupConfig } from '@/types/models';

interface BulkGroupAssignMenuProps {
  selectedCount: number;
  coordGroups: CoordGroupConfig[];
  onGroupSelect: (groupId: string | null) => Promise<void>;
  isUpdating: boolean;
}

export function BulkGroupAssignMenu({
  selectedCount,
  coordGroups,
  onGroupSelect,
  isUpdating,
}: BulkGroupAssignMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [isOpen]);

  const handleSelect = async (groupId: string | null) => {
    setIsOpen(false);
    await onGroupSelect(groupId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        disabled={isUpdating || selectedCount === 0}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 shadow-none"
      >
        <Layers size={14} />
        <span>Assign Group</span>
        <ChevronDown
          size={12}
          className={cn('transition-transform duration-200 shrink-0', isOpen && 'rotate-180')}
        />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 md:left-0 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 min-w-[190px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Set Group To:
          </div>
          <div className="border-b border-slate-100 dark:border-slate-700/60 my-1" />

          <div className="flex flex-col">
            {/* Remove from group */}
            <button
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-rose-500 transition-colors"
            >
              <X size={12} className="shrink-0" />
              <span>Remove from group</span>
            </button>

            {coordGroups.length > 0 && (
              <div className="border-b border-slate-100 dark:border-slate-700/60 my-1" />
            )}

            {/* Group list */}
            {coordGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleSelect(group.id)}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <span>{group.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
