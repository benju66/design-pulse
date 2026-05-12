"use client";

export default function RiskTrendPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-5 py-8">
      {/* Faux Area Chart — inline SVG, no external deps */}
      <svg
        viewBox="0 0 320 160"
        className="w-64 h-36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle grid lines */}
        {[40, 80, 120].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="320"
            y2={y}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Approved area (emerald) */}
        <path
          d="M0,140 C40,130 80,110 120,100 C160,90 200,70 240,55 C280,42 310,38 320,36 L320,160 L0,160 Z"
          className="fill-emerald-500/15 dark:fill-emerald-400/10"
        />
        <path
          d="M0,140 C40,130 80,110 120,100 C160,90 200,70 240,55 C280,42 310,38 320,36"
          className="stroke-emerald-500 dark:stroke-emerald-400"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Pending Exposure area (amber) */}
        <path
          d="M0,120 C40,115 80,125 120,118 C160,112 200,130 240,126 C280,120 310,115 320,112 L320,160 L0,160 Z"
          className="fill-amber-500/15 dark:fill-amber-400/10"
        />
        <path
          d="M0,120 C40,115 80,125 120,118 C160,112 200,130 240,126 C280,120 310,115 320,112"
          className="stroke-amber-500 dark:stroke-amber-400"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="6 3"
        />

        {/* X-axis */}
        <line
          x1="0"
          y1="160"
          x2="320"
          y2="160"
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="1"
        />
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded-full" />
          Approved (Locked)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-500 dark:bg-amber-400 rounded-full border-b border-dashed" />
          Pending Exposure
        </span>
      </div>

      {/* Title */}
      <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">
        Risk Exposure Trend
      </h4>

      {/* Subtitle */}
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md text-center leading-relaxed">
        Track how your locked savings and pending exposure evolve over time to
        proactively manage budget risk.
      </p>

      {/* Phase badge */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
        Coming in Phase 5
      </span>
    </div>
  );
}
