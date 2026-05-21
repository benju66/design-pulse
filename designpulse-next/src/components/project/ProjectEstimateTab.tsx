'use client';
/**
 * ProjectEstimateTab.tsx
 * Versioned project budget import from Procore Budget Template (.xlsx).
 * State machine: idle → parsing → staging → saving → saved
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { Upload, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, BarChart3, Trash2, Star, Search, X, MessageSquare, Loader2 } from 'lucide-react';
import { useProjectEstimateVersions, useImportEstimateMutation, useActivateEstimateVersion, useDeleteEstimateVersion, useProjectEstimateLines } from '@/hooks/useEstimateQueries';
import { usePendingEstimateUpdates } from '@/hooks/useOpportunityQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { parseProcoreBudgetExcel } from '@/lib/excel/procoreBudgetParser';
import { SmartCostCodeCombobox } from '@/components/ui/SmartCostCodeCombobox';
import { AnimatePresence, motion } from 'framer-motion';
import type { EstimateStagingRow, EstimateCostType, ProjectEstimateVersion } from '@/types/models';
import type { CostType } from '@/types/models';

import { VersionComparisonViewer } from './VersionComparisonViewer';
type ImportState = 'idle' | 'parsing' | 'staging' | 'saving' | 'saved';

const COST_TYPE_PILL: Record<string, string> = {
  Labor:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Material:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Subcontract: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Equipment:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Other:       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── Version History Row ──────────────────────────────────────────────────────
function VersionRow({
  version,
  onActivate,
  onDelete,
  onView,
  isSelected,
  onToggleSelect,
  isActivating,
  isDeleting,
}: {
  version: ProjectEstimateVersion;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  isSelected: boolean;
  onToggleSelect: (id: string, selected: boolean) => void;
  isActivating: boolean;
  isDeleting: boolean;
}) {
  return (
    <div 
      onClick={() => onView(version.id)}
      className={`group flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
      version.is_active
        ? 'border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-sky-900/20 hover:border-sky-400 dark:hover:border-sky-500'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
    }`}>
      <div className="flex items-center gap-4 min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(version.id, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
        />
        {version.is_active && (
          <span className="flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 rounded-full shrink-0">
            <Star size={10} fill="currentColor" /> ACTIVE
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{version.version_name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{version.version_date}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-4">
        <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
          {formatCurrency(version.total_budget)}
        </span>
        <div className="flex gap-2">
          {!version.is_active && (
            <button
              id={`activate-version-${version.id}`}
              onClick={(e) => { e.stopPropagation(); onActivate(version.id); }}
              disabled={isActivating}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              Set Active
            </button>
          )}
          <button
            id={`delete-version-${version.id}`}
            onClick={(e) => { 
              e.stopPropagation(); 
              onDelete(version.id); 
            }}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-50 transition-colors"
            title="Delete version"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Version Lines Viewer Modal ───────────────────────────────────────────────
function VersionLinesViewer({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  const { data: lines, isLoading } = useProjectEstimateLines(versionId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <BarChart3 size={16} className="text-sky-500" />
            Budget Details
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <p className="text-center text-sm text-slate-400 py-10">Loading lines…</p>
          ) : !lines || lines.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">No line items found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky -top-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-widest z-10">
                <tr>
                  <th className="px-3 py-2">Cost Code</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">{line.cost_code || 'Unassigned'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${COST_TYPE_PILL[line.cost_type || 'Other'] ?? COST_TYPE_PILL.Other}`}>
                        {line.cost_type || 'Other'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{line.description}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800 dark:text-slate-200">{formatCurrency(line.budget_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Staging Grid Row ─────────────────────────────────────────────────────────
// Rendered N times — NO hooks called inside (AGENTS.md C24).
// NOTE: useState for local focus/Escape tracking IS allowed — it is not a data-fetching
// subscription and does not accumulate registrations across mount/unmount cycles (AGENTS.md C24).
function StagingRow({
  row,
  costCodes,
  onAssign,
  onBudgetChange,
  onNoteChange,
  priorBudget,
  showNoteColumn,
}: {
  row: EstimateStagingRow;
  costCodes: Parameters<typeof SmartCostCodeCombobox>[0]['rawCostCodes'];
  onAssign: (id: string, costCode: string, costType: EstimateCostType) => void;
  onBudgetChange: (id: string, value: number) => void;
  onNoteChange?: (id: string, note: string) => void;
  priorBudget?: number;
  showNoteColumn?: boolean;
}) {
  const [budgetFocused, setBudgetFocused] = useState(false);
  // Tracks value at focus time so Escape can cancel the edit (AGENTS.md C18 — inline grid cells
  // must revert to initial value on Escape, matching Excel UX).
  const [initialBudget, setInitialBudget] = useState(row.budget_amount);

  // Formatted display value — shown when input is not focused
  const formattedBudget = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(row.budget_amount);

  // Status: needs attention when cost code is unmatched OR budget was NOCACHE and unconfirmed.
  // is_budget_resolved becomes true once the parser found a real value, OR the user edits the cell.
  const needsAttention = !row.is_matched || !row.is_budget_resolved;

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
      {/* Status */}
      <td className="px-3 py-2.5 w-8 shrink-0">
        {needsAttention
          ? <AlertTriangle size={15} className="text-amber-500" />
          : <CheckCircle2 size={15} className="text-emerald-500" />}
      </td>
      {/* Procore raw code */}
      <td className="px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap w-28">
        {row.procore_raw_code}
      </td>
      {/* Mapped code — always editable; showCostTypeSegment=false per AGENTS.md C23 */}
      <td className="px-3 py-2.5 w-48">
        <SmartCostCodeCombobox
          value={row.cost_code}
          costType={row.cost_type as CostType | null}
          mode="cost_code_only"
          showCostTypeSegment={false}
          rawCostCodes={costCodes}
          onChange={updates => {
            if (updates.cost_code) {
              onAssign(row.id, updates.cost_code, (updates.cost_type ?? 'Other') as EstimateCostType);
            }
          }}
        />
      </td>
      {/* Cost Type pill — read-only display derived from suffix selection */}
      <td className="px-3 py-2.5 w-28">
        {row.cost_type && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COST_TYPE_PILL[row.cost_type] ?? COST_TYPE_PILL.Other}`}>
            {row.cost_type}
          </span>
        )}
      </td>
      {/* Description — flex to fill remaining space */}
      <td className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 truncate" title={row.description}>
        {row.description}
      </td>
      {/* Budget — shows formatted currency when unfocused, raw number when editing.
           Escape cancels to the value at focus time (AGENTS.md C18). */}
      <td className="pl-3 pr-5 py-2.5 text-right w-36">
        <input
          type={budgetFocused ? 'number' : 'text'}
          value={budgetFocused ? row.budget_amount : formattedBudget}
          onFocus={() => { setBudgetFocused(true); setInitialBudget(row.budget_amount); }}
          onBlur={() => setBudgetFocused(false)}
          onChange={e => onBudgetChange(row.id, parseFloat(e.target.value) || 0)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              // Cancel: revert to value captured at focus time, then blur
              onBudgetChange(row.id, initialBudget);
              e.currentTarget.blur();
            }
          }}
          className="w-full text-right text-sm font-mono bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-sky-400 rounded-lg px-2 py-1 outline-none text-slate-800 dark:text-slate-200 transition-colors"
        />
      </td>
      {/* Variance Note — only shown for subsequent imports */}
      {showNoteColumn && (
        <td className="px-3 py-2.5 w-56">
          {(() => {
            // Auto-prompt: highlight when delta >= 10% vs prior version
            const hasSigDelta = priorBudget != null && priorBudget > 0
              && Math.abs(row.budget_amount - priorBudget) / priorBudget >= 0.1;
            return (
              <textarea
                rows={1}
                value={row.variance_note ?? ''}
                onChange={e => onNoteChange?.(row.id, e.target.value)}
                placeholder={hasSigDelta ? 'Explain this cost change…' : 'Optional note'}
                className={`w-full text-xs bg-transparent border rounded-lg px-2 py-1.5 outline-none resize-none text-slate-700 dark:text-slate-300 placeholder-slate-400 transition-colors focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30 ${
                  hasSigDelta && !row.variance_note
                    ? 'border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              />
            );
          })()}
        </td>
      )}
    </tr>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function ProjectEstimateTab({ projectId }: { projectId: string }) {
  const [importState, setImportState] = useState<ImportState>('idle');
  const [parseError, setParseError]   = useState<string | null>(null);
  const [stagingRows, setStagingRows] = useState<EstimateStagingRow[]>([]);
  const [versionName, setVersionName] = useState('');
  const [versionDate, setVersionDate] = useState('');
  const [setAsActive, setSetAsActive] = useState(true);

  // Version viewer/compare state
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [comparingVersionIds, setComparingVersionIds] = useState<[string, string] | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);

  const [isDragging, setIsDragging]   = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [stagingSearch, setStagingSearch] = useState('');

  // Column picker: populated after parse with available numeric column headers.
  // activeBudgetCol tracks which column the user has selected for budget amounts.
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [activeBudgetCol, setActiveBudgetCol]   = useState<string>('budget amount');

  const { data: pendingEstimates = [] } = usePendingEstimateUpdates(projectId);
  const [selectedVeIds, setSelectedVeIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive cost codes ONCE in parent — not per-row (AGENTS.md C24)
  const { data: allCostCodes = [] } = useCostCodes();

  const { data: versions = [], isLoading: versionsLoading } = useProjectEstimateVersions(projectId);
  const importMutation   = useImportEstimateMutation(projectId);
  const activateMutation = useActivateEstimateVersion(projectId);
  const deleteMutation   = useDeleteEstimateVersion(projectId);

  // Known 6-digit codes set for match detection — memoized to prevent processFile/handleDrop
  // recreation on every render (knownCodes dep in useCallback) (AGENTS.md C24 performance).
  const knownCodes = useMemo(
    () => new Set<string>(allCostCodes.map((c: { code: string }) => c.code)),
    [allCostCodes]
  );

  const totalBudget         = stagingRows.reduce((s, r) => s + r.budget_amount, 0);
  const unmatchedCount      = stagingRows.filter(r => !r.is_matched).length;
  // unresolvedBudgetCount: rows where both Manual Calculation and formula cache returned 0 (NOCACHE).
  // Uses is_budget_resolved (not budget_amount === 0) to distinguish NOCACHE from intentional $0.
  const unresolvedBudgetCount = stagingRows.filter(r => !r.is_budget_resolved).length;

  // Phase 1: Variance Note Capture —
  // Only show the note column when importing a subsequent estimate (versions exist).
  const isSubsequentImport = versions.length > 0;
  const activeVersion = useMemo(
    () => versions.find(v => v.is_active),
    [versions]
  );
  const { data: priorLines = [] } = useProjectEstimateLines(activeVersion?.id ?? null);
  // Build a lookup of prior cost_code → budget_amount for delta detection
  const priorBudgetMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of priorLines) {
      if (line.cost_code) {
        // Aggregate by cost_code (same code may have multiple cost_types)
        map[line.cost_code] = (map[line.cost_code] ?? 0) + line.budget_amount;
      }
    }
    return map;
  }, [priorLines]);

  // Bulk annotate state
  const [bulkNoteOpen, setBulkNoteOpen] = useState(false);
  const [bulkNoteText, setBulkNoteText] = useState('');

  // Search filter — iOS-safe: no regex, simple toLowerCase includes
  const sq = stagingSearch.toLowerCase().trim();
  const filteredRows = sq
    ? stagingRows.filter(r =>
        r.procore_raw_code.toLowerCase().includes(sq) ||
        (r.cost_code ?? '').toLowerCase().includes(sq) ||
        r.description.toLowerCase().includes(sq)
      )
    : stagingRows;

  // ── File processing ────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    // .csv explicitly rejected
    if (!file.name.endsWith('.xlsx')) {
      setParseError('Only .xlsx files are supported. Please upload a budget template (.xlsx).');
      return;
    }
    setParseError(null);
    setImportState('parsing');
    setStagingSearch('');
    setActiveBudgetCol('budget amount'); // reset column picker on each new upload
    try {
      const buffer = await file.arrayBuffer();
      const { rows, availableHeaders: hdrs } = await parseProcoreBudgetExcel(buffer, projectId, knownCodes);
      setStagingRows(rows);
      setAvailableHeaders(hdrs);
      // Pre-fill version name from file name (strip extension)
      setVersionName(file.name.replace(/\.xlsx$/i, ''));
      setImportState('staging');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
      setImportState('idle');
    }
  }, [projectId, knownCodes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  // ── Staging grid callbacks (AGENTS.md C24 — no hooks inside row) ──────────
  const handleAssign = useCallback((id: string, costCode: string, costType: EstimateCostType) => {
    setStagingRows(prev => prev.map(r =>
      r.id === id ? { ...r, cost_code: costCode, cost_type: costType, is_matched: true } : r
    ));
  }, []);

  const handleBudgetChange = useCallback((id: string, value: number) => {
    // A manual cell edit always marks the row as resolved (even if value is $0).
    setStagingRows(prev => prev.map(r =>
      r.id === id ? { ...r, budget_amount: value, is_budget_resolved: true } : r
    ));
  }, []);

  // Phase 1: Variance note change handler — lazy UUID minting on first character
  const handleNoteChange = useCallback((id: string, note: string) => {
    setStagingRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        variance_note: note || undefined,
        // Mint UUID on first character, keep it stable after that (AGENTS.md C8)
        variance_note_id: note ? (r.variance_note_id ?? crypto.randomUUID()) : undefined,
      };
    }));
  }, []);

  // Bulk annotate: apply one note to all rows with a significant delta
  const applyBulkNote = useCallback(() => {
    if (!bulkNoteText.trim()) return;
    setStagingRows(prev => prev.map(r => {
      const priorAmt = r.cost_code ? priorBudgetMap[r.cost_code] : undefined;
      const hasSigDelta = priorAmt != null && priorAmt > 0
        && Math.abs(r.budget_amount - priorAmt) / priorAmt >= 0.1;
      if (!hasSigDelta) return r;
      // Only apply if user hasn't already written a custom note
      if (r.variance_note) return r;
      return {
        ...r,
        variance_note: bulkNoteText.trim(),
        variance_note_id: crypto.randomUUID(),
      };
    }));
    setBulkNoteText('');
    setBulkNoteOpen(false);
  }, [bulkNoteText, priorBudgetMap]);

  // Column picker: remap all budget_amount values from the cached _rawCols.
  // No re-parse needed — _rawCols captured every column during initial parse.
  // Any active user selection (even if the column has $0 values) is treated as
  // intentional — is_budget_resolved set to true for all rows.
  const handleBudgetColChange = useCallback((header: string) => {
    setActiveBudgetCol(header);
    setStagingRows(prev => prev.map(r => {
      const raw = r._rawCols?.[header] ?? 0;
      return { ...r, budget_amount: raw, is_budget_resolved: true };
    }));
  }, []);

  // ── Import submission ──────────────────────────────────────────────────────
  // Orphan cleanup on error is handled inside useImportEstimateMutation via its
  // internal pendingVersionIdRef — no cleanup logic needed here.
  // No import blocking — $0 budgets and early estimates are valid user data.
  const handleImport = useCallback(async () => {
    if (!versionName.trim()) return;
    setImportState('saving');

    importMutation.mutate(
      { versionName: versionName.trim(), versionDate, setActive: setAsActive, rows: stagingRows, incorporated_ve_ids: selectedVeIds },
      {
        onSuccess: () => {
          setImportState('saved');
          setStagingRows([]);
          setVersionName('');
          setHistoryOpen(true);
        },
        onError: (err) => {
          setParseError(err.message);
          setImportState('staging');
        },
      }
    );
  }, [versionName, versionDate, setAsActive, stagingRows, importMutation, selectedVeIds]);

  const resetToIdle = useCallback(() => {
    setStagingRows([]);
    setParseError(null);
    setStagingSearch('');
    setAvailableHeaders([]);
    setActiveBudgetCol('budget amount');
    setSelectedVeIds([]);
    setImportState('idle');
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <BarChart3 size={20} className="text-sky-500" />
          Project Budget
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Import a Procore Budget Template (.xlsx) to establish a versioned financial baseline for this project.
        </p>
      </div>

      {/* Version History Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <button
          id="estimate-history-toggle"
          onClick={() => setHistoryOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Version History</span>
            {versions.length > 0 && (
              <span className="ml-2 text-xs text-slate-500">({versions.length} version{versions.length !== 1 ? 's' : ''})</span>
            )}
          </div>
          {historyOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {historyOpen && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 space-y-2">
            {versionsLoading && (
              <p className="text-sm text-slate-400 py-4 text-center">Loading versions…</p>
            )}
            {!versionsLoading && versions.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">No estimate versions yet. Import one below.</p>
            )}
            {versions.map(v => (
              <VersionRow
                key={v.id}
                version={v}
                onActivate={id => activateMutation.mutate(id)}
                onDelete={id => setVersionToDelete(id)}
                onView={id => setViewingVersionId(id)}
                isSelected={selectedVersionIds.includes(v.id)}
                onToggleSelect={(id, selected) => {
                  if (selected) {
                    if (selectedVersionIds.length < 2) {
                      setSelectedVersionIds([...selectedVersionIds, id]);
                    }
                  } else {
                    setSelectedVersionIds(selectedVersionIds.filter((sid) => sid !== id));
                  }
                }}
                isActivating={activateMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Viewer Modal */}
      {viewingVersionId && (
        <VersionLinesViewer versionId={viewingVersionId} onClose={() => setViewingVersionId(null)} />
      )}

      {/* Delete Confirmation Modal */}
      {versionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full text-rose-600 dark:text-rose-500 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Version</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Are you sure you want to permanently delete this version and its associated variance notes? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setVersionToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(versionToDelete, {
                    onSuccess: () => setVersionToDelete(null),
                  });
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {comparingVersionIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Compare Estimate Versions</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Comparing variances between two budget snapshots.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setComparingVersionIds(null)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-hidden flex-1 min-h-[500px] h-[75vh] flex flex-col">
              <VersionComparisonViewer
                projectId={projectId}
                initialSelectedVersionIds={comparingVersionIds}
                hidePicker={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Compare Tray */}
      <AnimatePresence>
        {selectedVersionIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-slate-900 dark:bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
                  {selectedVersionIds.length}
                </div>
                <div>
                  <p className="text-sm font-semibold">Versions Selected</p>
                  <p className="text-xs text-slate-400">Select exactly 2 to compare</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 border-l border-slate-700 pl-6">
                <button
                  onClick={() => setSelectedVersionIds([])}
                  className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 transition-colors"
                >
                  Clear
                </button>
                <button
                  disabled={selectedVersionIds.length !== 2}
                  onClick={() => setComparingVersionIds([selectedVersionIds[0], selectedVersionIds[1]])}
                  className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold px-6 py-2 rounded-xl transition-colors"
                >
                  Compare
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Zone — shown when idle or parsing */}
      {(importState === 'idle' || importState === 'parsing') && (
        <div
          id="estimate-dropzone"
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20'
              : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-600 bg-white dark:bg-slate-900'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileInput}
          />
          <Upload size={32} className={`mx-auto mb-3 ${isDragging ? 'text-sky-500' : 'text-slate-400'}`} />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {importState === 'parsing' ? 'Parsing file…' : 'Drop Procore Budget Template here'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            .xlsx only · Procore_budget_Import_Template format
          </p>
          {parseError && (
            <div className="mt-4 flex items-start gap-2 text-left bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700 dark:text-rose-300">{parseError}</p>
            </div>
          )}
          {/* Platform-neutral tip: remind users to recalculate formulas before saving the file.
               This populates the formula cache so all budget amounts are captured correctly.
               Without this step, NOCACHE formula cells import as $0 and require manual entry. */}
          {!parseError && (
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Tip:</span>{' '}
              Before uploading, open the file in Excel and save after running{' '}
              <span className="font-mono">Recalculate All</span>{' '}
              <span className="whitespace-nowrap">
                (Windows:{' '}
                <kbd className="px-1 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono">Ctrl+Alt+F9</kbd>
                {' '}· Mac:{' '}
                <kbd className="px-1 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono">⌘ Opt F9</kbd>
                ).
              </span>
              {' '}This ensures all budget amounts are captured correctly.
            </p>
          )}
        </div>
      )}

      {/* Success banner */}
      {importState === 'saved' && (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Estimate imported successfully.</p>
          </div>
          <button
            id="import-another-estimate"
            onClick={resetToIdle}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Import another
          </button>
        </div>
      )}

      {/* Staging Grid */}
      {importState === 'staging' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Staging header */}
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 shrink-0">Review Import</span>
                <span className="text-xs text-slate-500 shrink-0">
                  {sq ? `${filteredRows.length} of ${stagingRows.length}` : `${stagingRows.length}`} rows
                </span>
                {unmatchedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full shrink-0">
                    <AlertTriangle size={11} /> {unmatchedCount} unmatched
                  </span>
                )}
                {unresolvedBudgetCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full shrink-0">
                    <AlertTriangle size={11} /> {unresolvedBudgetCount} unresolved budget
                  </span>
                )}
              </div>
              {/* Bulk Annotate button — only for subsequent imports */}
              {isSubsequentImport && (
                <button
                  id="bulk-annotate-btn"
                  onClick={() => setBulkNoteOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors shrink-0"
                >
                  <MessageSquare size={12} />
                  Bulk Annotate
                </button>
              )}
              {/* Column picker — shown when the sheet has multiple numeric columns.
                   Lets the user point the parser at the column that holds their budget data
                   without re-uploading the file. Only visible in staging mode. */}
              {availableHeaders.length > 1 && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Budget col:</span>
                  <select
                    id="budget-col-picker"
                    value={activeBudgetCol}
                    onChange={e => handleBudgetColChange(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1
                               bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300
                               focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400
                               transition-colors"
                  >
                    {availableHeaders.map(h => (
                      <option key={h} value={h}>
                        {h.replace(/\b\w/g, c => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                id="cancel-import"
                onClick={resetToIdle}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
              >
                Cancel
              </button>
            </div>
            {/* Search bar */}
            <div className="mt-3 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="staging-search"
                type="text"
                value={stagingSearch}
                onChange={e => setStagingSearch(e.target.value)}
                placeholder="Search by code or description…"
                className="w-full pl-8 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30 text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-colors"
              />
              {stagingSearch && (
                <button
                  onClick={() => setStagingSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Annotate Modal */}
          {bulkNoteOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Bulk Annotate Variances</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Apply one note to all cost codes with &ge;10% budget variance. Rows with existing notes are skipped.</p>
                  </div>
                  <button
                    onClick={() => { setBulkNoteOpen(false); setBulkNoteText(''); }}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6">
                  <textarea
                    rows={3}
                    value={bulkNoteText}
                    onChange={e => setBulkNoteText(e.target.value)}
                    placeholder="e.g. Scope revised per owner direction 05/15…"
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30 text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none"
                    autoFocus
                  />
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-slate-400">
                      {stagingRows.filter(r => {
                        const prior = r.cost_code ? priorBudgetMap[r.cost_code] : undefined;
                        return prior != null && prior > 0 && Math.abs(r.budget_amount - prior) / prior >= 0.1 && !r.variance_note;
                      }).length} rows will be annotated
                    </span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setBulkNoteOpen(false); setBulkNoteText(''); }}
                        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={applyBulkNote}
                        disabled={!bulkNoteText.trim()}
                        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors"
                      >
                        Apply Note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table — sticky header freezes on scroll (overflow-x on outer, overflow-y on inner) */}
          <div className="overflow-x-auto">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-3 py-2.5 w-8"></th>
                    <th className="px-3 py-2.5 w-28">Procore Code</th>
                    <th className="px-3 py-2.5 w-48">Mapped Code</th>
                    <th className="px-3 py-2.5 w-28">Cost Type</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="pl-3 pr-5 py-2.5 w-36 text-right">Budget Amount</th>
                    {isSubsequentImport && (
                      <th className="px-3 py-2.5 w-56">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare size={11} className="text-sky-500" />
                          Variance Note
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={isSubsequentImport ? 7 : 6} className="px-5 py-8 text-center text-sm text-slate-400">
                        No rows match &ldquo;{stagingSearch}&rdquo;
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(row => (
                      <StagingRow
                        key={row.id}
                        row={row}
                        costCodes={allCostCodes}
                        onAssign={handleAssign}
                        onBudgetChange={handleBudgetChange}
                        onNoteChange={isSubsequentImport ? handleNoteChange : undefined}
                        priorBudget={row.cost_code ? priorBudgetMap[row.cost_code] : undefined}
                        showNoteColumn={isSubsequentImport}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Estimate Updates Checklist */}
          {pendingEstimates.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-500" />
                Incorporate Approved Changes
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                The following VE items have been locked and are awaiting estimate incorporation. Select the items that are included in this new budget upload.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                {pendingEstimates.map(opp => (
                  <label key={opp.id} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-sky-300 dark:hover:border-sky-700 transition-colors">
                    <input 
                      type="checkbox"
                      className="mt-0.5 rounded text-sky-500 focus:ring-sky-500 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer"
                      checked={selectedVeIds.includes(opp.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVeIds(prev => [...prev, opp.id]);
                        } else {
                          setSelectedVeIds(prev => prev.filter(id => id !== opp.id));
                        }
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate" title={opp.title || ''}>{opp.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{opp.display_id} | {opp.cost_code}</span>
                        <span className={`text-xs font-bold ${Number(opp.cost_impact) < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatCurrency(Number(opp.cost_impact) || 0)}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Footer / commit form */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 flex flex-wrap items-end gap-4">
            {/* Summary */}
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total Budget</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(totalBudget)}</p>
            </div>

            {/* Version metadata */}
            <div className="flex gap-3 flex-wrap">
              <div>
                <label htmlFor="estimate-version-name" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Version Name
                </label>
                <input
                  id="estimate-version-name"
                  type="text"
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  placeholder="e.g. GMP Budget Rev 1"
                  className="w-52 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-400 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label htmlFor="estimate-version-date" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Date
                </label>
                <input
                  id="estimate-version-date"
                  type="date"
                  value={versionDate}
                  onChange={e => setVersionDate(e.target.value)}
                  className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-sky-400 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    id="estimate-set-active-toggle"
                    type="checkbox"
                    checked={setAsActive}
                    onChange={e => setSetAsActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-500"
                  />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Set as Active Baseline</span>
                </label>
              </div>
            </div>

            {/* Import button — only disabled while mutation is pending or version name is empty */}
            <button
              id="confirm-import-estimate"
              onClick={handleImport}
              disabled={importMutation.isPending || !versionName.trim()}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors shadow-sm"
            >
              {importMutation.isPending ? 'Importing…' : 'Import Estimate'}
            </button>
          </div>

          {/* Mutation error */}
          {parseError && importState === 'staging' && (
            <div className="mx-5 mb-4 flex items-start gap-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700 dark:text-rose-300">{parseError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
