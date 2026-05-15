'use client';
/**
 * BudgetTreemap — Interactive three-level SVG treemap.
 * L1: Divisions, L2: Cost codes, L3: Items (BL + VE rows).
 * Receives all data via props (AGENTS.md C24). Uses treemapLayout.ts for layout.
 */
import { useMemo, useState, useCallback } from 'react';
import { computeTreemapLayout, type TreemapInputNode, type TreemapRect } from '@/lib/treemapLayout';
import { ChartTooltip } from './ChartTooltip';
import { useChartTooltip } from '@/hooks/useChartTooltip';
import { formatCostCode } from '@/lib/formatCostCode';
import { useUIStore } from '@/stores/useUIStore';
import type { BudgetWaterfallRow, Opportunity } from '@/types/models';

interface Props {
  rows: BudgetWaterfallRow[];
  filteredCostCodes?: string[];
  onRequestL3Items?: (costCode: string) => Opportunity[];
  divisionNameMap?: Map<string, string>;
}

interface TipData {
  label: string;
  budget: number;
  veImpact: number;
  percentOfParent: number;
}

type DrillLevel = { level: 'divisions' } | { level: 'codes'; divCode: string; divLabel: string } | { level: 'items'; divCode: string; divLabel: string; costCode: string; codeLabel: string };

/** Extract 2-digit division prefix using character loop (AGENTS.md A) */
function getDivPrefix(code: string): string {
  let base = '';
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '.') break;
    base += code[i];
  }
  while (base.length < 6) base = '0' + base;
  return base.substring(0, 2);
}

function isDigits(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return s.length > 0;
}

/** Variance-based fill color */
function getColor(veImpact: number, budget: number): string {
  if (veImpact === 0) return 'var(--treemap-neutral, hsl(215, 20%, 65%))';
  if (veImpact < 0) return 'var(--treemap-savings, hsl(160, 50%, 50%))';
  // Scale intensity by impact relative to budget
  const ratio = Math.min(Math.abs(veImpact) / (budget || 1), 1);
  const lightness = 55 - ratio * 15;
  return `hsl(0, 55%, ${lightness}%)`;
}

const fmtC = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export default function BudgetTreemap({ rows, filteredCostCodes, onRequestL3Items, divisionNameMap }: Props) {
  const [drill, setDrill] = useState<DrillLevel>({ level: 'divisions' });
  const { state: tip, handlers } = useChartTooltip<TipData>();
  const setSelectedOpportunityId = useUIStore(s => s.setSelectedOpportunityId);

  const WIDTH = 700;
  const HEIGHT = 320;
  const bounds = { x: 0, y: 0, width: WIDTH, height: HEIGHT };

  const isFiltered = filteredCostCodes && filteredCostCodes.length > 0;
  const filteredSet = isFiltered ? new Set(filteredCostCodes) : null;

  // Group by division
  const divisionMap = useMemo(() => {
    const map = new Map<string, { total: number; veImpact: number; codes: BudgetWaterfallRow[] }>();
    for (const r of rows) {
      if (!r.cost_code || r.cost_code === 'Unassigned') continue;
      const div = getDivPrefix(r.cost_code);
      if (!isDigits(div)) continue;
      let g = map.get(div);
      if (!g) { g = { total: 0, veImpact: 0, codes: [] }; map.set(div, g); }
      g.total += Number(r.budget_amount) || 0;
      g.veImpact += Number(r.ve_impact) || 0;
      g.codes.push(r);
    }
    return map;
  }, [rows]);

  // Build treemap nodes for current drill level
  const { rects, parentTotal } = useMemo((): { rects: TreemapRect[]; parentTotal: number } => {
    if (drill.level === 'divisions') {
      const nodes: TreemapInputNode[] = [];
      let total = 0;
      divisionMap.forEach((g, div) => {
        if (g.total > 0) {
          const divName = divisionNameMap?.get(div) || '';
          const label = divName ? `Division ${div} – ${divName}` : `Division ${div}`;
          nodes.push({ id: div, label, value: g.total, meta: { veImpact: g.veImpact } });
          total += g.total;
        }
      });
      return { rects: computeTreemapLayout(nodes, bounds), parentTotal: total };
    }

    if (drill.level === 'codes') {
      const g = divisionMap.get(drill.divCode);
      if (!g) return { rects: [], parentTotal: 0 };
      const nodes: TreemapInputNode[] = g.codes
        .filter(c => (Number(c.budget_amount) || 0) > 0)
        .map(c => ({
          id: c.cost_code,
          label: `${formatCostCode(c.cost_code)} – ${c.description}`,
          value: Number(c.budget_amount) || 0,
          meta: { veImpact: Number(c.ve_impact) || 0 },
        }));
      return { rects: computeTreemapLayout(nodes, bounds), parentTotal: g.total };
    }

    // Level 3: Items
    if (drill.level === 'items' && onRequestL3Items) {
      const items = onRequestL3Items(drill.costCode);
      const nodes: TreemapInputNode[] = items
        .filter(o => {
          const val = Number(o.cost_impact) || Number(o.baseline_budget) || 0;
          return val > 0;
        })
        .map(o => ({
          id: o.id,
          label: o.title || o.description || 'Unnamed',
          value: Math.abs(Number(o.cost_impact) || Number(o.baseline_budget) || 0),
          meta: { veImpact: Number(o.cost_impact) || 0, opportunityId: o.id },
        }));
      const total = nodes.reduce((s, n) => s + n.value, 0);
      return { rects: computeTreemapLayout(nodes, bounds), parentTotal: total };
    }

    return { rects: [], parentTotal: 0 };
  }, [drill, divisionMap, bounds, onRequestL3Items, divisionNameMap]);

  const handleClick = useCallback((rect: TreemapRect) => {
    if (drill.level === 'divisions') {
      const divName = divisionNameMap?.get(rect.id) || '';
      const divLabel = divName ? `Division ${rect.id} – ${divName}` : `Division ${rect.id}`;
      setDrill({ level: 'codes', divCode: rect.id, divLabel });
    } else if (drill.level === 'codes') {
      setDrill({
        level: 'items',
        divCode: (drill as { divCode: string; divLabel: string }).divCode,
        divLabel: (drill as { divCode: string; divLabel: string }).divLabel,
        costCode: rect.id,
        codeLabel: rect.label,
      });
    } else if (drill.level === 'items') {
      const oppId = rect.meta?.opportunityId as string | undefined;
      if (oppId) setSelectedOpportunityId(oppId);
    }
  }, [drill, setSelectedOpportunityId, divisionNameMap]);

  // Breadcrumb segments
  const breadcrumbs: { label: string; onClick: () => void }[] = [
    { label: 'All Divisions', onClick: () => setDrill({ level: 'divisions' }) },
  ];
  if (drill.level === 'codes' || drill.level === 'items') {
    breadcrumbs.push({
      label: drill.divLabel,
      onClick: () => setDrill({ level: 'codes', divCode: drill.divCode, divLabel: drill.divLabel }),
    });
  }
  if (drill.level === 'items') {
    breadcrumbs.push({ label: drill.codeLabel, onClick: () => {} });
  }

  if (rects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400 py-8">
        No budget data available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2 items-center">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs px-1">
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400 dark:text-slate-500">›</span>}
            <button
              onClick={bc.onClick}
              className={`font-medium transition-colors ${
                i === breadcrumbs.length - 1
                  ? 'text-slate-700 dark:text-slate-200 cursor-default'
                  : 'text-sky-600 dark:text-sky-400 hover:text-sky-500 cursor-pointer'
              }`}
            >
              {bc.label}
            </button>
          </span>
        ))}
      </nav>

      {/* SVG Treemap */}
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="max-w-full rounded-lg">
        {rects.map((r) => {
          const ve = (r.meta?.veImpact as number) ?? 0;
          const isMatch = filteredSet ? filteredSet.has(r.id) || drill.level !== 'codes' : true;
          const opacity = filteredSet && !isMatch ? 0.15 : 1;

          return (
            <g key={r.id}>
              <rect
                x={r.x + 1} y={r.y + 1}
                width={Math.max(r.width - 2, 0)}
                height={Math.max(r.height - 2, 0)}
                rx={3}
                fill={getColor(ve, r.value)}
                opacity={opacity}
                className="cursor-pointer transition-opacity duration-200 hover:brightness-110 stroke-white dark:stroke-slate-900"
                strokeWidth={1}
                onClick={() => handleClick(r)}
                onMouseMove={(e) => handlers.onMouseMove(e, {
                  label: r.label,
                  budget: r.value,
                  veImpact: ve,
                  percentOfParent: parentTotal > 0 ? (r.value / parentTotal) * 100 : 0,
                })}
                onMouseLeave={handlers.onMouseLeave}
              />
              {/* Label — only show if rect is large enough */}
              {r.width > 60 && r.height > 28 && (
                <foreignObject x={r.x + 4} y={r.y + 4} width={r.width - 8} height={r.height - 8} className="pointer-events-none">
                  <div className="text-[10px] font-semibold text-white truncate leading-tight drop-shadow-sm" style={{ opacity }}>
                    {r.label}
                  </div>
                  {r.height > 42 && (
                    <div className="text-[9px] text-white/80 truncate mt-0.5 drop-shadow-sm" style={{ opacity }}>
                      {fmtC(r.value)}
                    </div>
                  )}
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      <ChartTooltip visible={tip.visible} x={tip.x} y={tip.y}>
        {tip.data && (
          <>
            <div className="font-bold mb-1.5 border-b border-slate-600 pb-1 truncate">{tip.data.label}</div>
            <div className="flex justify-between gap-4"><span>Budget:</span><span className="font-semibold">{fmtC(tip.data.budget)}</span></div>
            <div className="flex justify-between gap-4"><span>Share:</span><span>{tip.data.percentOfParent.toFixed(1)}%</span></div>
            {tip.data.veImpact !== 0 && (
              <div className={`flex justify-between gap-4 mt-1 pt-1 border-t border-slate-600 ${tip.data.veImpact < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span>VE Impact:</span><span className="font-semibold">{fmtC(tip.data.veImpact)}</span>
              </div>
            )}
            {drill.level === 'items' && <div className="text-slate-400 mt-1 text-[10px]">Click to open details</div>}
            {drill.level !== 'items' && <div className="text-slate-400 mt-1 text-[10px]">Click to drill down</div>}
          </>
        )}
      </ChartTooltip>
    </div>
  );
}
