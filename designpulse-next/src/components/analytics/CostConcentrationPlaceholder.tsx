"use client";

export default function CostConcentrationPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-5 py-8">
      {/* Faux Donut Ring — pure CSS conic-gradient */}
      <div className="relative w-32 h-32">
        <div
          className="w-full h-full rounded-full opacity-80"
          style={{
            background:
              'conic-gradient(from 0deg, #94a3b8 0% 28%, #38bdf8 28% 46%, #34d399 46% 62%, #fbbf24 62% 78%, #fb7185 78% 100%)',
          }}
        />
        {/* Inner cutout to form the ring */}
        <div className="absolute inset-4 rounded-full bg-white dark:bg-slate-900" />
        {/* Center icon hint */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700" />
        </div>
      </div>

      {/* Title */}
      <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">
        Cost Concentration by Division
      </h4>

      {/* Subtitle */}
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md text-center leading-relaxed">
        Visualize budget allocation across CSI divisions to identify cost-heavy
        trades and rebalancing opportunities.
      </p>

      {/* Phase badge */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
        Coming in Phase 5
      </span>
    </div>
  );
}
