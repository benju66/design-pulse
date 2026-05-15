'use client';
/**
 * CostConcentrationSunburst — Interactive two-level SVG sunburst chart.
 *
 * Inner ring: CSI Divisions (aggregated from waterfall data)
 * Outer ring: Individual cost codes within each division
 *
 * Architecture:
 *  - Receives waterfallRows via props — NO internal data hooks (AGENTS.md C24)
 *  - Division prefix extraction uses character-loop, not regex (AGENTS.md A)
 *  - All colors use Tailwind-aligned HSL values with dark: support (C3)
 *  - filteredCostCodes dims non-matching arcs for Layered Context
 */
import { useMemo, useState } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { useChartTooltip } from '@/hooks/useChartTooltip';
import { formatCostCode } from '@/lib/formatCostCode';
import type { BudgetWaterfallRow } from '@/types/models';

interface Props {
  rows: BudgetWaterfallRow[];
  filteredCostCodes?: string[];
  divisionNameMap?: Map<string, string>;
}

interface DivisionGroup {
  divCode: string;
  label: string;
  total: number;
  veImpact: number;
  codes: BudgetWaterfallRow[];
}

interface TooltipData {
  label: string;
  budget: number;
  percent: number;
  veImpact: number;
  type: 'division' | 'code';
}

// HSL palette — 16 distinct hues evenly spaced, muted for enterprise feel
const PALETTE = [
  'hsl(210, 60%, 55%)', 'hsl(190, 55%, 50%)', 'hsl(160, 50%, 45%)',
  'hsl(140, 45%, 50%)', 'hsl(80, 45%, 50%)',  'hsl(45, 60%, 50%)',
  'hsl(25, 65%, 55%)',  'hsl(0, 55%, 55%)',   'hsl(330, 50%, 55%)',
  'hsl(280, 45%, 55%)', 'hsl(250, 50%, 55%)', 'hsl(220, 55%, 60%)',
  'hsl(200, 50%, 48%)', 'hsl(170, 45%, 48%)', 'hsl(120, 40%, 48%)',
  'hsl(60, 50%, 48%)',
];

/** Extract 2-digit division prefix using character loop (iOS safe — no regex) */
function getDivisionPrefix(costCode: string): string {
  // Strip suffixes like .M, .S etc
  let base = '';
  for (let i = 0; i < costCode.length; i++) {
    const ch = costCode[i];
    if (ch === '.') break;
    base += ch;
  }
  // Pad to 6 digits and take first 2
  while (base.length < 6) base = '0' + base;
  return base.substring(0, 2);
}

/** Check if a string is all digits */
function isAllDigits(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return s.length > 0;
}

/** Generate SVG arc path */
function arcPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number
): string {
  const start1 = polarToCartesian(cx, cy, outerR, endAngle);
  const end1 = polarToCartesian(cx, cy, outerR, startAngle);
  const start2 = polarToCartesian(cx, cy, innerR, startAngle);
  const end2 = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    'M', start1.x, start1.y,
    'A', outerR, outerR, 0, largeArc, 0, end1.x, end1.y,
    'L', start2.x, start2.y,
    'A', innerR, innerR, 0, largeArc, 1, end2.x, end2.y,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  };
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

export default function CostConcentrationSunburst({ rows, filteredCostCodes, divisionNameMap }: Props) {
  const [isolatedDivision, setIsolatedDivision] = useState<string | null>(null);
  const { state: tip, handlers } = useChartTooltip<TooltipData>();

  // Group rows by division
  const divisions = useMemo<DivisionGroup[]>(() => {
    const map = new Map<string, DivisionGroup>();
    for (const row of rows) {
      if (!row.cost_code || row.cost_code === 'Unassigned') continue;
      const div = getDivisionPrefix(row.cost_code);
      if (!isAllDigits(div)) continue;

      let group = map.get(div);
      if (!group) {
        const divName = divisionNameMap?.get(div) || '';
        const label = divName ? `Div ${div} – ${divName}` : `Division ${div}`;
        group = { divCode: div, label, total: 0, veImpact: 0, codes: [] };
        map.set(div, group);
      }
      const budget = Number(row.budget_amount) || 0;
      group.total += budget;
      group.veImpact += Number(row.ve_impact) || 0;
      group.codes.push(row);
    }
    return Array.from(map.values())
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [rows, divisionNameMap]);

  const grandTotal = useMemo(() => divisions.reduce((s, d) => s + d.total, 0), [divisions]);

  // Determine which divisions to render
  const visibleDivisions = useMemo(() => {
    if (isolatedDivision) return divisions.filter(d => d.divCode === isolatedDivision);
    return divisions;
  }, [divisions, isolatedDivision]);

  const visibleTotal = useMemo(() => visibleDivisions.reduce((s, d) => s + d.total, 0), [visibleDivisions]);

  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const innerR1 = 55;
  const outerR1 = 105;
  const innerR2 = 110;
  const outerR2 = 155;

  if (divisions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400 py-8">
        No budget data available for chart.
      </div>
    );
  }

  // Build arcs
  let angle = 0;
  const TWO_PI = Math.PI * 2;

  const isFiltered = filteredCostCodes && filteredCostCodes.length > 0;
  const filteredSet = isFiltered ? new Set(filteredCostCodes) : null;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {visibleDivisions.map((div, idx) => {
            const divAngle = (div.total / visibleTotal) * TWO_PI;
            const divStart = angle;
            const divEnd = angle + divAngle;

            // Check if any code in this division matches the filter
            const divHasFilterMatch = filteredSet
              ? div.codes.some(c => filteredSet.has(c.cost_code))
              : true;

            // Inner ring — division arc
            const divPath = arcPath(cx, cy, innerR1, outerR1, divStart, divEnd);
            const color = PALETTE[idx % PALETTE.length];
            const divOpacity = filteredSet && !divHasFilterMatch ? 0.15 : 1;

            // Outer ring — individual cost codes within this division
            let codeAngle = divStart;
            const codeArcs = div.codes
              .filter(c => (Number(c.budget_amount) || 0) > 0)
              .sort((a, b) => (Number(b.budget_amount) || 0) - (Number(a.budget_amount) || 0))
              .map((code) => {
                const codeBudget = Number(code.budget_amount) || 0;
                const codeSpan = (codeBudget / div.total) * divAngle;
                const codeStart = codeAngle;
                const codeEnd = codeAngle + codeSpan;
                codeAngle = codeEnd;

                const codeMatches = filteredSet ? filteredSet.has(code.cost_code) : true;
                const codeOpacity = filteredSet && !codeMatches ? 0.15 : 0.7;

                return (
                  <path
                    key={code.cost_code}
                    d={arcPath(cx, cy, innerR2, outerR2, codeStart, codeEnd)}
                    fill={color}
                    opacity={codeOpacity}
                    stroke="white"
                    strokeWidth={1}
                    className="dark:stroke-slate-900 transition-opacity duration-200 cursor-pointer hover:opacity-100"
                    onMouseMove={(e) => handlers.onMouseMove(e, {
                      label: `${formatCostCode(code.cost_code)} – ${code.description}`,
                      budget: codeBudget,
                      percent: grandTotal > 0 ? (codeBudget / grandTotal) * 100 : 0,
                      veImpact: Number(code.ve_impact) || 0,
                      type: 'code',
                    })}
                    onMouseLeave={handlers.onMouseLeave}
                  />
                );
              });

            angle = divEnd;

            return (
              <g key={div.divCode}>
                {/* Division arc (inner ring) */}
                <path
                  d={divPath}
                  fill={color}
                  opacity={divOpacity}
                  stroke="white"
                  strokeWidth={1.5}
                  className="dark:stroke-slate-900 transition-opacity duration-200 cursor-pointer hover:brightness-110"
                  onClick={() => setIsolatedDivision(isolatedDivision === div.divCode ? null : div.divCode)}
                  onMouseMove={(e) => handlers.onMouseMove(e, {
                    label: div.label,
                    budget: div.total,
                    percent: grandTotal > 0 ? (div.total / grandTotal) * 100 : 0,
                    veImpact: div.veImpact,
                    type: 'division',
                  })}
                  onMouseLeave={handlers.onMouseLeave}
                />
                {/* Code arcs (outer ring) */}
                {codeArcs}
              </g>
            );
          })}

          {/* Center circle — click to reset */}
          <circle
            cx={cx}
            cy={cy}
            r={innerR1 - 2}
            className="fill-white dark:fill-slate-900 cursor-pointer hover:fill-slate-50 dark:hover:fill-slate-800 transition-colors"
            onClick={() => setIsolatedDivision(null)}
          />
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="fill-slate-700 dark:fill-slate-300 text-[10px] font-bold pointer-events-none"
          >
            {isolatedDivision ? `DIV ${isolatedDivision}` : 'TOTAL'}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400 text-[9px] font-medium pointer-events-none"
          >
            {formatCurrency(isolatedDivision ? visibleTotal : grandTotal)}
          </text>
        </svg>
      </div>

      {/* Legend — horizontal wrapping pills below chart */}
      <div className="flex flex-wrap justify-center gap-1 max-w-[700px] px-2">
        {divisions.map((div, idx) => (
          <button
            key={div.divCode}
            onClick={() => setIsolatedDivision(isolatedDivision === div.divCode ? null : div.divCode)}
            className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap ${
              isolatedDivision === div.divCode
                ? 'bg-sky-100 dark:bg-sky-900/40 ring-1 ring-sky-400 dark:ring-sky-600 text-sky-700 dark:text-sky-300'
                : isolatedDivision
                  ? 'opacity-40 hover:opacity-80'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
            />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {div.label}
            </span>
            <span className="text-slate-400 dark:text-slate-500 tabular-nums">
              {grandTotal > 0 ? ((div.total / grandTotal) * 100).toFixed(1) : 0}%
            </span>
          </button>
        ))}
      </div>

      {/* Tooltip */}
      <ChartTooltip visible={tip.visible} x={tip.x} y={tip.y}>
        {tip.data && (
          <>
            <div className="font-bold mb-1.5 border-b border-slate-600 pb-1">{tip.data.label}</div>
            <div className="flex justify-between gap-4">
              <span>Budget:</span>
              <span className="font-semibold">{formatCurrency(tip.data.budget)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Share:</span>
              <span className="font-semibold">{tip.data.percent.toFixed(1)}%</span>
            </div>
            {tip.data.veImpact !== 0 && (
              <div className={`flex justify-between gap-4 mt-1 pt-1 border-t border-slate-600 ${tip.data.veImpact < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span>VE Impact:</span>
                <span className="font-semibold">{formatCurrency(tip.data.veImpact)}</span>
              </div>
            )}
            {tip.data.type === 'division' && (
              <div className="text-slate-400 mt-1 text-[10px]">Click to isolate division</div>
            )}
          </>
        )}
      </ChartTooltip>
    </div>
  );
}
