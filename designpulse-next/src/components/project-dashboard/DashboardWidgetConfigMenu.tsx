"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useUIStore, DashboardWidgetId } from '@/stores/useUIStore';

// ── Constants ────────────────────────────────────────────────────────────────
const WIDGET_LABELS: { id: DashboardWidgetId; label: string }[] = [
  { id: 'budget-health', label: 'Budget Health' },
  { id: 've-status-donut', label: 'VE Decision Status' },
  { id: 'coordination-progress', label: 'Coordination Progress' },
  { id: 'deliverable-permit-summary', label: 'Deliverables & Permits' },
  { id: 'top-exposure-items', label: 'Top Exposure Items' },
  { id: 'upcoming-timeline', label: 'Upcoming Timeline' },
];

const DEFAULT_WIDGET_VISIBILITY: Record<DashboardWidgetId, boolean> = {
  'budget-health': true,
  've-status-donut': true,
  'coordination-progress': true,
  'deliverable-permit-summary': true,
  'top-exposure-items': true,
  'upcoming-timeline': true,
};

// ── Props ────────────────────────────────────────────────────────────────────
interface DashboardWidgetConfigMenuProps {
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export const DashboardWidgetConfigMenu = React.memo(function DashboardWidgetConfigMenu({
  className,
}: DashboardWidgetConfigMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dashboardWidgetVisibility = useUIStore((s) => s.dashboardWidgetVisibility);
  const toggleDashboardWidget = useUIStore((s) => s.toggleDashboardWidget);

  // Click-outside close — uses native mousedown per Rule 16
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const isVisible = (id: DashboardWidgetId): boolean =>
    dashboardWidgetVisibility[id] ?? DEFAULT_WIDGET_VISIBILITY[id];

  const visibleCount = WIDGET_LABELS.filter((w) => isVisible(w.id)).length;

  return (
    <div ref={menuRef} className={`relative ${className || ''}`}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Configure Dashboard Widgets"
      >
        <Settings size={16} />
        <span className="hidden sm:inline">Customize</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-20">
          <div className="flex items-center justify-between px-2 mb-2">
            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Visible Widgets
            </h5>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
              {visibleCount}/{WIDGET_LABELS.length}
            </span>
          </div>
          <div className="flex flex-col space-y-0.5 max-h-60 overflow-y-auto">
            {WIDGET_LABELS.map((widget) => (
              <label
                key={widget.id}
                className="flex items-center px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  className="mr-2.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500"
                  checked={isVisible(widget.id)}
                  onChange={() => toggleDashboardWidget(widget.id)}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {widget.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Re-export for parent component
export { DEFAULT_WIDGET_VISIBILITY };
export type { DashboardWidgetId };
