"use client";

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
import { GitCompareArrows, Loader2, AlertCircle, ChevronUp, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useProjectEstimateVersions, useMultiVersionMatrix } from '@/hooks/useEstimateQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useOpportunities } from '@/hooks/useOpportunityQueries';
import type { ProjectEstimateVersion } from '@/types/models';
import type { MatrixRow } from './types';
import { useUIStore } from '@/stores/useUIStore';
import { VersionChipPicker } from './VersionChipPicker';
import { MemoizedMatrixRow } from './MemoizedMatrixRow';
import { VarianceHistoryDrawer } from './VarianceHistoryDrawer';
import { OpportunityDetailDrawer } from './OpportunityDetailDrawer';
import { Button } from '@/components/ui/Button';
import { GridFilterDrawer } from '@/components/ui/GridFilterDrawer';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';

// Currency formatting helper
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

export function VersionComparisonViewer({
  projectId,
  initialSelectedVersionIds,
  hidePicker = false,
}: {
  projectId: string;
  initialSelectedVersionIds?: string[];
  hidePicker?: boolean;
}) {
  const { data: versions = [], isLoading: versionsLoading } = useProjectEstimateVersions(projectId);
  const { data: rawCostCodes = [] } = useCostCodes();
  const { data: opportunities = [] } = useOpportunities(projectId);

  // Zustand persistent selected versions (toggled via column visibility mapping)
  const persistedVisibility = useUIStore((s) => s.versionMatrixColumnVisibility[projectId] || {});
  const setPersistedVisibility = useUIStore((s) => s.setVersionMatrixColumnVisibility);
  const hasPersistedEntry = useUIStore((s) => s.versionMatrixColumnVisibility[projectId] !== undefined);
  const selectedOpportunityId = useUIStore((s) => s.selectedOpportunityId);

  // Interactive Matrix Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDivisions, setActiveDivisions] = useState<string[]>([]);
  const [showVarianceOnly, setShowVarianceOnly] = useState(false);
  const [varianceMagnitudeThreshold, setVarianceMagnitudeThreshold] = useState(0);
  const [showNotesOnly, setShowNotesOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showStepDeltas, setShowStepDeltas] = useState(false);

  // Dynamic Division Label Resolver
  const getDivisionLabel = useCallback((divisionVal: string) => {
    if (!divisionVal || divisionVal === 'Uncategorized') return 'UNCATEGORIZED';
    const divNum = divisionVal.substring(0, 2);
    const isNumericDiv = divNum.length === 2 && divNum[0] >= '0' && divNum[0] <= '9' && divNum[1] >= '0' && divNum[1] <= '9';
    if (!isNumericDiv) return 'UNCATEGORIZED';

    if (rawCostCodes.length > 0) {
      const paddedCode = divNum.padEnd(6, '0');
      const match = rawCostCodes.find(
        (c) => c.code === paddedCode || c.code.startsWith(divNum)
      );
      if (match && match.description) {
        return `DIVISION ${divNum} — ${match.description.toUpperCase()}`;
      }
    }
    return `DIVISION ${divNum}`;
  }, [rawCostCodes]);

  // Selected versions derived from Zustand persistence or prop override
  const selectedVersionIds = useMemo(() => {
    if (initialSelectedVersionIds && initialSelectedVersionIds.length > 0) {
      return initialSelectedVersionIds;
    }
    return Object.entries(persistedVisibility)
      .filter(([_, visible]) => visible)
      .map(([id]) => id);
  }, [persistedVisibility, initialSelectedVersionIds]);

  const selectedSet = useMemo(() => new Set(selectedVersionIds), [selectedVersionIds]);

  // Handle auto-populating default selections (first two/three versions) on initial load
  useEffect(() => {
    if (initialSelectedVersionIds) return;
    if (versions.length >= 2 && !hasPersistedEntry) {
      const defaultIds = versions.slice(0, 3).map((v) => v.id);
      const defaultVisibility: Record<string, boolean> = {};
      defaultIds.forEach((id) => {
        defaultVisibility[id] = true;
      });
      setPersistedVisibility(projectId, defaultVisibility);
    }
  }, [versions, hasPersistedEntry, projectId, setPersistedVisibility, initialSelectedVersionIds]);

  // Version Picker Action Handlers
  const handleToggle = useCallback((id: string) => {
    setPersistedVisibility(projectId, (prev) => {
      const next = { ...prev };
      next[id] = !next[id];
      return next;
    });
  }, [projectId, setPersistedVisibility]);

  const handleSelectAll = useCallback(() => {
    const allVisible: Record<string, boolean> = {};
    versions.slice(0, 10).forEach((v) => {
      allVisible[v.id] = true;
    });
    setPersistedVisibility(projectId, allVisible);
  }, [versions, projectId, setPersistedVisibility]);

  const handleClear = useCallback(() => {
    setPersistedVisibility(projectId, {});
  }, [projectId, setPersistedVisibility]);

  // Fetch pivoted matrix data using the hook
  const { data: rawData = [], isLoading: matrixLoading, error: matrixError } = useMultiVersionMatrix(
    projectId,
    selectedVersionIds
  );

  // Map cost_code to opportunity_id for details panel routing with robust normalization
  const costCodeToOpportunityIdMap = useMemo(() => {
    const map = new Map<string, string>();
    const normalizeCode = (c: string) => {
      const dotIdx = c.indexOf('.');
      const base = dotIdx !== -1 ? c.slice(0, dotIdx) : c;
      return base.replace(/[^0-9]/g, '').padStart(6, '0');
    };

    for (const opp of opportunities) {
      if (opp.cost_code) {
        const norm = normalizeCode(opp.cost_code);
        map.set(norm, opp.id);
        map.set(opp.cost_code, opp.id);
      }
    }
    return map;
  }, [opportunities]);

  // Chronological sort of the selected versions
  const sortedVersionMeta = useMemo(() => {
    const versionMap = new Map(versions.map((v) => [v.id, v]));
    return selectedVersionIds
      .map((id) => versionMap.get(id))
      .filter((v): v is ProjectEstimateVersion => !!v)
      .sort((a, b) => new Date(a.version_date).getTime() - new Date(b.version_date).getTime());
  }, [selectedVersionIds, versions]);

  // Transform raw multi-version database payload into pivoted rows with normalized key grouping
  const matrixRows = useMemo((): MatrixRow[] => {
    if (rawData.length === 0) return [];

    const normalizeCode = (c: string) => {
      const dotIdx = c.indexOf('.');
      const base = dotIdx !== -1 ? c.slice(0, dotIdx) : c;
      return base.replace(/[^0-9]/g, '').padStart(6, '0');
    };

    const rowMap = new Map<string, MatrixRow>();
    for (const r of rawData) {
      const norm = normalizeCode(r.cost_code);
      if (!rowMap.has(norm)) {
        rowMap.set(norm, {
          cost_code: r.cost_code,
          description: r.description,
          division: norm.substring(0, 2) || 'XX',
          opportunity_id: costCodeToOpportunityIdMap.get(norm) ?? costCodeToOpportunityIdMap.get(r.cost_code),
          has_variance_comment: false,
        });
      }
      const row = rowMap.get(norm)!;
      row[r.version_id] = Number(r.budget_amount) || 0;
      if (r.variance_note) {
        row[`${r.version_id}_note`] = r.variance_note;
        row.has_variance_comment = true;
      }
    }
    return Array.from(rowMap.values());
  }, [rawData, costCodeToOpportunityIdMap]);

  // CSI Division Options for MultiSelectFilter
  const divisionOptions = useMemo(() => {
    const divs = new Set<string>();
    matrixRows.forEach((r) => {
      const label = getDivisionLabel(r.division || 'Uncategorized');
      divs.add(label);
    });
    return Array.from(divs).sort();
  }, [matrixRows, getDivisionLabel]);

  // 5-Point Filtering Pipeline
  const filteredMatrixRows = useMemo(() => {
    return matrixRows.filter((row) => {
      // 1. Keyword search (cost code or description)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const codeMatch = row.cost_code?.toLowerCase().includes(query);
        const descMatch = row.description?.toLowerCase().includes(query);
        if (!codeMatch && !descMatch) return false;
      }

      // 2. Division Multi-Select
      if (activeDivisions.length > 0) {
        const label = getDivisionLabel(row.division || 'Uncategorized');
        if (!activeDivisions.includes(label)) return false;
      }

      // 3. Show Variance Items Only
      const selectedAmounts = selectedVersionIds.map((vid) => row[vid] as number ?? 0);
      const hasVariance = new Set(selectedAmounts).size > 1;
      if (showVarianceOnly && !hasVariance) {
        return false;
      }

      // 4. Variance Magnitude Threshold
      if (varianceMagnitudeThreshold > 0 && selectedAmounts.length >= 2) {
        const maxVal = Math.max(...selectedAmounts);
        const minVal = Math.min(...selectedAmounts);
        if (maxVal - minVal < varianceMagnitudeThreshold) {
          return false;
        }
      }

      // 5. Show Notes Only
      if (showNotesOnly) {
        const hasNote = selectedVersionIds.some((vid) => !!row[`${vid}_note` as keyof MatrixRow]);
        if (!hasNote) return false;
      }

      return true;
    });
  }, [
    matrixRows,
    searchTerm,
    activeDivisions,
    showVarianceOnly,
    varianceMagnitudeThreshold,
    showNotesOnly,
    selectedVersionIds,
    getDivisionLabel,
  ]);

  // Active filter count calculator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (activeDivisions.length > 0) count++;
    if (showVarianceOnly) count++;
    if (varianceMagnitudeThreshold > 0) count++;
    if (showNotesOnly) count++;
    return count;
  }, [searchTerm, activeDivisions.length, showVarianceOnly, varianceMagnitudeThreshold, showNotesOnly]);

  const handleClearAllFilters = useCallback(() => {
    setSearchTerm('');
    setActiveDivisions([]);
    setShowVarianceOnly(false);
    setVarianceMagnitudeThreshold(0);
    setShowNotesOnly(false);
  }, []);

  // Determine baseline version (earliest chronologically)
  const baselineVersionId = sortedVersionMeta.length > 0 ? sortedVersionMeta[0].id : null;

  // Build dynamic table columns
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
        id: 'open_panel',
        header: () => (
          <div className="flex items-center justify-center w-full text-center" title="Open Row Details">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Detail</span>
          </div>
        ),
        size: 60,
      },
      {
        id: 'cost_classification',
        header: 'Cost Classification',
        size: 320,
      },
      {
        id: 'variance_comment',
        header: () => (
          <div className="flex items-center justify-center w-full text-center" title="Variance Notes">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Notes</span>
          </div>
        ),
        size: 65,
      },
    ];

    if (sortedVersionMeta.length >= 2) {
      fixed.push({
        id: 'total_delta',
        header: () => (
          <div className="flex flex-col items-end gap-0.5 w-full select-none text-right normal-case">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {sortedVersionMeta.length > 2 ? 'Total Δ' : 'Variance Δ'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
              {sortedVersionMeta.length > 2 ? 'Latest vs Baseline' : 'Diff'}
            </span>
          </div>
        ),
        size: 110,
        accessorFn: (row: MatrixRow) => {
          const baseId = sortedVersionMeta[0].id;
          const latestId = sortedVersionMeta[sortedVersionMeta.length - 1].id;
          const baseVal = Number(row[baseId]) || 0;
          const latestVal = Number(row[latestId]) || 0;
          return latestVal - baseVal;
        },
        aggregationFn: 'sum' as const,
        aggregatedCell: (info: { getValue: () => unknown }) => {
          const sum = info.getValue() as number;
          return (
            <div className="px-3 py-1.5 text-right tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200">
              {sum !== 0 ? (sum > 0 ? `+${formatCurrency(sum)}` : formatCurrency(sum)) : '—'}
            </div>
          );
        },
      });
    }

    const dynamic: ColumnDef<MatrixRow>[] = [];
    sortedVersionMeta.forEach((v, index) => {
      // In dynamic step delta mode, render dynamic step-deltas between adjacent releases
      if (showStepDeltas && index > 0) {
        const prior = sortedVersionMeta[index - 1];
        dynamic.push({
          id: `step_delta_${v.id}_vs_${prior.id}`,
          header: () => (
            <div className="flex flex-col items-end gap-0.5 w-full select-none text-right normal-case">
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                Δ vs {prior.version_name}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                Step Change
              </span>
            </div>
          ),
          accessorFn: (row: MatrixRow) => {
            const valV = (row[v.id] as number) ?? 0;
            const valPrior = (row[prior.id] as number) ?? 0;
            return valV - valPrior;
          },
          size: 110,
          aggregationFn: 'sum' as const,
          aggregatedCell: (info: { getValue: () => unknown }) => {
            const sum = info.getValue() as number;
            return (
              <div className="px-3 py-1.5 text-right tabular-nums text-xs font-bold text-sky-600 dark:text-sky-400">
                {sum !== 0 ? (sum > 0 ? `+${formatCurrency(sum)}` : formatCurrency(sum)) : '—'}
              </div>
            );
          },
        });
      }

      dynamic.push({
        id: v.id,
        header: () => (
          <div className="flex flex-col items-end gap-0.5 w-full select-none text-right normal-case">
            <span className="text-xs font-bold truncate block w-full text-slate-800 dark:text-slate-200" title={v.version_name}>
              {v.version_name}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
              {new Date(v.version_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            {v.is_active && (
              <span className="text-[9px] text-amber-500 font-extrabold tracking-wider uppercase flex items-center gap-0.5">
                ★ Active
              </span>
            )}
          </div>
        ),
        accessorFn: (row: MatrixRow) => (row[v.id] as number) ?? 0,
        size: 155,
        aggregationFn: 'sum' as const,
        aggregatedCell: (info: { getValue: () => unknown }) => {
          const sum = info.getValue() as number;
          return (
            <div className="px-3 py-1.5 text-right tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200">
              {sum !== 0 ? formatCurrency(sum) : '—'}
            </div>
          );
        },
      });
    });

    return [...fixed, ...dynamic];
  }, [sortedVersionMeta, showStepDeltas]);

  // TanStack Table states
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const isAnyExpanded = useMemo(() => {
    return expanded === true || (typeof expanded === 'object' && Object.keys(expanded).length > 0);
  }, [expanded]);

  const handleToggleAllExpanded = useCallback(() => {
    if (isAnyExpanded) {
      setExpanded({});
    } else {
      setExpanded(true);
    }
  }, [isAnyExpanded]);

  // Note: Collapsed by default per user request. Expand All / Collapse All buttons manage batch states.

  const allDivisions = useMemo(() => {
    return Array.from(new Set(matrixRows.map((r) => r.division)));
  }, [matrixRows]);

  // Standard group-preserving expand changer
  const handleExpandedChange = useCallback(
    (updater: any) => {
      setExpanded((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater;
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
    data: filteredMatrixRows,
    columns,
    state: {
      sorting,
      expanded,
      grouping: ['division'],
      columnPinning: {
        left: [
          'open_panel',
          'cost_classification',
          'variance_comment',
          ...(sortedVersionMeta.length >= 2 ? ['total_delta'] : []),
        ],
      },
      columnVisibility: {
        division: false,
      },
    },
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

  // High performance virtualizer configurations
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48, // slightly taller to accommodate dual cost cell lines
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  // Forensic Sidebar Drawer State
  const [activeHistory, setActiveHistory] = useState<{ costCode: string; description: string } | null>(null);

  const handleOpenVarianceHistory = useCallback((costCode: string, description: string) => {
    setActiveHistory({ costCode, description });
  }, []);

  const handleCloseVarianceHistory = useCallback(() => {
    setActiveHistory(null);
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full relative overflow-hidden">
      {!hidePicker && (
        <>
          {/* Dynamic Glassmorphism Header */}
          <div className="flex items-center gap-3.5 shrink-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-1 rounded-xl">
            <div className="p-3 bg-gradient-to-br from-sky-500 to-indigo-600 dark:from-sky-600 dark:to-indigo-700 rounded-2xl shadow-lg shadow-sky-500/10 text-white animate-in fade-in duration-200">
              <GitCompareArrows size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Forensic Version Comparison Matrix
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
                Evaluate cost variances and review historical upload notes across estimate releases.
              </p>
            </div>
          </div>

          {/* Multi-Select Chip Picker Container */}
          <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shrink-0 shadow-sm animate-in slide-in-from-top-2 duration-200">
            {versionsLoading ? (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                <Loader2 size={14} className="animate-spin text-sky-500" /> Retrieve estimate baseline configurations…
              </div>
            ) : versions.length < 2 ? (
              <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 text-xs font-bold bg-rose-500/5 dark:bg-rose-500/10 px-4 py-2.5 rounded-xl border border-rose-500/10">
                <AlertCircle size={15} />
                Import at least two estimate versions in Project Settings to enable comparison.
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
        </>
      )}

      {/* Dynamic Action & Expand/Collapse Control Bar */}
      <div className="flex items-center justify-between gap-4 shrink-0 px-2 flex-wrap z-20">
        <div className="flex items-center gap-2">
          {/* Text Search Box */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Search cost code or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 w-64 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Drawer Trigger Button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm h-8 ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 text-[10px] font-extrabold text-white bg-sky-500 rounded-full animate-in zoom-in duration-200">
                {activeFilterCount}
              </span>
            )}
          </button>

          {sortedVersionMeta.length >= 3 && (
            <Button
              variant={showStepDeltas ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowStepDeltas(!showStepDeltas)}
              className={`text-[11px] font-bold px-3 py-1.5 h-8 transition-all flex items-center gap-1.5 ${
                showStepDeltas 
                  ? 'bg-sky-600 hover:bg-sky-700 text-white' 
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <GitCompareArrows size={13} className={showStepDeltas ? "text-white" : "text-slate-400 dark:text-slate-500"} />
              <span>Audit Deltas (Δ)</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleAllExpanded}
            className="text-[11px] font-bold px-3 py-1.5 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm transition-all flex items-center gap-1.5"
          >
            {isAnyExpanded ? (
              <>
                <ChevronUp size={13} className="text-slate-400 dark:text-slate-500" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronDown size={13} className="text-slate-400 dark:text-slate-500" />
                <span>Expand All</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Matrix Grid Sandbox */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm min-h-0 relative animate-in fade-in duration-300"
      >
        {selectedVersionIds.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-xs font-bold italic p-12 gap-2">
            <GitCompareArrows size={36} className="opacity-20 animate-pulse text-sky-500" />
            <span>Select at least 2 versions above to dynamically generate the comparative ledger.</span>
          </div>
        ) : matrixLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500 p-12">
            <Loader2 size={32} className="animate-spin text-sky-500 stroke-[2.5]" />
            <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Assembling Forensic Matrix…
            </span>
          </div>
        ) : matrixError ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-rose-500 p-12 text-center">
            <AlertCircle size={32} className="opacity-80" />
            <span className="text-sm font-bold">Failed to load comparison matrix</span>
            <span className="text-xs opacity-75 max-w-md">{matrixError.message}</span>
          </div>
        ) : matrixRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-bold italic p-12">
            No overlapping cost codes mapped between the selected estimates.
          </div>
        ) : filteredMatrixRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-bold italic p-12 gap-2">
            <SlidersHorizontal size={24} className="opacity-40 text-slate-400 dark:text-slate-500 animate-pulse" />
            <span>No cost codes match the current filter selection.</span>
            <button
              onClick={handleClearAllFilters}
              className="mt-2 px-3 py-1.5 text-xs font-semibold text-sky-500 hover:text-sky-600 transition-colors border border-sky-500/20 hover:border-sky-500/50 rounded-lg bg-sky-500/5 animate-in fade-in"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <table
            className="text-left text-sm whitespace-nowrap border-separate border-spacing-0"
            style={{ tableLayout: 'fixed', width: '100%', minWidth: table.getTotalSize() }}
          >
            {/* Lock column widths to prevent shrinking or shifts during expanding/collapsing */}
            <colgroup>
              {table.getVisibleLeafColumns().map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-20">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const isPinned = header.column.getIsPinned() === 'left';
                    const isLastPinned = isPinned && header.column.getIsLastColumn('left');
                    const pinStyle = isPinned
                      ? { left: header.column.getStart('left'), width: header.getSize() }
                      : { width: header.getSize() };

                    return (
                      <th
                        key={header.id}
                        className={`relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-b-2 border-slate-300 dark:border-slate-700 select-none group bg-slate-100 dark:bg-slate-900 bg-clip-padding ${
                          isPinned ? 'sticky z-30' : ''
                        } ${
                          isLastPinned
                            ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2 border-slate-300 dark:border-slate-700'
                            : ''
                        }`}
                        style={pinStyle}
                      >
                        <div
                          className={`min-w-0 flex items-center justify-between ${
                            header.column.getCanSort() ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white' : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className="truncate">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {{
                            asc: <ChevronUp size={14} className="ml-1 inline-block shrink-0" />,
                            desc: <ChevronDown size={14} className="ml-1 inline-block shrink-0" />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>

                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize user-select-none touch-none bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity ${
                              header.column.getIsResizing() ? 'opacity-100 bg-sky-600 w-2' : ''
                            }`}
                          />
                        )}
                      </th>
                    );
                  })}
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
                const visibleCells = row.getVisibleCells();
                const visibleColumnIds = visibleCells.map((c) => c.column.id).join(',');
                const pinnedColumnOffsets = visibleCells
                  .filter((c) => c.column.getIsPinned())
                  .map((c) => c.column.getStart('left'))
                  .join(',');

                return (
                  <MemoizedMatrixRow
                    key={row.id}
                    row={row}
                    virtualRow={virtualRow}
                    measureElement={virtualizer.measureElement}
                    rawCostCodes={rawCostCodes}
                    baselineVersionId={baselineVersionId}
                    sortedVersionMeta={sortedVersionMeta}
                    visibleColumnIds={visibleColumnIds}
                    pinnedColumnOffsets={pinnedColumnOffsets}
                    onOpenVarianceHistory={handleOpenVarianceHistory}
                    selectedOpportunityId={selectedOpportunityId}
                    showStepDeltas={showStepDeltas}
                  />
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

      {/* Grid Summary Footer */}
      {matrixRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 shrink-0 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span>
              {activeFilterCount > 0 ? `${filteredMatrixRows.length} of ${matrixRows.length}` : matrixRows.length} Mapped Cost Codes
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
            <span>{sortedVersionMeta.length} Compared Releases</span>
          </div>
          {sortedVersionMeta.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span>Baseline Estimate:</span>
              <span className="text-sky-500 dark:text-sky-400 font-extrabold">{sortedVersionMeta[0].version_name}</span>
            </div>
          )}
        </div>
      )}

      {/* Opportunity Detail slide-out drawer overlay */}
      <OpportunityDetailDrawer
        projectId={projectId}
        opportunities={opportunities}
      />

      {/* Forensic Slide-Out Drawer overlay */}
      <VarianceHistoryDrawer
        isOpen={!!activeHistory}
        onClose={handleCloseVarianceHistory}
        projectId={projectId}
        costCode={activeHistory?.costCode || ''}
        description={activeHistory?.description || ''}
      />

      {/* Advanced Filter Side Drawer */}
      <GridFilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        activeCount={activeFilterCount}
        onClearAll={handleClearAllFilters}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CSI Division</label>
          <MultiSelectFilter
            fullWidth
            label="CSI Division"
            options={divisionOptions}
            selected={activeDivisions}
            onChange={setActiveDivisions}
            placeholder="Search divisions..."
          />
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Variance Magnitude Threshold
          </label>
          <input
            type="range"
            min={0}
            max={250000}
            step={2500}
            value={varianceMagnitudeThreshold}
            onChange={(e) => setVarianceMagnitudeThreshold(Number(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {varianceMagnitudeThreshold === 0
                ? 'Show All'
                : `\u2265 ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(varianceMagnitudeThreshold)}`}
            </span>
            {varianceMagnitudeThreshold > 0 && (
              <button
                onClick={() => setVarianceMagnitudeThreshold(0)}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-400 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowVarianceOnly(!showVarianceOnly)}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              showVarianceOnly
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">Show Variance Only</span>
            <div className={`relative w-8 h-[18px] rounded-full transition-colors ${
              showVarianceOnly ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}>
              <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                showVarianceOnly ? 'translate-x-[16px]' : 'translate-x-[2px]'
              }`} />
            </div>
          </button>
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowNotesOnly(!showNotesOnly)}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              showNotesOnly
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">Show Notes Only</span>
            <div className={`relative w-8 h-[18px] rounded-full transition-colors ${
              showNotesOnly ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}>
              <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                showNotesOnly ? 'translate-x-[16px]' : 'translate-x-[2px]'
              }`} />
            </div>
          </button>
        </div>
      </GridFilterDrawer>
    </div>
  );
}
