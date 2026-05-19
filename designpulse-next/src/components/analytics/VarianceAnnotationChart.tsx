'use client';
/**
 * VarianceAnnotationChart.tsx
 *
 * Phase 5: Executive Variance Intelligence Dashboard.
 * Renders a visual breakdown of variance note coverage across cost codes.
 *
 * Architecture:
 *  - Receives data via props (no hooks — AGENTS.md C24)
 *  - Pure CSS stacked bar chart (no chart library dependency)
 *  - Color-coded: annotated (sky), unannotated (rose), within-threshold (slate)
 *  - Responsive grid layout for mobile/container compatibility
 */


import { MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface VarianceAnnotationChartProps {
  /** All budget line data with variance info */
  data: Array<{
    costCode: string;
    description?: string;
    baseline: number;
    revised: number;
    hasNote: boolean;
  }>;
  isLoading?: boolean;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(val);

export default function VarianceAnnotationChart({ data, isLoading }: VarianceAnnotationChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        Loading variance coverage…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm gap-2">
        <MessageSquare size={24} className="opacity-40" />
        <p>No budget lines with variance data available.</p>
      </div>
    );
  }

  // Categorize cost codes
  const significantDelta = data.filter(d => {
    const pct = d.baseline > 0 ? Math.abs(d.revised - d.baseline) / d.baseline : 0;
    return pct >= 0.05; // 5% threshold for significance
  });
  const annotated = significantDelta.filter(d => d.hasNote);
  const unannotated = significantDelta.filter(d => !d.hasNote);
  const withinThreshold = data.filter(d => {
    const pct = d.baseline > 0 ? Math.abs(d.revised - d.baseline) / d.baseline : 0;
    return pct < 0.05;
  });

  const totalCodes = data.length;
  const coverageRate = significantDelta.length > 0
    ? Math.round((annotated.length / significantDelta.length) * 100)
    : 100;

  const annotatedPct = totalCodes > 0 ? (annotated.length / totalCodes) * 100 : 0;
  const unannotatedPct = totalCodes > 0 ? (unannotated.length / totalCodes) * 100 : 0;
  const thresholdPct = totalCodes > 0 ? (withinThreshold.length / totalCodes) * 100 : 0;

  // Unannotated exposure (total dollars at risk without explanation)
  const unannotatedExposure = unannotated.reduce(
    (sum, d) => sum + Math.abs(d.revised - d.baseline),
    0
  );

  return (
    <div className="space-y-5">
      {/* Coverage Score */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            coverageRate >= 80
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : coverageRate >= 50
              ? 'bg-amber-50 dark:bg-amber-900/20'
              : 'bg-rose-50 dark:bg-rose-900/20'
          }`}>
            <span className={`text-xl font-black ${
              coverageRate >= 80
                ? 'text-emerald-600 dark:text-emerald-400'
                : coverageRate >= 50
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {coverageRate}%
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Variance Coverage</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {annotated.length} of {significantDelta.length} significant variances explained
            </p>
          </div>
        </div>

        {unannotatedExposure > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
            <AlertTriangle size={14} className="text-rose-500 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Unexplained Exposure</p>
              <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{formatCurrency(unannotatedExposure)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Stacked Bar Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coverage Breakdown</span>
          <span className="text-[10px] text-slate-400">{totalCodes} cost codes</span>
        </div>
        <div className="h-6 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
          {annotatedPct > 0 && (
            <div
              className="bg-sky-500 dark:bg-sky-600 transition-all duration-500"
              style={{ width: `${annotatedPct}%` }}
              title={`${annotated.length} annotated`}
            />
          )}
          {unannotatedPct > 0 && (
            <div
              className="bg-rose-400 dark:bg-rose-600 transition-all duration-500"
              style={{ width: `${unannotatedPct}%` }}
              title={`${unannotated.length} unannotated`}
            />
          )}
          {thresholdPct > 0 && (
            <div
              className="bg-slate-200 dark:bg-slate-700 transition-all duration-500"
              style={{ width: `${thresholdPct}%` }}
              title={`${withinThreshold.length} within threshold`}
            />
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Annotated ({annotated.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Missing Note ({unannotated.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Within Threshold ({withinThreshold.length})</span>
          </div>
        </div>
      </div>

      {/* Top Unannotated Items */}
      {unannotated.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-rose-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Top Unannotated Variances
            </span>
          </div>
          <div className="space-y-1.5">
            {unannotated
              .sort((a, b) => Math.abs(b.revised - b.baseline) - Math.abs(a.revised - a.baseline))
              .slice(0, 5)
              .map(item => {
                const delta = item.revised - item.baseline;
                const pct = item.baseline > 0 ? Math.round((delta / item.baseline) * 100) : 0;
                return (
                  <div key={item.costCode} className="flex items-center justify-between py-1.5 px-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-rose-600 dark:text-rose-400 shrink-0">{item.costCode}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{item.description || ''}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold tabular-nums ${delta >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">({pct >= 0 ? '+' : ''}{pct}%)</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Full Coverage State */}
      {coverageRate === 100 && significantDelta.length > 0 && (
        <div className="flex items-center gap-2 py-3 px-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All significant variances are fully documented.</p>
        </div>
      )}
    </div>
  );
}
