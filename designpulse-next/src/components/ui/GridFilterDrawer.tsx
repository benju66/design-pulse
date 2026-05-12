"use client";
import { useRef, useEffect, type ReactNode } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';

interface GridFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeCount: number;
  onClearAll: () => void;
  children: ReactNode;
}

export function GridFilterDrawer({ isOpen, onClose, activeCount, onClearAll, children }: GridFilterDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // AGENTS.md C16: native mousedown + containment pattern, never synthetic onClick
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop — subtle scrim over the grid signalling the drawer is active */}
      <div
        className={`absolute inset-0 bg-slate-900/20 dark:bg-slate-900/40 transition-opacity duration-300 z-[39] rounded-xl ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`absolute top-0 right-0 h-full w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-[40] flex flex-col rounded-r-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shrink-0 rounded-tr-xl">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Filters</span>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold text-white bg-sky-500 rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — filter controls stacked vertically */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5">
            {children}
          </div>
        </div>

        {/* Footer — only visible when filters are active */}
        {activeCount > 0 && (
          <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 rounded-br-xl">
            <button
              onClick={onClearAll}
              className="w-full px-3 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors border border-rose-200 dark:border-rose-800/50"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}
