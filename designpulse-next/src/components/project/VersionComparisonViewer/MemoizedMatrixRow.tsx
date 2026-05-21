"use client";

import React, { useMemo } from 'react';
import { flexRender, type Row, type Cell } from '@tanstack/react-table';
import { type VirtualItem } from '@tanstack/react-virtual';
import { MessageSquare, PanelRight } from 'lucide-react';
import type { MatrixRow } from './types';
import { useUIStore } from '@/stores/useUIStore';
import { formatCostCode } from '@/lib/formatCostCode';

// Let's re-declare the currency formatter for local utilization
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

function getHeatmapClass(pctChange: number): string {
  const abs = Math.abs(pctChange);
  if (abs < 0.01) return ''; // effectively zero

  if (pctChange > 0) {
    if (abs >= 0.20) return 'bg-rose-200/70 dark:bg-rose-900/40 text-rose-950 dark:text-rose-50 font-bold';
    if (abs >= 0.10) return 'bg-rose-100/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 font-semibold';
    return 'bg-rose-50/70 dark:bg-rose-950/15 text-rose-800 dark:text-rose-300';
  } else {
    if (abs >= 0.20) return 'bg-emerald-200/70 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-50 font-bold';
    if (abs >= 0.10) return 'bg-emerald-100/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold';
    return 'bg-emerald-50/70 dark:bg-emerald-950/15 text-emerald-800 dark:text-emerald-300';
  }
}
interface MemoizedMatrixRowProps {
  row: Row<MatrixRow>;
  virtualRow: VirtualItem;
  measureElement: (el: Element | null) => void;
  rawCostCodes: Array<{ code: string; description?: string }>;
  baselineVersionId: string | null;
  sortedVersionMeta?: any[];
  visibleColumnIds: string;
  pinnedColumnOffsets: string;
  onOpenVarianceHistory: (costCode: string, description: string) => void;
  selectedOpportunityId: string | null;
  showStepDeltas?: boolean;
}

export const MemoizedMatrixRow = React.memo(
  function MemoizedMatrixRow({
    row,
    virtualRow,
    measureElement,
    rawCostCodes,
    baselineVersionId,
    sortedVersionMeta = [],
    onOpenVarianceHistory,
    selectedOpportunityId,
    showStepDeltas = false,
  }: MemoizedMatrixRowProps) {
    void showStepDeltas;
    const setSelectedOpportunityId = useUIStore((s) => s.setSelectedOpportunityId);
    const setVeGridViewMode = useUIStore((s) => s.setVeGridViewMode);
    // ── CSI Division Mapping & Formatting ──────────────────────────────────────
    const divisionVal = row.getValue('division') as string;
    const divisionLabel = useMemo(() => {
      let label = divisionVal ? `${divisionVal}` : 'UNCATEGORIZED';
      if (divisionVal === 'Uncategorized' || !divisionVal) {
        return 'UNCATEGORIZED';
      }
      
      const divNum = divisionVal.substring(0, 2);
      const isNumericDiv = divNum.length === 2 && divNum[0] >= '0' && divNum[0] <= '9' && divNum[1] >= '0' && divNum[1] <= '9';
      if (!isNumericDiv) {
        return 'UNCATEGORIZED';
      }

      if (rawCostCodes.length > 0) {
        const paddedCode = divNum.padEnd(6, '0');
        const match = rawCostCodes.find(
          (c) => c.code === paddedCode || c.code.startsWith(divNum)
        );
        if (match && match.description) {
          label = `DIVISION ${divNum} — ${match.description.toUpperCase()}`;
        } else {
          label = `DIVISION ${divNum}`;
        }
      } else {
        label = `DIVISION ${divNum}`;
      }
      return label;
    }, [divisionVal, rawCostCodes]);

    // ── Render Group Row (Division Header) ───────────────────────────────────
    if (row.getIsGrouped()) {
      const hasTotalDelta = sortedVersionMeta.length >= 2;
      const pinnedColSpan = hasTotalDelta ? 4 : 3;

      const spannedCells = row.getVisibleCells().slice(0, pinnedColSpan);
      const pinnedColWidth = spannedCells.reduce((acc, cell) => acc + cell.column.getSize(), 0);

      return (
        <tr
          ref={measureElement}
          data-index={virtualRow.index}
          className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
          onClick={row.getToggleExpandedHandler()}
        >
          {/* Label Colspan td: covers sticky pinned columns (open_panel, cost_classification, variance_comment, total_delta) */}
          <td
            colSpan={pinnedColSpan}
            className="px-3 py-2 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 bg-clip-padding border-r border-b border-slate-200 dark:border-slate-800 select-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]"
            style={{ width: pinnedColWidth }}
          >
            <span className="flex items-center gap-2">
              <span className="text-slate-400 dark:text-slate-500 text-[10px] shrink-0">
                {row.getIsExpanded() ? '▼' : '▶'}
              </span>
              <span className="font-bold text-xs tracking-wider text-slate-800 dark:text-slate-200 uppercase">
                {divisionLabel}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold shrink-0">
                ({row.subRows.length} item{row.subRows.length !== 1 ? 's' : ''})
              </span>
            </span>
          </td>
          {/* Render aggregated version cells */}
          {row.getVisibleCells().slice(pinnedColSpan).map((cell) => (
            <td
              key={cell.id}
              className="px-0 py-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle bg-clip-padding"
              style={{ width: cell.column.getSize() }}
            >
              {cell.getIsAggregated()
                ? flexRender(cell.column.columnDef.aggregatedCell, cell.getContext())
                : null}
            </td>
          ))}
        </tr>
      );
    }

    // ── Render Leaf Row ──────────────────────────────────────────────────────
    const targetId = row.original.opportunity_id || `budget-${row.original.cost_code}`;
    const isSelected = selectedOpportunityId === targetId;

    return (
      <tr
        ref={measureElement}
        data-index={virtualRow.index}
        onDoubleClick={() => {
          if (selectedOpportunityId === targetId) {
            setSelectedOpportunityId(null);
          } else {
            setSelectedOpportunityId(targetId);
            setVeGridViewMode('split');
          }
        }}
        className={`border-b border-slate-100 dark:border-slate-800/40 transition-colors select-none cursor-pointer ${
          isSelected
            ? 'bg-sky-50/80 dark:bg-sky-900/40 hover:bg-sky-100/85 dark:hover:bg-sky-900/50'
            : 'hover:bg-slate-50 dark:hover:bg-slate-850/20'
        }`}
      >
        {row.getVisibleCells().map((cell: Cell<MatrixRow, unknown>) => {
          const isPinned = cell.column.getIsPinned() === 'left';
          const isLastPinned = isPinned && cell.column.getIsLastColumn('left');
          
          if (cell.getIsGrouped() || cell.getIsPlaceholder()) {
            return (
              <td
                key={cell.id}
                className="p-0 border-r border-b border-slate-200 dark:border-slate-800 bg-clip-padding"
                style={{ width: cell.column.getSize() }}
              />
            );
          }

          // ── Fixed Pinned Columns ───────────────────────────────────────────
          if (isPinned) {
            const leftOffset = cell.column.getStart('left');
            const width = cell.column.getSize();

            let cellContent = null;
            if (cell.column.id === 'open_panel') {
              cellContent = (
                <div className="flex items-center justify-center h-full">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedOpportunityId === targetId) {
                        setSelectedOpportunityId(null);
                      } else {
                        setSelectedOpportunityId(targetId);
                        setVeGridViewMode('split');
                      }
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className={`p-1 rounded transition-colors ${
                      isSelected
                        ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/30'
                        : 'text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30'
                    }`}
                    title={isSelected ? 'Close Details Panel' : 'Open Details Panel'}
                  >
                    <PanelRight size={18} />
                  </button>
                </div>
              );
            } else if (cell.column.id === 'cost_classification') {
              const code = row.original.cost_code;
              const description = row.original.description;
              const formatted = code ? formatCostCode(code) : '';
              const topLine = formatted ? `${formatted} – ${description}` : description;
              
              // Find division name using rawCostCodes
              const divisionVal = row.original.division;
              const divisionName = (() => {
                if (!divisionVal || divisionVal === 'Uncategorized') return '';
                const divNum = divisionVal.substring(0, 2);
                const paddedCode = divNum.padEnd(6, '0');
                const match = rawCostCodes.find(
                  (c) => c.code === paddedCode || c.code.startsWith(divNum)
                );
                return match?.description || '';
              })();

              const bottomLine = divisionVal && divisionVal !== 'Uncategorized' 
                ? `Div ${divisionVal.substring(0, 2)} – ${divisionName}`
                : 'Uncategorized';

              cellContent = (
                <div className="w-full h-full px-3 py-2 min-h-[36px] flex flex-col justify-center gap-0.5" title={topLine}>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums truncate">
                    {topLine}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-semibold uppercase tracking-wider">
                    {bottomLine}
                  </span>
                </div>
              );
            } else if (cell.column.id === 'variance_comment') {
              cellContent = (
                <div className="flex items-center justify-center h-full">
                  {row.original.has_variance_comment ? (
                    <div className="relative group/tooltip flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenVarianceHistory(row.original.cost_code, row.original.description);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="p-1 rounded text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 transition-colors bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-950/50"
                        title="Click to view full timeline"
                      >
                        <MessageSquare size={16} />
                      </button>

                      {/* Premium Glassmorphic Hover Tooltip showing all comments */}
                      <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 hidden group-hover/tooltip:flex flex-col z-[60] w-64 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur text-white rounded-xl shadow-xl p-3 border border-slate-700/50 text-left normal-case pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="text-[10px] font-extrabold tracking-wider text-sky-400 uppercase mb-1 flex items-center gap-1.5">
                          <MessageSquare size={10} className="text-sky-400" />
                          <span>Variance Notes</span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {sortedVersionMeta.map((v: any) => {
                            const note = row.original[`${v.id}_note` as keyof MatrixRow];
                            if (!note) return null;
                            return (
                              <div key={v.id} className="border-t border-slate-800/80 pt-1.5 first:border-0 first:pt-0">
                                <div className="text-[9px] font-bold text-slate-400">{v.version_name}</div>
                                <div className="text-[10px] font-medium leading-normal text-slate-200 whitespace-pre-wrap">{note}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="absolute top-full right-1/2 translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-800/95" />
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-700 italic select-none">—</span>
                  )}
                </div>
              );
            } else if (cell.column.id === 'total_delta') {
              if (sortedVersionMeta.length < 2) {
                cellContent = (
                  <div className="flex items-center justify-end h-full px-3">
                    <span className="text-[10px] text-slate-300 dark:text-slate-700 italic select-none">—</span>
                  </div>
                );
              } else {
                const baseId = sortedVersionMeta[0].id;
                const latestId = sortedVersionMeta[sortedVersionMeta.length - 1].id;
                const baseAmount = Number(row.original[baseId]) || 0;
                const latestAmount = Number(row.original[latestId]) || 0;
                const delta = latestAmount - baseAmount;
                
                let pct = 0;
                if (baseAmount !== 0) {
                  pct = delta / Math.abs(baseAmount);
                } else if (latestAmount !== 0) {
                  pct = latestAmount > 0 ? 1 : -1;
                }

                const deltaText = delta > 0 ? `+${formatCurrency(delta)}` : delta < 0 ? formatCurrency(delta) : '—';
                const pctText = delta !== 0 ? `${delta > 0 ? '+' : ''}${(pct * 100).toFixed(1)}%` : '';

                cellContent = (
                  <div className="w-full h-full px-3 py-1 flex flex-col justify-center items-end select-none">
                    <span className="text-xs font-bold font-mono">{deltaText}</span>
                    {pctText && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{pctText}</span>}
                  </div>
                );
              }
            }

            let cellHeatmapClass = '';
            if (cell.column.id === 'total_delta' && sortedVersionMeta.length >= 2) {
              const baseId = sortedVersionMeta[0].id;
              const latestId = sortedVersionMeta[sortedVersionMeta.length - 1].id;
              const baseAmount = Number(row.original[baseId]) || 0;
              const latestAmount = Number(row.original[latestId]) || 0;
              const delta = latestAmount - baseAmount;
              let pct = 0;
              if (baseAmount !== 0) {
                pct = delta / Math.abs(baseAmount);
              } else if (latestAmount !== 0) {
                pct = latestAmount > 0 ? 1 : -1;
              }
              cellHeatmapClass = getHeatmapClass(pct);
            }

            return (
              <td
                key={cell.id}
                data-row-index={virtualRow.index}
                data-col-id={cell.column.id}
                className={`border-r border-b border-slate-200 dark:border-slate-800 align-middle bg-clip-padding sticky left-0 z-10 ${
                  isSelected
                    ? 'bg-sky-50 dark:bg-slate-800'
                    : (cellHeatmapClass ? cellHeatmapClass : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/80')
                } ${
                  isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2 border-slate-200 dark:border-slate-800' : ''
                }`}
                style={{ left: leftOffset, width: width }}
              >
                {cellContent}
              </td>
            );
          }

          // ── Dynamic Version Columns ────────────────────────────────────────
          const versionId = cell.column.id;
          const amount = cell.getValue() as number;

          if (versionId.startsWith('step_delta_')) {
            const match = versionId.match(/^step_delta_(.+)_vs_(.+)$/);
            if (match) {
              const priorId = match[2];
              const priorAmount = Number(row.original[priorId]) || 0;
              const delta = amount;
              
              let pct = 0;
              if (priorAmount !== 0) {
                pct = delta / Math.abs(priorAmount);
              } else if (delta !== 0) {
                pct = delta > 0 ? 1 : -1;
              }

              const deltaText = delta > 0 ? `+${formatCurrency(delta)}` : delta < 0 ? formatCurrency(delta) : '—';
              const pctText = delta !== 0 ? `${delta > 0 ? '+' : ''}${(pct * 100).toFixed(1)}%` : '';
              const heatClass = getHeatmapClass(pct);

              return (
                <td
                  key={cell.id}
                  className={`px-3 py-1.5 border-r border-b border-slate-200 dark:border-slate-800 align-middle text-right tabular-nums text-xs font-semibold relative bg-clip-padding ${heatClass}`}
                  style={{ width: cell.column.getSize() }}
                >
                  <div className="flex flex-col justify-center items-end h-full select-none">
                    <span className="text-xs font-bold font-mono">{deltaText}</span>
                    {pctText && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{pctText}</span>}
                  </div>
                </td>
              );
            }
          }

          const baselineAmount = baselineVersionId 
            ? (row.original[baselineVersionId] as number ?? 0) 
            : 0;

          // Calculate percentage variance relative to baseline version with zero-baseline handling
          let pctChange = 0;
          if (versionId !== baselineVersionId) {
            if (baselineAmount !== 0) {
              pctChange = (amount - baselineAmount) / Math.abs(baselineAmount);
            } else if (amount !== 0) {
              pctChange = amount > 0 ? 1.0 : -1.0;
            }
          }

          const isBaseline = versionId === baselineVersionId;
          const heatClass = isBaseline ? '' : getHeatmapClass(pctChange);
          const cellNote = row.original[`${versionId}_note` as keyof MatrixRow] as string | undefined;

          return (
            <td
              key={cell.id}
              className={`px-3 py-1.5 border-r border-b border-slate-200 dark:border-slate-800 align-middle text-right tabular-nums text-xs font-semibold relative bg-clip-padding group/cell ${heatClass}`}
              style={{ width: cell.column.getSize() }}
            >
              <div className="flex items-center justify-end gap-1.5 h-full">
                {cellNote && (
                  <div className="relative group/celltooltip flex items-center justify-center">
                    <MessageSquare size={11} className="text-sky-500 shrink-0 cursor-help" />
                    {/* Premium Cell Hover Tooltip */}
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover/celltooltip:flex flex-col z-[60] w-56 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur text-white rounded-xl shadow-xl p-2.5 border border-slate-700/50 text-left normal-case pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-150 font-sans">
                      <div className="text-[9px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Upload Note</div>
                      <div className="text-[10px] font-medium leading-normal text-slate-200 whitespace-pre-wrap">{cellNote}</div>
                      <div className="absolute top-full right-1.5 -mt-1 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-800/95" />
                    </div>
                  </div>
                )}
                {amount !== 0 ? (
                  <span className="font-mono">{formatCurrency(amount)}</span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-700">—</span>
                )}
              </div>
            </td>
          );
        })}
      </tr>
    );
  },
  (prev, next) => {
    return (
      prev.row.original === next.row.original &&
      prev.row.getIsExpanded() === next.row.getIsExpanded() &&
      prev.row.getIsGrouped() === next.row.getIsGrouped() &&
      prev.visibleColumnIds === next.visibleColumnIds &&
      prev.pinnedColumnOffsets === next.pinnedColumnOffsets &&
      prev.virtualRow.index === next.virtualRow.index &&
      prev.baselineVersionId === next.baselineVersionId &&
      prev.rawCostCodes === next.rawCostCodes &&
      prev.selectedOpportunityId === next.selectedOpportunityId &&
      prev.sortedVersionMeta === next.sortedVersionMeta &&
      prev.showStepDeltas === next.showStepDeltas
    );
  }
);
