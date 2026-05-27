"use client";
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Opportunity } from '@/types/models';

// ── Types ────────────────────────────────────────────────────────────────────
interface VEStatusDonutProps {
  opportunities: Opportunity[];
  onSegmentClick: (status: string) => void;
}

interface StatusSegment {
  name: string;
  value: number;
  color: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; darkColor: string }> = {
  Draft: { color: '#94a3b8', darkColor: '#64748b' },
  'Pending Review': { color: '#f59e0b', darkColor: '#d97706' },
  Approved: { color: '#10b981', darkColor: '#059669' },
  Rejected: { color: '#f43f5e', darkColor: '#e11d48' },
};

const ORDERED_STATUSES = ['Draft', 'Pending Review', 'Approved', 'Rejected'] as const;

// ── Component ────────────────────────────────────────────────────────────────
export const VEStatusDonut = React.memo(function VEStatusDonut({
  opportunities,
  onSegmentClick,
}: VEStatusDonutProps) {
  const { segments, activeCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let active = 0;

    // Only count VE items (exclude pure coordination rows)
    const veItems = opportunities.filter(
      (o) => (o.record_type || 'VE') === 'VE' || (o.record_type === 'Coordination' && ((o.coordination_details as Record<string, unknown>)?.is_escalated === true))
    );

    veItems.forEach((opp) => {
      const status = opp.status || 'Draft';
      counts[status] = (counts[status] || 0) + 1;
      if (status !== 'Rejected') active++;
    });

    const segs: StatusSegment[] = ORDERED_STATUSES
      .filter((s) => (counts[s] || 0) > 0)
      .map((s) => ({
        name: s,
        value: counts[s] || 0,
        color: STATUS_CONFIG[s]?.color || '#94a3b8',
      }));

    return { segments: segs, activeCount: active };
  }, [opportunities]);

  if (segments.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
        <span className="text-sm text-slate-400 dark:text-slate-500">No VE items yet</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm relative group/widget">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">VE Decision Status</h3>
      {/* Widget Tooltip */}
      <div className="absolute top-0 right-0 mt-12 mr-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[100] opacity-0 invisible group-hover/widget:opacity-100 group-hover/widget:visible transition-all duration-200 pointer-events-none p-3">
        <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">VE Decision Status</h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
          Breakdown of all VE items by workflow status. Click a segment or legend entry to filter the Value Matrix.
        </p>
      </div>
      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="relative w-[140px] h-[140px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                onClick={(_, index) => {
                  const seg = segments[index];
                  if (seg) onSegmentClick(seg.name);
                }}
                className="cursor-pointer"
              >
                {segments.map((seg) => (
                  <Cell key={seg.name} fill={seg.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {activeCount}
            </span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Active
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {segments.map((seg) => (
            <button
              key={seg.name}
              onClick={() => onSegmentClick(seg.name)}
              className="flex items-center gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 py-1.5 transition-colors group"
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white truncate flex-1">
                {seg.name}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                {seg.value}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
