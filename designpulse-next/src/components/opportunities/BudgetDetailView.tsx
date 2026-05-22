"use client";
/**
 * BudgetDetailView.tsx
 *
 * Phase 3: Budget Detail Panel Canvas — "The Why"
 *
 * Three-section layout:
 *   1. Scope & Assumptions — RBAC-gated editable textarea (can_edit_records)
 *   2. Financial Breakdown — existing cost-type table (unchanged logic)
 *   3. Variance History    — read-only cross-version timeline (immutable)
 *
 * Audit fixes applied:
 *   #1 — Uses RPC (update_estimate_assumptions) instead of direct .update()
 *   #2 — useRef lastSyncedRef prevents background refetch from clobbering drafts
 *   #3 — Separate useEffect on costCode resets draft immediately on row switch
 *   #4 — useEstimateLineDetails now returns typed ProjectEstimateLine[] (in hook file)
 *   #5 — Inline Intl.DateTimeFormat instead of undefined formatDate
 */

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabaseClient";
import { useCurrentUserPermissions } from "@/hooks/useProjectCoreQueries";
import {
  useEstimateLineDetails,
  useUpdateEstimateAssumptions,
  useVarianceHistoryByCostCode,
} from "@/hooks/useEstimateQueries";
import { FileText, History, Save, Loader2, Database, AlertCircle, Layers, Pencil, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Opportunity } from "@/types/models";
import { useUpsertVarianceNote } from "@/hooks/useUpsertVarianceNote";
import { useProjectEstimateVersions } from "@/hooks/useEstimateQueries";
import { Button } from "@/components/ui/Button";
import React from 'react';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);

const formatShortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

const relativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatShortDate(dateStr);
};

interface BudgetDetailViewProps {
  projectId: string;
  costCode: string;
  veItems?: Opportunity[];
}

export function BudgetDetailView({ projectId, costCode, veItems = [] }: BudgetDetailViewProps) {
  const { data: lines, isLoading, isError } = useEstimateLineDetails(projectId, costCode);
  const { permissions } = useCurrentUserPermissions(projectId);
  const { data: varianceNotes, isLoading: varianceLoading } = useVarianceHistoryByCostCode(projectId, costCode);

  const updateAssumptions = useUpdateEstimateAssumptions(projectId);
  const { data: estimateVersions = [] } = useProjectEstimateVersions(projectId);
  const upsertVarianceNote = useUpsertVarianceNote(projectId);

  // Fast, scoped TanStack query to fetch all line item totals for this cost code belonging strictly to this project's versions
  const { data: versionAmounts } = useQuery({
    queryKey: ['cost-code-version-amounts', projectId, costCode],
    enabled: !!projectId && !!costCode,
    queryFn: async () => {
      const { data: versions, error: vError } = await supabase
        .from('project_estimate_versions')
        .select('id')
        .eq('project_id', projectId);
      if (vError) throw vError;
      if (!versions || versions.length === 0) return {};
      
      const versionIds = versions.map(v => v.id);

      const { data, error } = await supabase
        .from('project_estimates')
        .select('version_id, budget_amount')
        .in('version_id', versionIds)
        .eq('cost_code', costCode);
      if (error) throw error;
      
      const sums: Record<string, number> = {};
      data?.forEach(r => {
        sums[r.version_id] = (sums[r.version_id] || 0) + (Number(r.budget_amount) || 0);
      });
      return sums;
    }
  });

  // Calculate step deltas and absolute budgets chronologically (oldest-to-newest)
  const chronologicalVersions = React.useMemo(() => {
    return [...estimateVersions].sort((a, b) => {
      // 1. The active estimate version always sorts to the far right (latest)
      if (a.is_active && !b.is_active) return 1;
      if (!a.is_active && b.is_active) return -1;

      // 2. Try parsing high-fidelity YYYY.MM.DD date from the name prefix
      const matchA = a.version_name.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
      const matchB = b.version_name.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);

      let dateA: number;
      let dateB: number;

      if (matchA && matchB) {
        dateA = new Date(`${matchA[1]}-${matchA[2].padStart(2, '0')}-${matchA[3].padStart(2, '0')}T00:00:00`).getTime();
        dateB = new Date(`${matchB[1]}-${matchB[2].padStart(2, '0')}-${matchB[3].padStart(2, '0')}T00:00:00`).getTime();
      } else {
        dateA = new Date(a.version_date + 'T00:00:00').getTime();
        dateB = new Date(b.version_date + 'T00:00:00').getTime();
      }

      if (dateA !== dateB) return dateA - dateB;

      // 3. Fallback: created_at ascending
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;

      // 4. Stable tie-breaker
      return a.id.localeCompare(b.id);
    });
  }, [estimateVersions]);

  const versionDeltas = React.useMemo(() => {
    const deltas: Record<string, { amount: number; prevAmount: number | null; delta: number | null; pct: number | null }> = {};
    
    chronologicalVersions.forEach((v, index) => {
      const amount = versionAmounts?.[v.id] ?? 0;
      if (index === 0) {
        deltas[v.id] = {
          amount,
          prevAmount: null,
          delta: null,
          pct: null
        };
      } else {
        const prevVersion = chronologicalVersions[index - 1];
        const prevAmount = versionAmounts?.[prevVersion.id] ?? 0;
        const delta = amount - prevAmount;
        let pct = null;
        if (prevAmount !== 0) {
          pct = delta / Math.abs(prevAmount);
        } else if (amount !== 0) {
          pct = amount > 0 ? 1.0 : -1.0;
        }
        deltas[v.id] = {
          amount,
          prevAmount,
          delta,
          pct
        };
      }
    });
    
    return deltas;
  }, [chronologicalVersions, versionAmounts]);

  // Active version detection for version-scoped note editing
  const activeVersionId = React.useMemo(
    () => estimateVersions.find(v => v.is_active)?.id ?? null,
    [estimateVersions]
  );
  const activeVersionName = React.useMemo(
    () => estimateVersions.find(v => v.is_active)?.version_name ?? null,
    [estimateVersions]
  );

  // Variance note editing state (only for active version's note)
  const activeNote = React.useMemo(
    () => varianceNotes?.find(n => n.estimate_version_id === activeVersionId) ?? null,
    [varianceNotes, activeVersionId]
  );
  const [isEditingNote, setIsEditingNote] = React.useState(false);
  const [noteDraft, setNoteDraft] = React.useState('');
  const noteTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // ── Audit Fix #2 & #3: Draft state with overwrite protection ──────────────
  const [draftAssumptions, setDraftAssumptions] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const lastSyncedRef = useRef<string | null>(null);
  const prevCostCodeRef = useRef<string>(costCode);

  // Single unified effect — satisfies react-hooks/set-state-in-effect
  // by combining the costCode-reset logic (Fix #3) with the server-sync
  // logic (Fix #2) into one coherent effect body.
  useEffect(() => {
    // Fix #3: Detect costCode change and reset draft immediately
    const costCodeChanged = costCode !== prevCostCodeRef.current;
    if (costCodeChanged) {
      prevCostCodeRef.current = costCode;
      lastSyncedRef.current = null;
    }

    // Fix #2: Sync from server only when the actual value changes
    if (!lines || lines.length === 0) {
      // If costCode just changed but no data yet, clear the draft
      if (costCodeChanged) {
        setDraftAssumptions("");
        setIsDirty(false);
      }
      return;
    }

    const serverValue = lines[0]?.item_assumptions ?? "";
    if (serverValue !== lastSyncedRef.current) {
      lastSyncedRef.current = serverValue;
      setDraftAssumptions(serverValue);
      setIsDirty(false);
    }
  }, [lines, costCode]);
  // ── End audit fixes ────────────────────────────────────────────────────────

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading budget breakdown...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-rose-500">
        <AlertCircle className="w-8 h-8 mb-4" />
        <p>Failed to load budget details</p>
      </div>
    );
  }

  // Empty state
  if (!lines || lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Database className="w-8 h-8 mb-4 opacity-50" />
        <p>No active budget lines found for {costCode}</p>
      </div>
    );
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.budget_amount, 0);

  const handleSaveAssumptions = () => {
    updateAssumptions.mutate(
      { costCode, assumptions: draftAssumptions },
      {
        onSuccess: () => {
          setIsDirty(false);
          lastSyncedRef.current = draftAssumptions; // Update ref so refetch doesn't re-trigger
          toast.success("Assumptions saved");
        },
        onError: (err) => toast.error(`Failed to save: ${err.message}`),
      }
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Section 1: Scope & Assumptions ── */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-slate-500 dark:text-slate-400" />
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Scope & Assumptions
            </h4>
          </div>
          {permissions.can_edit_records && isDirty && (
            <Button
              onClick={handleSaveAssumptions}
              isLoading={updateAssumptions.isPending}
              variant="primary"
              size="sm"
              className="rounded-md"
            >
              <Save size={12} />
              Save
            </Button>
          )}
        </div>
        <div className="p-4">
          {permissions.can_edit_records ? (
            <textarea
              value={draftAssumptions}
              onChange={(e) => {
                setDraftAssumptions(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Add scope notes, assumptions, or clarifications..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100
                         border border-slate-200 dark:border-slate-800 rounded-lg p-3
                         focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none
                         resize-y min-h-[60px] max-h-[200px]"
            />
          ) : (
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {draftAssumptions || (
                <span className="italic text-slate-400 dark:text-slate-500">
                  No assumptions recorded.
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Financial Breakdown (existing table) ── */}
      <section className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
          <div>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Budget Breakdown
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Cost Code: <span className="font-medium text-slate-900 dark:text-white">{costCode}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Description</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Unit Cost</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {line.cost_type || "Other"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{line.description}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">
                    {line.unit_qty} {line.uom || ""}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">
                    {formatCurrency(line.unit_cost)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(line.budget_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 2.5: VE Impact Summary ── */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <Layers size={16} className="text-slate-500 dark:text-slate-400" />
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            VE Impact
          </h4>
          {veItems.length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
              {veItems.length}
            </span>
          )}
        </div>
        <div className="p-4">
          {veItems.length === 0 ? (
            <p className="text-sm italic text-slate-400 dark:text-slate-500">
              No VE items linked to this cost code.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {veItems.map((item) => {
                  const impact = Number(item.cost_impact) || 0;
                  const status = item.status || 'Draft';
                  const statusStyles: Record<string, string> = {
                    Approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                    Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                  };
                  return (
                    <div key={item.id} className="flex items-center justify-between py-2 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                          statusStyles[status] || statusStyles.Draft
                        }`}>
                          {status}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                          {item.title || 'Untitled'}
                        </span>
                      </div>
                      <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${
                        impact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
                        impact > 0 ? 'text-rose-600 dark:text-rose-400' :
                        'text-slate-400'
                      }`}>
                        {formatCurrency(impact)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Summary totals + Budget Reconciliation */}
              {(() => {
                const approved = veItems
                  .filter(i => i.status === 'Approved')
                  .reduce((sum, i) => sum + (Number(i.cost_impact) || 0), 0);
                const pending = veItems
                  .filter(i => i.status !== 'Approved')
                  .reduce((sum, i) => sum + (Number(i.cost_impact) || 0), 0);
                const revised = totalAmount + approved;
                const projected = totalAmount + approved + pending;
                return (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                    {/* VE Deltas */}
                    <div className="flex items-center justify-between">
                      {approved !== 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                          Approved Δ: {formatCurrency(approved)}
                        </span>
                      )}
                      {pending !== 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium tabular-nums">
                          Pending Δ: {formatCurrency(pending)}
                        </span>
                      )}
                      {approved === 0 && pending === 0 && (
                        <span className="text-slate-400 italic">No financial impact</span>
                      )}
                    </div>
                    {/* Budget Reconciliation — only show when there are actual budget lines */}
                    {totalAmount > 0 && (approved !== 0 || pending !== 0) && (
                      <div className="flex flex-col gap-1 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>Baseline</span>
                          <span className="tabular-nums">{formatCurrency(totalAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span>Revised Budget</span>
                          <span className="tabular-nums">{formatCurrency(revised)}</span>
                        </div>
                        {pending !== 0 && (
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span>Projected Final</span>
                            <span className="tabular-nums">{formatCurrency(projected)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Variance History ── */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-500 dark:text-slate-400" />
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Variance History
            </h4>
            {varianceNotes && varianceNotes.length > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                {varianceNotes.length}
              </span>
            )}
          </div>
          {/* Copy to clipboard */}
          {varianceNotes && varianceNotes.length > 0 && (
            <Button
              onClick={() => {
                const text = varianceNotes
                  .map(n => {
                    const deltaInfo = versionDeltas[n.estimate_version_id];
                    let deltaText = '';
                    if (deltaInfo) {
                      const hasDelta = deltaInfo.delta !== null;
                      const amtText = formatCurrency(deltaInfo.amount);
                      if (!hasDelta) {
                        deltaText = ` (Budget: ${amtText} - BASELINE)`;
                      } else {
                        const sgn = deltaInfo.delta! > 0 ? '+' : '';
                        const pctStr = (deltaInfo.pct! * 100).toFixed(1);
                        deltaText = ` (Budget: ${amtText} - Step Delta: ${sgn}${formatCurrency(deltaInfo.delta!)} [${sgn}${pctStr}%])`;
                      }
                    }
                    return `[${n.version_name}]${deltaText} ${formatShortDate(n.created_at)}\n${n.variance_note}`;
                  })
                  .join('\n\n');
                navigator.clipboard.writeText(text);
                toast.success('Variance notes copied to clipboard');
              }}
              variant="ghost"
              size="sm"
              className="text-[10px] font-medium text-slate-400 hover:text-sky-500 transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-800 border-0 shadow-none h-auto py-1 px-2"
              title="Copy all notes to clipboard"
            >
              <Copy size={11} />
              Copy All
            </Button>
          )}
        </div>
        <div className="p-4 max-h-80 overflow-y-auto">
          {varianceLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !varianceNotes || varianceNotes.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm italic text-slate-400 dark:text-slate-500">
                No variance notes recorded for this cost code.
              </p>
              {permissions.can_edit_project_settings && activeVersionId && (
                <Button
                  onClick={() => {
                    setNoteDraft('');
                    setIsEditingNote(true);
                    setTimeout(() => noteTextareaRef.current?.focus(), 50);
                  }}
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs font-medium text-sky-500 hover:text-sky-600 transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/20 border-0 shadow-none h-auto py-1.5 px-3"
                >
                  + Add note for current version
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {varianceNotes.map((note) => {
                const isActiveVersion = note.estimate_version_id === activeVersionId;
                const canEdit = isActiveVersion && permissions.can_edit_project_settings;
                const deltaInfo = versionDeltas[note.estimate_version_id];

                // Determine step delta badge styling
                let deltaBadge = null;
                if (deltaInfo) {
                  const hasDelta = deltaInfo.delta !== null;
                  if (!hasDelta) {
                    deltaBadge = (
                      <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/50 select-none">
                        BASELINE
                      </span>
                    );
                  } else if (deltaInfo.delta! > 0) {
                    deltaBadge = (
                      <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-md border border-rose-100 dark:border-rose-900/30 select-none">
                        +{formatCurrency(deltaInfo.delta!)} (+{(deltaInfo.pct! * 100).toFixed(1)}%)
                      </span>
                    );
                  } else if (deltaInfo.delta! < 0) {
                    deltaBadge = (
                      <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/30 select-none">
                        {formatCurrency(deltaInfo.delta!)} ({(deltaInfo.pct! * 100).toFixed(1)}%)
                      </span>
                    );
                  } else {
                    deltaBadge = (
                      <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 px-1.5 py-0.5 rounded-md select-none border border-slate-100 dark:border-slate-800/30">
                        NO CHANGE
                      </span>
                    );
                  }
                }

                return (
                  <div
                    key={note.id}
                    className={`border-l-2 pl-3 py-1 ${
                      isActiveVersion
                        ? 'border-sky-400 dark:border-sky-600'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {note.version_name}
                        </span>
                        {isActiveVersion && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 size={8} />
                            Current
                          </span>
                        )}
                        {deltaInfo && (
                          <span className="inline-flex items-center text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100/60 dark:bg-slate-850 px-1.5 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                            {formatCurrency(deltaInfo.amount)}
                          </span>
                        )}
                        {deltaBadge}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums cursor-help"
                          title={new Date(note.updated_at || note.created_at).toLocaleString()}
                        >
                          {relativeTime(note.updated_at || note.created_at)}
                        </span>
                        {canEdit && !isEditingNote && (
                          <Button
                            onClick={() => {
                              setNoteDraft(note.variance_note);
                              setIsEditingNote(true);
                              setTimeout(() => noteTextareaRef.current?.focus(), 50);
                            }}
                            variant="ghost"
                            size="icon"
                            className="p-0.5 rounded text-slate-400 hover:text-sky-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 shadow-none h-auto"
                            title="Edit note"
                          >
                            <Pencil size={11} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isActiveVersion && isEditingNote ? (
                      <div>
                        <textarea
                          ref={noteTextareaRef}
                          rows={3}
                          value={noteDraft}
                          maxLength={500}
                          onChange={e => setNoteDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') {
                              setIsEditingNote(false);
                              setNoteDraft(activeNote?.variance_note ?? '');
                            }
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                              upsertVarianceNote.mutate(
                                { costCode, note: noteDraft.trim() },
                                {
                                  onSuccess: () => {
                                    setIsEditingNote(false);
                                    toast.success('Note saved');
                                  },
                                  onError: (err) => toast.error(`Failed: ${err.message}`),
                                }
                              );
                            }
                          }}
                          placeholder="Explain this variance…"
                          className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-sky-300 dark:border-sky-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400 text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none"
                        />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">{noteDraft.length}/500</span>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setIsEditingNote(false);
                                setNoteDraft(activeNote?.variance_note ?? '');
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors h-auto py-1 px-2 border-0 shadow-none font-medium"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                upsertVarianceNote.mutate(
                                  { costCode, note: noteDraft.trim() },
                                  {
                                    onSuccess: () => {
                                      setIsEditingNote(false);
                                      toast.success('Note saved');
                                    },
                                    onError: (err) => toast.error(`Failed: ${err.message}`),
                                  }
                                );
                              }}
                              isLoading={upsertVarianceNote.isPending}
                              variant="ghost"
                              size="sm"
                              className="text-[10px] font-bold text-sky-600 hover:text-sky-700 disabled:opacity-50 transition-colors h-auto py-1 px-2 border-0 shadow-none"
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-slate-400">{note.variance_note}</p>
                    )}
                  </div>
                );
              })}

              {/* Add note CTA — only if no active version note exists yet */}
              {!activeNote && permissions.can_edit_project_settings && activeVersionId && (
                <Button
                  onClick={() => {
                    setNoteDraft('');
                    setIsEditingNote(true);
                    setTimeout(() => noteTextareaRef.current?.focus(), 50);
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1 py-2 text-xs font-medium text-sky-500 hover:text-sky-600 border border-dashed border-sky-200 dark:border-sky-800 rounded-xl hover:bg-sky-50/50 dark:hover:bg-sky-900/10 transition-colors shadow-none"
                >
                  + Add note for {activeVersionName || 'current version'}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
