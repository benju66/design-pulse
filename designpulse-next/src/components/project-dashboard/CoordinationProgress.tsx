"use client";
import React, { useMemo } from 'react';
import type { Opportunity } from '@/types/models';

// ── Types ────────────────────────────────────────────────────────────────────
interface CoordinationProgressProps {
  opportunities: Opportunity[];
  onClick: () => void;
}

interface ProgressSegment {
  label: string;
  count: number;
  color: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const COORDINATION_STATUSES: { key: string; label: string; color: string }[] = [
  { key: 'Draft', label: 'Draft', color: '#94a3b8' },
  { key: 'In Drafting', label: 'In Drafting', color: '#38bdf8' },
  { key: 'Pending Plan Update', label: 'Pending Plan Update', color: '#f59e0b' },
  { key: 'Ready for Review', label: 'Ready for Review', color: '#3b82f6' },
  { key: 'Implemented', label: 'Implemented', color: '#10b981' },
];

// ── Component ────────────────────────────────────────────────────────────────
export const CoordinationProgress = React.memo(function CoordinationProgress({
  opportunities,
  onClick,
}: CoordinationProgressProps) {
  const { segments, total, completedCount, percentage } = useMemo(() => {
    // Filter to items that actually require coordination
    const coordItems = opportunities.filter(
      (opp) =>
        opp.coordination_status &&
        opp.coordination_status !== 'Not Required' &&
        opp.coordination_status !== 'Not Applicable'
    );

    const counts: Record<string, number> = {};
    coordItems.forEach((opp) => {
      const status = opp.coordination_status || 'Draft';
      counts[status] = (counts[status] || 0) + 1;
    });

    const segs: ProgressSegment[] = COORDINATION_STATUSES
      .filter((s) => (counts[s.key] || 0) > 0)
      .map((s) => ({
        label: s.label,
        count: counts[s.key] || 0,
        color: s.color,
      }));

    const complete = counts['Implemented'] || 0;
    const tot = coordItems.length;
    const pct = tot > 0 ? Math.round((complete / tot) * 100) : 0;

    return { segments: segs, total: tot, completedCount: complete, percentage: pct };
  }, [opportunities]);

  if (total === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
        <span className="text-sm text-slate-400 dark:text-slate-500">No coordination items</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm w-full text-left hover:border-sky-300 dark:hover:border-sky-700 transition-colors cursor-pointer relative group/widget"
    >
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
        Coordination Progress
      </h3>
      {/* Widget Tooltip */}
      <div className="absolute top-0 right-0 mt-12 mr-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[100] opacity-0 invisible group-hover/widget:opacity-100 group-hover/widget:visible transition-all duration-200 pointer-events-none p-3">
        <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Coordination Progress</h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
          Design coordination status across all active items. Shows how many items have been implemented vs. still in drafting or review.
        </p>
      </div>

      {/* Metric */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
          {percentage}%
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {completedCount} of {total} complete
        </span>
      </div>

      {/* Segmented Bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="transition-all duration-300"
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {seg.label}
            </span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
});
