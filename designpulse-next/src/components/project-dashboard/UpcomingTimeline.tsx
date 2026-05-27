"use client";
import React, { useMemo } from 'react';
import { Calendar, Clock } from 'lucide-react';
import type { TimelineEvent } from '@/types/models';
import { formatDate } from '@/lib/formatters';

// ── Types ────────────────────────────────────────────────────────────────────
interface UpcomingTimelineProps {
  timeline: TimelineEvent[];
  onEventClick: (event: TimelineEvent) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const SOURCE_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  key_date: { label: 'Key Date', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  deliverable: { label: 'Deliverable', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  permit: { label: 'Permit', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Timezone-safe "today" and 30-day filtering using component-based parsing.
 * Uses regex extraction per AGENTS.md §5 to avoid timezone shift bugs.
 */
function getUpcomingEvents(events: TimelineEvent[]): TimelineEvent[] {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;

  return events
    .filter((e) => {
      if (!e.timeline_date) return false;
      return e.timeline_date >= todayStr && e.timeline_date <= futureStr;
    })
    .sort((a, b) => (a.timeline_date ?? '').localeCompare(b.timeline_date ?? ''));
}

// ── Component ────────────────────────────────────────────────────────────────
export const UpcomingTimeline = React.memo(function UpcomingTimeline({
  timeline,
  onEventClick,
}: UpcomingTimelineProps) {
  const upcoming = useMemo(() => getUpcomingEvents(timeline), [timeline]);

  if (upcoming.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
        <Calendar size={20} className="text-slate-300 dark:text-slate-600 mb-2" />
        <span className="text-sm text-slate-400 dark:text-slate-500">No events in the next 30 days</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
          Upcoming Timeline
        </h3>
        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          <Clock size={10} />
          Next 30 days
        </span>
      </div>
      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[280px] overflow-y-auto">
        {upcoming.map((event) => {
          const badge = SOURCE_BADGE_CONFIG[event.source_type] || SOURCE_BADGE_CONFIG.key_date;
          return (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-2 px-2 rounded-lg"
            >
              {/* Date */}
              <div className="w-[72px] shrink-0">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                  {formatDate(event.timeline_date)}
                </span>
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {event.title}
                </span>
              </div>

              {/* Source Badge */}
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                {badge.label}
              </span>

              {/* Status (for deliverables/permits) */}
              {event.status && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                  {event.status}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
