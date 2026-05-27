"use client";
import React, { useMemo, useState, useCallback } from 'react';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
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

const DAY_OPTIONS = [30, 60, 90, 120] as const;
type DayRange = typeof DAY_OPTIONS[number];

const WIDGET_TOOLTIP = 'Key dates, deliverable deadlines, and permit milestones within the selected time window.';

// ── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Timezone-safe filtering using component-based parsing.
 * Uses regex extraction per AGENTS.md §5 to avoid timezone shift bugs.
 */
function getUpcomingEvents(events: TimelineEvent[], days: number): TimelineEvent[] {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
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
  const [dayRange, setDayRange] = useState<DayRange>(30);

  const cycleDayRange = useCallback(() => {
    setDayRange((prev) => {
      const idx = DAY_OPTIONS.indexOf(prev);
      return DAY_OPTIONS[(idx + 1) % DAY_OPTIONS.length];
    });
  }, []);

  const upcoming = useMemo(() => getUpcomingEvents(timeline, dayRange), [timeline, dayRange]);

  if (upcoming.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
        <Calendar size={20} className="text-slate-300 dark:text-slate-600 mb-2" />
        <span className="text-sm text-slate-400 dark:text-slate-500">No events in the next {dayRange} days</span>
        <button
          onClick={cycleDayRange}
          className="mt-2 text-xs font-medium text-sky-500 hover:text-sky-400 transition-colors flex items-center gap-1"
        >
          Try next {DAY_OPTIONS[(DAY_OPTIONS.indexOf(dayRange) + 1) % DAY_OPTIONS.length]} days
          <ChevronRight size={10} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm relative group/widget">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
          Upcoming Timeline
        </h3>
        <button
          onClick={cycleDayRange}
          className="flex items-center gap-1 text-[10px] font-semibold text-sky-500 hover:text-sky-400 dark:text-sky-400 dark:hover:text-sky-300 transition-colors cursor-pointer select-none"
          title={`Click to cycle: ${DAY_OPTIONS.join(' → ')} days`}
        >
          <Clock size={10} />
          Next {dayRange} Days
          <ChevronRight size={8} className="opacity-0 group-hover/widget:opacity-100 transition-opacity" />
        </button>
      </div>
      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[280px] overflow-y-auto overflow-x-hidden">
        {upcoming.map((event) => {
          const badge = SOURCE_BADGE_CONFIG[event.source_type] || SOURCE_BADGE_CONFIG.key_date;
          return (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-2 px-2 rounded-lg min-w-0"
            >
              {/* Date */}
              <div className="w-[72px] shrink-0">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                  {formatDate(event.timeline_date)}
                </span>
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate block">
                  {event.title}
                </span>
              </div>

              {/* Source Badge */}
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${badge.className}`}>
                {badge.label}
              </span>

              {/* Status (for deliverables/permits) */}
              {event.status && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
                  {event.status}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Widget Tooltip */}
      <div className="absolute top-0 right-0 mt-12 mr-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[100] opacity-0 invisible group-hover/widget:opacity-100 group-hover/widget:visible transition-all duration-200 pointer-events-none p-3">
        <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
          Upcoming Timeline
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
          {WIDGET_TOOLTIP}
        </p>
      </div>
    </div>
  );
});
