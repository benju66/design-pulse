'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, Palette, CheckSquare, Trash2, Check, X } from 'lucide-react';
import { CoordGroupConfig } from '@/types/models';
import { COORD_GROUP_COLORS } from '@/lib/constants';
import { cn } from '@/lib/cn';

interface GroupContextMenuProps {
  group: CoordGroupConfig;
  onRename: (newLabel: string) => void;
  onColorChange: (newColor: string) => void;
  onSelectAll: () => void;
  onDelete: () => void;
}

type MenuMode = 'menu' | 'rename' | 'color';

export function GroupContextMenu({
  group,
  onRename,
  onColorChange,
  onSelectAll,
  onDelete,
}: GroupContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<MenuMode>('menu');
  const [renameValue, setRenameValue] = useState(group.label);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click-outside: useRef containment + mousedown (guardrail 16)
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setMode('menu');
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Auto-focus rename input
  useEffect(() => {
    if (mode === 'rename' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [mode]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    setMode('menu');
    setRenameValue(group.label);
  };

  const handleRenameConfirm = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== group.label) {
      onRename(trimmed);
    }
    setIsOpen(false);
    setMode('menu');
  };

  const close = () => {
    setIsOpen(false);
    setMode('menu');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-150"
          onClick={e => e.stopPropagation()}
        >
          {mode === 'menu' && (
            <div className="flex flex-col">
              <button
                onClick={() => { setMode('rename'); setRenameValue(group.label); }}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Pencil size={12} />
                <span>Rename</span>
              </button>
              <button
                onClick={() => setMode('color')}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Palette size={12} />
                <span>Change Color</span>
              </button>
              <button
                onClick={() => { onSelectAll(); close(); }}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <CheckSquare size={12} />
                <span>Select All</span>
              </button>
              <div className="border-b border-slate-100 dark:border-slate-700/60 my-1" />
              <button
                onClick={() => { onDelete(); close(); }}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-rose-500 transition-colors"
              >
                <Trash2 size={12} />
                <span>Delete Group</span>
              </button>
            </div>
          )}

          {mode === 'rename' && (
            <div className="px-3 py-2 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Rename Group
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameConfirm();
                    if (e.key === 'Escape') setMode('menu');
                  }}
                  className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                <button
                  onClick={handleRenameConfirm}
                  disabled={!renameValue.trim()}
                  className="p-1 rounded text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-40 transition-colors"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setMode('menu')}
                  className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {mode === 'color' && (
            <div className="px-3 py-2 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Choose Color
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {COORD_GROUP_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => { onColorChange(color); close(); }}
                    className={cn(
                      'w-6 h-6 rounded-full transition-all ring-2 ring-white dark:ring-slate-800',
                      color === group.color && 'ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-800'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
