"use client";
import React, { useMemo } from 'react';
import { FileText, Shield } from 'lucide-react';
import type { ProjectDeliverable, Permit } from '@/types/models';

// ── Types ────────────────────────────────────────────────────────────────────
interface DeliverablePermitSummaryProps {
  deliverables: ProjectDeliverable[];
  permits: Permit[];
  onDeliverablesClick: () => void;
  onPermitsClick: () => void;
}

interface StatusCount {
  label: string;
  count: number;
  color: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const DELIVERABLE_STATUS_CONFIG: Record<string, string> = {
  'Open': '#94a3b8',
  'In Progress': '#38bdf8',
  'Under Review': '#f59e0b',
  'Closed': '#10b981',
  'Not Applicable': '#cbd5e1',
};

const PERMIT_STATUS_CONFIG: Record<string, string> = {
  'Preparing': '#94a3b8',
  'Submitted': '#38bdf8',
  'In Review': '#f59e0b',
  'Approved': '#10b981',
  'Rejected': '#f43f5e',
  'Issued': '#047857',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildStatusCounts(
  items: Array<{ status: string | null }>,
  config: Record<string, string>,
): StatusCount[] {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const status = item.status || 'Open';
    counts[status] = (counts[status] || 0) + 1;
  });

  return Object.entries(config)
    .filter(([key]) => (counts[key] || 0) > 0)
    .map(([key, color]) => ({
      label: key,
      count: counts[key] || 0,
      color,
    }));
}

// ── Component ────────────────────────────────────────────────────────────────
export const DeliverablePermitSummary = React.memo(function DeliverablePermitSummary({
  deliverables,
  permits,
  onDeliverablesClick,
  onPermitsClick,
}: DeliverablePermitSummaryProps) {
  const deliverableStats = useMemo(
    () => buildStatusCounts(deliverables, DELIVERABLE_STATUS_CONFIG),
    [deliverables],
  );

  const permitStats = useMemo(
    () => buildStatusCounts(permits, PERMIT_STATUS_CONFIG),
    [permits],
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
        Deliverables & Permits
      </h3>
      <div className="flex flex-col gap-5">
        {/* Deliverables Section */}
        <button
          onClick={onDeliverablesClick}
          className="flex flex-col gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-2.5 -m-2.5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-sky-500 shrink-0" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Deliverables
            </span>
            <span className="ml-auto text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {deliverables.length}
            </span>
          </div>
          {deliverableStats.length > 0 && (
            <>
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {deliverableStats.map((s) => (
                  <div
                    key={s.label}
                    className="transition-all duration-300"
                    style={{
                      width: `${(s.count / deliverables.length) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {deliverableStats.map((s) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{s.label}</span>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </button>

        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* Permits Section */}
        <button
          onClick={onPermitsClick}
          className="flex flex-col gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-2.5 -m-2.5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-500 shrink-0" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Permits
            </span>
            <span className="ml-auto text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {permits.length}
            </span>
          </div>
          {permitStats.length > 0 && (
            <>
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {permitStats.map((s) => (
                  <div
                    key={s.label}
                    className="transition-all duration-300"
                    style={{
                      width: `${(s.count / permits.length) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {permitStats.map((s) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{s.label}</span>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
