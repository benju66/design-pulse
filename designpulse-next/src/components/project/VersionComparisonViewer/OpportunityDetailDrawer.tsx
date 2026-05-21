"use client";

import { useRef, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ExpandedCard } from '@/components/opportunities/ExpandedCard';
import type { Opportunity } from '@/types/models';
import type { Row } from '@tanstack/react-table';

interface OpportunityDetailDrawerProps {
  projectId: string;
  opportunities: Opportunity[];
}

export function OpportunityDetailDrawer({ projectId, opportunities }: OpportunityDetailDrawerProps) {
  const selectedOpportunityId = useUIStore((s) => s.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore((s) => s.setSelectedOpportunityId);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isOpen = !!selectedOpportunityId && opportunities.some(o => o.id === selectedOpportunityId);
  const opportunity = opportunities.find(o => o.id === selectedOpportunityId);

  // Keyboard and click-outside listners using native events
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setSelectedOpportunityId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedOpportunityId(null);
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
  }, [isOpen, setSelectedOpportunityId]);

  if (!isOpen || !opportunity) return null;

  // Create standard TanStack row representation for ExpandedCard compliance
  const mockRow = { original: opportunity } as Row<Opportunity>;

  return (
    <>
      {/* Backdrop blur overlay */}
      <div
        className="absolute inset-0 bg-slate-900/15 dark:bg-slate-950/40 backdrop-blur-[3px] transition-opacity duration-200 z-[59] rounded-xl"
        onClick={() => setSelectedOpportunityId(null)}
      />

      {/* Drawer Container */}
      <div
        ref={drawerRef}
        className="absolute top-0 right-0 h-full w-full sm:w-[32rem] md:w-[44rem] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-[60] flex flex-col rounded-r-xl transform transition-transform duration-200 ease-in-out overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-sky-500 dark:text-sky-400 tracking-widest uppercase font-mono block mb-0.5">
                Opportunity Details
              </span>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate pr-4">
                {opportunity.title || 'Untitled Opportunity'}
              </h4>
            </div>
            {opportunity.display_id && (
              <span className="shrink-0 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {opportunity.display_id}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(`/project/${projectId}/item/${opportunity.id}`, '_blank')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Pop-out in new window"
            >
              <ExternalLink size={16} />
            </button>
            <button
              onClick={() => setSelectedOpportunityId(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Close Drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Pane */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 min-h-0 w-full relative">
          <div className="p-1 h-full">
            <ExpandedCard row={mockRow} />
          </div>
        </div>
      </div>
    </>
  );
}
