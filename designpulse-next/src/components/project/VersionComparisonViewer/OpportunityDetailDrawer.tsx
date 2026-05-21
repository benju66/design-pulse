"use client";

import { useRef, useEffect, useState, useMemo } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ExpandedCard } from '@/components/opportunities/ExpandedCard';
import { BudgetDetailView } from '@/components/opportunities/BudgetDetailView';
import { formatCostCode } from '@/lib/formatCostCode';
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

  const [activeTab, setActiveTab] = useState<'ve' | 'budget'>('ve');

  const normalizeCode = (c: string) => {
    if (!c) return '';
    const dotIdx = c.indexOf('.');
    const base = dotIdx !== -1 ? c.slice(0, dotIdx) : c;
    return base.replace(/[^0-9]/g, '').padStart(6, '0');
  };

  // Derive target opportunity and cost code information
  const isBudgetRow = !!selectedOpportunityId?.startsWith('budget-');
  const budgetCostCode = isBudgetRow ? selectedOpportunityId!.slice(7) : null;
  const opportunity = isBudgetRow ? null : opportunities.find(o => o.id === selectedOpportunityId);
  const costCode = isBudgetRow ? budgetCostCode : (opportunity?.cost_code || null);

  const isOpen = !!selectedOpportunityId && (isBudgetRow || !!opportunity);

  // Transition State Preservation to prevent visual blank flash on close animation
  const [activeOpportunity, setActiveOpportunity] = useState<Opportunity | null>(null);
  const [activeCostCode, setActiveCostCode] = useState<string | null>(null);
  const [activeIsBudgetRow, setActiveIsBudgetRow] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setActiveOpportunity(opportunity || null);
      setActiveCostCode(costCode || null);
      setActiveIsBudgetRow(isBudgetRow);
    }
  }, [isOpen, opportunity, costCode, isBudgetRow]);

  // Reset tab selection to opportunity details tab upon row selection changes
  useEffect(() => {
    setActiveTab('ve');
  }, [selectedOpportunityId]);

  // Keyboard and click-outside listeners using native events and portal guards
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || drawerRef.current?.contains(target)) return;
      
      // Portal check to prevent drawer close when clicking menus, selects, or toast calendars
      if (
        target.closest('[data-sonner-toaster]') || 
        target.closest('.radix-themes') ||
        target.closest('[role="listbox"]') ||
        target.closest('[role="menu"]') ||
        target.closest('.flatpickr-calendar') ||
        target.closest('[data-radix-portal]') ||
        target.closest('[role="dialog"]')
      ) return;

      setSelectedOpportunityId(null);
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

  // Map linked opportunities to active cost code to drive the VE Reconciled ledger in BudgetDetailView
  const linkedOpportunities = useMemo(() => {
    if (!activeCostCode) return [];
    const normTarget = normalizeCode(activeCostCode);
    return opportunities.filter(
      (o) => o.cost_code && normalizeCode(o.cost_code) === normTarget
    );
  }, [activeCostCode, opportunities]);

  // Generate standard TanStack row representation for ExpandedCard compliance
  const mockRow = useMemo(() => {
    if (!activeOpportunity) return null;
    return { original: activeOpportunity } as Row<Opportunity>;
  }, [activeOpportunity]);

  return (
    <>
      {/* Backdrop blur overlay */}
      <div
        className={`absolute inset-0 bg-slate-900/15 dark:bg-slate-950/40 backdrop-blur-[3px] transition-opacity duration-200 z-[59] rounded-xl ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSelectedOpportunityId(null)}
      />

      {/* Drawer Container */}
      <div
        ref={drawerRef}
        className={`absolute top-0 right-0 h-full w-full sm:w-[32rem] md:w-[44rem] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-[60] flex flex-col rounded-r-xl transform transition-transform duration-200 ease-in-out overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-sky-500 dark:text-sky-400 tracking-widest uppercase font-mono block mb-0.5">
                {activeIsBudgetRow ? 'Budget Line Details' : 'Opportunity Details'}
              </span>
              <h4
                className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate pr-4"
                title={activeIsBudgetRow ? `Cost Code ${formatCostCode(activeCostCode || '')}` : activeOpportunity?.title}
              >
                {activeIsBudgetRow
                  ? `Cost Code: ${formatCostCode(activeCostCode || '')}`
                  : (activeOpportunity?.title || 'Untitled Opportunity')}
              </h4>
            </div>
            {!activeIsBudgetRow && activeOpportunity?.display_id && (
              <span className="shrink-0 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {activeOpportunity.display_id}
              </span>
            )}
            {activeIsBudgetRow && activeCostCode && (
              <span className="shrink-0 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                CSI Baseline
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!activeIsBudgetRow && activeOpportunity && (
              <button
                onClick={() => window.open(`/project/${projectId}/item/${activeOpportunity.id}`, '_blank')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Pop-out in new window"
              >
                <ExternalLink size={16} />
              </button>
            )}
            <button
              onClick={() => setSelectedOpportunityId(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Close Drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Cohesive Segmented Segment Selector (renders only when BOTH opportunity and costCode are active) */}
        {activeOpportunity && activeCostCode && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-6 py-2.5 shrink-0">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActiveTab('ve')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 've'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                VE Contenders
              </button>
              <button
                onClick={() => setActiveTab('budget')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'budget'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Budget Variance
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Pane */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 min-h-0 w-full relative">
          {activeIsBudgetRow || activeTab === 'budget' ? (
            activeCostCode ? (
              <div className="p-6 h-full min-h-0 overflow-visible">
                <BudgetDetailView
                  projectId={projectId}
                  costCode={activeCostCode}
                  veItems={linkedOpportunities}
                />
              </div>
            ) : null
          ) : (
            mockRow ? (
              <div className="p-1 h-full">
                <ExpandedCard row={mockRow} />
              </div>
            ) : null
          )}
        </div>
      </div>
    </>
  );
}
