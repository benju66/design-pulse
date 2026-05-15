'use client';
/**
 * RiskExposureTrend — SVG stepped line chart for budget version milestones.
 * Receives data via props (AGENTS.md C24). Shows baseline/revised/projected.
 */
import { useMemo } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { useChartTooltip } from '@/hooks/useChartTooltip';
import type { BudgetVersionTimelineRow } from '@/types/models';

interface Props {
  rows: BudgetVersionTimelineRow[];
  isFiltered?: boolean;
  isLoading?: boolean;
}

interface TipData {
  name: string; date: string; baseline: number; revised: number; projected: number;
}

const fmtC = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const fmtD = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export default function RiskExposureTrend({ rows, isFiltered, isLoading }: Props) {
  const { state: tip, handlers } = useChartTooltip<TipData>();

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => a.version_date.localeCompare(b.version_date)),
    [rows]
  );

  const PAD = { top: 30, right: 30, bottom: 55, left: 80 };
  const W = 680, H = 280;
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    if (sorted.length === 0) return { yMin: 0, yMax: 1, yTicks: [0, 1] };
    let mn = Infinity, mx = -Infinity;
    for (const r of sorted) {
      const b = Number(r.baseline) || 0, l = Number(r.locked_ve) || 0, p = Number(r.pending_ve) || 0;
      const rev = b + l, proj = rev + p;
      mn = Math.min(mn, b, rev, proj);
      mx = Math.max(mx, b, rev, proj);
    }
    const rng = mx - mn || 1;
    mn -= rng * 0.1; mx += rng * 0.1;
    const step = (mx - mn) / 5;
    const ticks: number[] = [];
    for (let i = 0; i <= 5; i++) ticks.push(mn + step * i);
    return { yMin: mn, yMax: mx, yTicks: ticks };
  }, [sorted]);

  const xS = (i: number) => PAD.left + (iW / Math.max(sorted.length - 1, 1)) * i;
  const yS = (v: number) => PAD.top + iH - ((v - yMin) / (yMax - yMin)) * iH;

  if (isLoading) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" /></div>;
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400 py-8 gap-2">
        <span>No estimate versions found.</span>
        <span className="text-xs text-slate-400">Import at least one budget to see the risk trend.</span>
      </div>
    );
  }

  const stepped = (vals: number[]): string => {
    if (!vals.length) return '';
    let p = `M ${xS(0)} ${yS(vals[0])}`;
    for (let i = 1; i < vals.length; i++) p += ` L ${xS(i)} ${yS(vals[i - 1])} L ${xS(i)} ${yS(vals[i])}`;
    return p;
  };

  const bases = sorted.map(r => Number(r.baseline) || 0);
  const revs = sorted.map((r, i) => bases[i] + (Number(r.locked_ve) || 0));
  const projs = sorted.map((r, i) => revs[i] + (Number(r.pending_ve) || 0));

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="max-w-full">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yS(t)} x2={W - PAD.right} y2={yS(t)} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="3 3" />
            <text x={PAD.left - 8} y={yS(t) + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 text-[9px] font-medium">${(t / 1000000).toFixed(1)}M</text>
          </g>
        ))}
        <path d={stepped(bases)} fill="none" stroke="currentColor" className="text-slate-400 dark:text-slate-500" strokeWidth={2} />
        <path d={stepped(revs)} fill="none" stroke="currentColor" className="text-emerald-500 dark:text-emerald-400" strokeWidth={2} />
        <path d={stepped(projs)} fill="none" stroke="currentColor" className="text-amber-500 dark:text-amber-400" strokeWidth={2} strokeDasharray="6 3" />
        {sorted.map((r, i) => (
          <g key={r.version_id}>
            <circle cx={xS(i)} cy={yS(bases[i])} r={4} className="fill-slate-400 dark:fill-slate-500" />
            <circle cx={xS(i)} cy={yS(revs[i])} r={4} className="fill-emerald-500 dark:fill-emerald-400" />
            <circle cx={xS(i)} cy={yS(projs[i])} r={4} className="fill-amber-500 dark:fill-amber-400 opacity-80" />
            <circle cx={xS(i)} cy={yS(bases[i])} r={18} fill="transparent" className="cursor-pointer"
              onMouseMove={(e) => handlers.onMouseMove(e, { name: r.version_name, date: r.version_date, baseline: bases[i], revised: revs[i], projected: projs[i] })}
              onMouseLeave={handlers.onMouseLeave} />
            <text x={xS(i)} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[9px] font-semibold">{r.version_name}</text>
            <text x={xS(i)} y={H - PAD.bottom + 30} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[8px]">{fmtD(r.version_date)}</text>
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-5 text-[10px] font-semibold">
        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-slate-400 dark:bg-slate-500 rounded" /><span className="text-slate-500 dark:text-slate-400">Baseline</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded" /><span className="text-slate-500 dark:text-slate-400">Revised (Locked)</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-500 dark:bg-amber-400 rounded" /><span className="text-slate-500 dark:text-slate-400">Projected (Pending)</span></div>
      </div>
      <div className="text-[9px] text-slate-400 dark:text-slate-500 text-center space-y-0.5">
        <div>VE values reflect current status, not historical snapshots at each version.</div>
        {isFiltered && <div className="text-amber-500 dark:text-amber-400">Showing project-level totals (not affected by grid filters)</div>}
      </div>
      <ChartTooltip visible={tip.visible} x={tip.x} y={tip.y}>
        {tip.data && (
          <>
            <div className="font-bold mb-1.5 border-b border-slate-600 pb-1">{tip.data.name}<span className="text-slate-400 font-normal ml-2">{fmtD(tip.data.date)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400">Baseline:</span><span>{fmtC(tip.data.baseline)}</span></div>
            <div className="flex justify-between gap-4 text-emerald-400"><span>Revised:</span><span className="font-semibold">{fmtC(tip.data.revised)}</span></div>
            <div className="flex justify-between gap-4 text-amber-400"><span>Projected:</span><span className="font-semibold">{fmtC(tip.data.projected)}</span></div>
          </>
        )}
      </ChartTooltip>
    </div>
  );
}
