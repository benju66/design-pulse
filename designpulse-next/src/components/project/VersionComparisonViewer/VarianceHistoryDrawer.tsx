"use client";

import { useRef, useEffect } from 'react';
import { X, MessageSquare, Calendar, History, Loader2, AlertCircle } from 'lucide-react';
import { useVarianceHistoryByCostCode } from '@/hooks/useEstimateQueries';

interface VarianceHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  costCode: string;
  description: string;
}

export function VarianceHistoryDrawer({
  isOpen,
  onClose,
  projectId,
  costCode,
  description,
}: VarianceHistoryDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Click outside and Escape key listeners using native events (SKILL.md Rule C16)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
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

  const { data: history = [], isLoading, error } = useVarianceHistoryByCostCode(
    isOpen ? projectId : null,
    isOpen ? costCode : null
  );

  return (
    <>
      {/* Backdrop blur overlay */}
      <div
        className={`absolute inset-0 bg-slate-900/10 dark:bg-slate-950/30 backdrop-blur-[2px] transition-opacity duration-200 z-[49] rounded-xl ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Container */}
      <div
        ref={drawerRef}
        className={`absolute top-0 right-0 h-full w-[26rem] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-[50] flex flex-col rounded-r-xl transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 shrink-0 rounded-tr-xl">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-50 dark:bg-sky-950/50 text-sky-500 rounded-lg shrink-0">
              <History size={16} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                Forensic History
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase font-mono">
                {costCode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Close Drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info Box */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/10 shrink-0">
          <span className="text-[10px] font-bold text-sky-500 dark:text-sky-400 tracking-wider uppercase block mb-0.5">
            Description
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed truncate" title={description}>
            {description}
          </p>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2.5 text-slate-400 dark:text-slate-500">
              <Loader2 size={24} className="animate-spin text-sky-500" />
              <span className="text-xs font-semibold">Retrieving audit timeline…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-rose-500 text-center p-4">
              <AlertCircle size={24} className="opacity-80" />
              <span className="text-xs font-bold">Failed to load history</span>
              <span className="text-[10px] opacity-75">{error.message}</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-500 italic text-center p-6">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-full text-slate-300 dark:text-slate-600">
                <MessageSquare size={28} />
              </div>
              <p className="text-xs font-medium max-w-[18rem] leading-relaxed">
                No variance notes have been recorded for this item in any estimate versions.
              </p>
            </div>
          ) : (
            <div className="relative border-l border-slate-200 dark:border-slate-800 pl-4 space-y-6 py-2">
              {history.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Timeline bullet dot */}
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-600 border border-white dark:border-slate-900 group-hover:scale-125 transition-transform" />

                  {/* Note block */}
                  <div className="space-y-1.5">
                    {/* Milestones Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.version_name}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">
                        <Calendar size={10} />
                        {new Date(item.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Note Content */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {item.variance_note}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
