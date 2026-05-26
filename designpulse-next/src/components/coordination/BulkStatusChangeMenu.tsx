'use client';

import { useState, useRef, useEffect } from 'react';
import { ListTodo, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

interface BulkStatusChangeMenuProps {
  selectedCount: number;
  onStatusSelect: (status: string) => Promise<void>;
  isUpdating: boolean;
}

const COORDINATION_STATUSES = [
  { value: 'Draft', label: 'Draft', colorClass: 'bg-slate-400 dark:bg-slate-500' },
  { value: 'In Drafting', label: 'In Drafting', colorClass: 'bg-amber-500' },
  { value: 'Ready for Review', label: 'Ready for Review', colorClass: 'bg-purple-500' },
  { value: 'Implemented', label: 'Implemented', colorClass: 'bg-emerald-500' },
  { value: 'Not Applicable', label: 'Not Applicable', colorClass: 'bg-slate-300 dark:bg-slate-600 border border-slate-400 dark:border-slate-500' },
];

export function BulkStatusChangeMenu({
  selectedCount,
  onStatusSelect,
  isUpdating,
}: BulkStatusChangeMenuProps) {
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

  const handleSelect = async (status: string) => {
    setIsOpen(false);
    await onStatusSelect(status);
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
        <ListTodo size={14} />
        <span>Change Status</span>
        <ChevronDown
          size={12}
          className={cn('transition-transform duration-200 shrink-0', isOpen && 'rotate-180')}
        />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 md:left-0 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 min-w-[190px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Set Status To:
          </div>
          <div className="border-b border-slate-100 dark:border-slate-700/60 my-1" />
          
          <div className="flex flex-col">
            {COORDINATION_STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => handleSelect(status.value)}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', status.colorClass)} />
                <span>{status.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
