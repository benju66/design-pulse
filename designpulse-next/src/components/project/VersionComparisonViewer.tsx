'use client';
/**
 * VersionComparisonViewer.tsx — Phase 5: Multi-Version Forensic Accounting Matrix
 *
 * Full-page, multi-version comparison matrix with:
 * - Multi-select chip picker for version selection (min 2, max 10)
 * - Dynamic TanStack columns generated per selected version
 * - Variance heatmap cells using Tailwind dark:-safe utility classes (FIX #5)
 * - Division grouping via getGroupedRowModel()
 * - Virtualized rows for high-performance rendering
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from '@tanstack/react-table';
import { GitCompareArrows, Check, ChevronDown, ChevronRight, Loader2, AlertCircle, Star } from 'lucide-react';
import { useProjectEstimateVersions, useMultiVersionMatrix } from '@/hooks/useEstimateQueries';
import type { ProjectEstimateVersion } from '@/types/models';

// ── Internal row shape for the TanStack table ───────────────────────────────────
interface MatrixRow {
  cost_code: string;
  description: string;
  division: string; // first 2 chars of cost_code for grouping
  [versionId: string]: string | number; // dynamic version amount keys
}

// ── Formatting helpers ──────────────────────────────────────────────────────────
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
  if (abs < 0.01) return ''; // effectively zero — transparent

  if (pctChange > 0) {
    // Cost increase — rose tiers
    if (abs >= 0.20) return 'bg-rose-100 dark:bg-rose-900/50';
    if (abs >= 0.10) return 'bg-rose-50 dark:bg-rose-950/40';
    return 'bg-rose-50/50 dark:bg-rose-950/20';
  } else {
    // Cost decrease — emerald tiers
    if (abs >= 0.20) return 'bg-emerald-100 dark:bg-emerald-900/50';
    if (abs >= 0.10) return 'bg-emerald-50 dark:bg-emerald-950/40';
    return 'bg-emerald-50/50 dark:bg-emerald-950/20';
  }
}

// ── Version Chip Picker ─────────────────────────────────────────────────────────
function VersionChipPicker({
  versions,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: {
  versions: ProjectEstimateVersion[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onSelectAll}
        disabled={selectedIds.size === versions.length}
        className="px-2.5 py-1 text-xs font-medium bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/50 disabled:opacity-40 transition-colors"
      >
        Select All
      </button>
      <button
        onClick={onClear}
        disabled={selectedIds.size === 0}
        className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
      >
        Clear
      </button>
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
      {versions.map((v) => {
        const isSelected = selectedIds.has(v.id);
        return (
          <button
            key={v.id}
            onClick={() => onToggle(v.id)}
            disabled={selectedIds.size >= 10 && !isSelected}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              isSelected
                ? 'bg-sky-500 dark:bg-sky-600 text-white border-sky-500 dark:border-sky-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 disabled:opacity-30'
            }`}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
            {v.version_name}
            {v.is_active && <Star size={10} className={isSelected ? 'text-amber-200' : 'text-amber-500'} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────
export function VersionComparisonViewer({ projectId }: { projectId: string }) {
  const { data: versions = [], isLoading: versionsLoading } = useProjectEstimateVersions(projectId);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);

  // Selection handlers
  const selectedSet = useMemo(() => new Set(selectedVersionIds), [selectedVersionIds]);

  const handleToggle = useCallback((id: string) => {
    setSelectedVersionIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedVersionIds(versions.slice(0, 10).map((v) => v.id));
  }, [versions]);

  const handleClear = useCallback(() => {
    setSelectedVersionIds([]);
  }, []);

  // Fetch matrix data
  const { data: rawData = [], isLoading: matrixLoading, error: matrixError } = useMultiVersionMatrix(
    projectId,
    selectedVersionIds
  );

  // Sort versions chronologically for column ordering
  const sortedVersionMeta = useMemo(() => {
    const versionMap = new Map(versions.map((v) => [v.id, v]));
    return selectedVersionIds
      .map((id) => versionMap.get(id))
      .filter((v): v is ProjectEstimateVersion => !!v)
      .sort((a, b) => new Date(a.version_date).getTime() - new Date(b.version_date).getTime());
  }, [selectedVersionIds, versions]);

  // Reshape raw RPC data into pivoted matrix rows
  const matrixRows = useMemo((): MatrixRow[] => {
    if (rawData.length === 0) return [];

    // Group by cost_code
    const rowMap = new Map<string, MatrixRow>();
    for (const r of rawData) {
      if (!rowMap.has(r.cost_code)) {
        rowMap.set(r.cost_code, {
          cost_code: r.cost_code,
          description: r.description,
          division: r.cost_code.substring(0, 2) || 'XX',
        });
      }
      const row = rowMap.get(r.cost_code)!;
      row[r.version_id] = Number(r.budget_amount) || 0;
    }
    return Array.from(rowMap.values());
  }, [rawData]);

  // Find the baseline version (first chronologically) for heatmap calculations
  const baselineVersionId = sortedVersionMeta.length > 0 ? sortedVersionMeta[0].id : null;

  // Build dynamic columns
  const columns = useMemo((): ColumnDef<MatrixRow>[] => {
    const fixed: ColumnDef<MatrixRow>[] = [
      {
        id: 'division',
        accessorKey: 'division',
        header: 'Division',
        size: 90,
        enableGrouping: true,
      },
      {
        accessorKey: 'cost_code',
        header: 'Cost Code',
        size: 130,
        cell: (info) => (
          <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        size: 260,
        cell: (info) => (
          <span className="text-sm text-slate-600 dark:text-slate-400 truncate block max-w-[240px]" title={info.getValue() as string}>
            {info.getValue() as string}
          </span>
        ),
      },
    ];

    const dynamic: ColumnDef<MatrixRow>[] = sortedVersionMeta.map((v) => ({
      id: v.id,
      header: () => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-bold truncate max-w-[120px]">{v.version_name}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
            {new Date(v.version_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
          {v.is_active && <span className="text-[9px] text-amber-500 font-bold">★ ACTIVE</span>}
        </div>
      ),
      accessorFn: (row: MatrixRow) => (row[v.id] as number) ?? 0,
      cell: (info: { getValue: () => unknown; row: { original: MatrixRow } }) => {
        const amount = info.getValue() as number;
        const baselineAmount = baselineVersionId ? (info.row.original[baselineVersionId] as number ?? 0) : 0;

        // Calculate percentage change from baseline
        let pctChange = 0;
        if (v.id !== baselineVersionId && baselineAmount !== 0) {
          pctChange = (amount - baselineAmount) / Math.abs(baselineAmount);
        }
        const heatClass = v.id === baselineVersionId ? '' : getHeatmapClass(pctChange);

        return (
          <div className={`px-3 py-2 text-right tabular-nums text-sm h-full flex items-center justify-end ${heatClass}`}>
            {amount !== 0 ? (
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(amount)}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">—</span>
            )}
          </div>
        );
      },
      size: 150,
      aggregationFn: 'sum' as const,
      aggregatedCell: (info: { getValue: () => unknown }) => {
        const sum = info.getValue() as number;
        return (
          <div className="px-3 py-2 text-right tabular-nums text-sm font-bold text-slate-700 dark:text-slate-200">
            {sum !== 0 ? formatCurrency(sum) : '—'}
          </div>
        );
      },
      enableSorting: true,
    }));

    return [...fixed, ...dynamic];
  }, [sortedVersionMeta, baselineVersionId]);

  // TanStack table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Fix: Defer setting the default "expand all" state until after mount
  // to prevent TanStack Table from firing state correction callbacks during the initial render phase.
  useEffect(() => {
    setExpanded(true);
  }, []);

  const allDivisions = useMemo(() => {
    return Array.from(new Set(matrixRows.map((r) => r.division)));
  }, [matrixRows]);

  const handleExpandedChange = useCallback(
    (updater: any) => {
      setExpanded((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater;
        // If transitioning from boolean `true` (all expanded) to an object,
        // we must preserve all other groups as expanded, otherwise they will instantly collapse.
        if (old === true && typeof next === 'object' && next !== null) {
          const preserved: Record<string, boolean> = {};
          allDivisions.forEach((div) => {
            preserved[`division:${div}`] = true;
          });
          return { ...preserved, ...next };
        }
        return next;
      });
    },
    [allDivisions]
  );

  const table = useReactTable({
    data: matrixRows,
    columns,
    state: { sorting, expanded, grouping: ['division'] },
    onSortingChange: setSorting,
    onExpandedChange: handleExpandedChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    columnResizeMode: 'onChange',
    autoResetExpanded: false,
    autoResetPageIndex: false,
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 36, // Base row height
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-2 bg-sky-100 dark:bg-sky-900/40 rounded-lg">
          <GitCompareArrows size={20} className="text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Version Comparison Matrix</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select 2+ estimate versions to compare budget data across cost codes.
          </p>
        </div>
      </div>

      {/* Version Picker */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shrink-0">
        {versionsLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading versions…
          </div>
        ) : versions.length < 2 ? (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
            <AlertCircle size={16} />
            Import at least two estimate versions in Project Settings → Estimate to use this tool.
          </div>
        ) : (
          <VersionChipPicker
            versions={versions}
            selectedIds={selectedSet}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onClear={handleClear}
          />
        )}
      </div>

      {/* Matrix Grid */}
      <div 
        ref={tableContainerRef}
        className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
      >
        {selectedVersionIds.length < 2 ? (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm italic p-12">
            Select at least 2 versions above to generate the comparison matrix.
          </div>
        ) : matrixLoading ? (
          <div className="flex items-center justify-center h-full flex-col gap-3 text-slate-500 p-12">
            <Loader2 size={28} className="animate-spin text-sky-500" />
            <span>Building forensic matrix…</span>
          </div>
        ) : matrixError ? (
          <div className="flex items-center justify-center h-full flex-col gap-3 text-rose-500 p-12">
            <AlertCircle size={28} className="opacity-50" />
            <span className="font-medium">Failed to load comparison data.</span>
            <span className="text-sm opacity-70">{matrixError.message}</span>
          </div>
        ) : matrixRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm italic p-12">
            No overlapping budget data found between selected versions.
          </div>
        ) : (
          <table className="w-full text-left border-separate border-spacing-0 whitespace-nowrap">
            <thead className="sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors select-none"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];

                if (row.getIsGrouped()) {
                  // Group row — division header
                  return (
                    <tr
                      key={row.id}
                      ref={virtualizer.measureElement}
                      data-index={virtualRow.index}
                      className="bg-slate-100/80 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                      onClick={row.getToggleExpandedHandler()}
                    >
                      <td colSpan={3} className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          {row.getIsExpanded() ? (
                            <ChevronDown size={14} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={14} className="text-slate-400" />
                          )}
                          <span className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                            Division {row.getValue('division') as string}
                          </span>
                          <span className="text-xs text-slate-500 font-normal">
                            ({row.subRows.length} items)
                          </span>
                        </span>
                      </td>
                      {/* Render aggregated cells for version columns */}
                      {row.getVisibleCells().slice(3).map((cell) => (
                        <td key={cell.id} className="px-0 py-0 border-b border-slate-200 dark:border-slate-700">
                          {cell.getIsAggregated()
                            ? flexRender(cell.column.columnDef.aggregatedCell, cell.getContext())
                            : null}
                        </td>
                      ))}
                    </tr>
                  );
                }

                // Leaf row
                return (
                  <tr
                    key={row.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-0 border-b border-slate-100 dark:border-slate-800/50">
                        {cell.getIsGrouped() ? null : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer stats */}
      {matrixRows.length > 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 flex gap-4">
          <span>{matrixRows.length} cost codes</span>
          <span>{sortedVersionMeta.length} versions compared</span>
          <span>Baseline: {sortedVersionMeta[0]?.version_name ?? '—'}</span>
        </div>
      )}
    </div>
  );
}
