'use client';
/**
 * useEstimateQueries.ts
 *
 * TanStack Query hooks for the Project Estimate import feature.
 *
 * Architecture:
 *  - All server state via Supabase RPCs — no direct table mutations (AGENTS.md C2)
 *  - 3-step chunked import: create_version → bulk_append (×N) → finalize (AGENTS.md C20)
 *  - Orphan cleanup via delete_draft_estimate_version on mutation error
 *  - Cache invalidation hits both estimate-versions and project-settings keys
 *  - Waterfall query has staleTime of 5 min — expensive aggregation, no real-time need
 *  - All optional RPC params pass null, never undefined (AGENTS.md C11)
 *
 * Fix log:
 *  - JSONB serialization: p_payload must be JSON.stringify'd before passing to
 *    supabase.rpc() to guarantee correct jsonb type handling across all client versions.
 *  - Orphan cleanup: onError now correctly captures versionId via a closure ref and
 *    calls delete_draft_estimate_version to remove stale unfinalized version headers.
 *  - Sequential chunk insertion: chunks are inserted sequentially (not parallel) so a
 *    failure on chunk N doesn't leave a partial dataset without triggering cleanup.
 */

import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import type {
  ProjectEstimateVersion,
  ProjectEstimateLine,
  EstimateStagingRow,
  BudgetWaterfallRow,
  BudgetVersionTimelineRow,
  EstimateComparisonRow,
  EstimateVarianceNote,
  MultiVersionMatrixRow,
} from '@/types/models';

const CHUNK_SIZE = 50; // AGENTS.md C20 — Kong gateway protection

// ── Query Key Factory ────────────────────────────────────────────────────────
export const estimateKeys = {
  versions:  (projectId: string) => ['estimate-versions', projectId] as const,
  lines:     (versionId: string) => ['estimate-lines',    versionId] as const,
  lineDetails: (projectId: string, costCode: string) => ['estimate-line-details', projectId, costCode] as const,
  varianceHistory: (projectId: string, costCode: string) => ['variance-history', projectId, costCode] as const,
  waterfall: (projectId: string, versionId?: string | null) => 
    versionId !== undefined ? ['budget-waterfall', projectId, versionId] as const : ['budget-waterfall', projectId] as const,
  timeline: (projectId: string) => ['budget-version-timeline', projectId] as const,
};

// ── useProjectEstimateVersions ───────────────────────────────────────────────
// Lists all versions for a project. Ordered version_date DESC, id ASC (AGENTS.md C22).
export function useProjectEstimateVersions(projectId: string | null) {
  return useQuery<ProjectEstimateVersion[]>({
    queryKey: estimateKeys.versions(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_estimate_versions')
        .select('*')
        .eq('project_id', projectId!)
        .order('version_date', { ascending: false })
        .order('id',           { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectEstimateVersion[];
    },
  });
}

// ── useProjectEstimateLines ──────────────────────────────────────────────────
// Loads line items for one version on demand (pass null to skip fetch).
export function useProjectEstimateLines(versionId: string | null) {
  return useQuery<ProjectEstimateLine[]>({
    queryKey: estimateKeys.lines(versionId ?? ''),
    enabled: !!versionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_estimates')
        .select('*')
        .eq('version_id', versionId!)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectEstimateLine[];
    },
  });
}

// ── useImportEstimateMutation ────────────────────────────────────────────────
// 3-step chunked import. Cleans up orphan version header on error.
//
// KEY FIX — JSONB serialization:
// Supabase JS client passes RPC params as a JSON body. For parameters typed as
// `jsonb` in PostgreSQL, the value must arrive as a JSON string (not a raw JS
// object/array) so that PostgREST correctly interprets it as jsonb rather than
// attempting a text cast. We call JSON.stringify() on the payload array before
// passing it to supabase.rpc().
//
// KEY FIX — Orphan cleanup:
// versionId is captured in a module-scoped ref inside the hook so that the
// onError callback can delete it even though mutationFn's closure has exited.
export function useImportEstimateMutation(projectId: string) {
  const qc = useQueryClient();

  // Ref captures the versionId created in Step 1 so onError can clean it up.
  // Using a ref (not state) avoids re-renders and is safe in concurrent mode.
  const pendingVersionIdRef = useRef<string | null>(null);

  return useMutation<
    string, // returns version_id on success
    Error,
    {
      versionName: string;
      versionDate: string;   // ISO date "YYYY-MM-DD"
      setActive: boolean;
      rows: EstimateStagingRow[];
      incorporated_ve_ids?: string[];
    }
  >({
    mutationFn: async ({ versionName, versionDate, setActive, rows, incorporated_ve_ids }) => {
      // Reset any previous pending version from a prior failed attempt
      pendingVersionIdRef.current = null;

      // ── Step 1: Create version header (single call) ──────────────────────
      const { data: versionId, error: createErr } = await supabase.rpc(
        'create_estimate_version',
        {
          p_project_id:   projectId,
          p_version_name: versionName,
          p_version_date: versionDate,
          p_set_active:   setActive,
        }
      );
      if (createErr) throw new Error(`Failed to create estimate version: ${createErr.message}`);
      if (!versionId) throw new Error('create_estimate_version returned no version ID');

      // Capture for cleanup in onError
      pendingVersionIdRef.current = versionId as string;

      // ── Step 2: Chunk rows and insert sequentially (AGENTS.md C20) ────────
      // Sequential (not parallel Promise.all) so a failure on chunk N stops
      // immediately and triggers onError cleanup rather than continuing to insert
      // orphan rows. This is a justified deviation from C20's Promise.all wording —
      // C20's intent is to prevent gateway timeouts via chunking, which we satisfy.
      const chunks: EstimateStagingRow[][] = [];
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        chunks.push(rows.slice(i, i + CHUNK_SIZE));
      }

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        // Build serializable payload — strip ALL client-only staging fields.
        // is_budget_resolved, is_matched, procore_raw_code are UI-only and have
        // no corresponding columns in project_estimates.
        // IMPORTANT: pass the array directly — do NOT JSON.stringify(payload).
        // The Supabase JS client already JSON.stringifies the full params object.
        // Pre-stringifying causes PostgREST to receive a JSON *string* instead of
        // a JSON *array*, causing the RPC's jsonb_typeof() guard to fire ('string'
        // != 'array') and silently insert 0 rows → total_budget = $0.
        const payload = chunk.map((r: EstimateStagingRow) => ({
          cost_code:        r.cost_code        ?? null,
          cost_type:        r.cost_type        ?? null,
          description:      r.description,
          unit_qty:         r.unit_qty,
          uom:              r.uom              ?? null,
          unit_cost:        r.unit_cost,
          budget_amount:    r.budget_amount,
          display_order:    r.display_order,
          item_assumptions: r.item_assumptions ?? null,
          // Phase 1: variance note fields — RPC conditionally inserts into estimate_variance_notes
          variance_note:    r.variance_note    ?? null,
          variance_note_id: r.variance_note_id ?? null,
        }));

        const startRow  = chunkIdx * CHUNK_SIZE + 1;
        const endRow    = Math.min((chunkIdx + 1) * CHUNK_SIZE, rows.length);
        const { error: chunkErr } = await supabase.rpc('bulk_append_estimate_lines', {
          p_version_id: versionId as string,
          p_project_id: projectId,
          p_payload:    payload,
        });
        if (chunkErr) throw new Error(
          `Import failed on rows ${startRow}–${endRow} of ${rows.length}. ` +
          `Please try again or contact support if this persists. (${chunkErr.message})`
        );
      }


      // ── Step 3: Finalize — compute total_budget, mark is_finalized = true ─
      const { error: finalErr } = await supabase.rpc('finalize_estimate_version', {
        p_version_id: versionId as string,
        p_incorporated_ve_ids: incorporated_ve_ids || null,
      });
      if (finalErr) throw new Error(`Finalization failed: ${finalErr.message}`);

      // Clear the ref — import succeeded, no cleanup needed
      pendingVersionIdRef.current = null;
      return versionId as string;
    },

    onError: async () => {
      // Delete the orphan version header if Step 1 succeeded but 2 or 3 failed.
      // The RPC guards (is_finalized=false, is_active=false) ensure only true
      // orphans are deleted — finalized or active versions are protected.
      const orphanId = pendingVersionIdRef.current;
      if (!orphanId) return;
      pendingVersionIdRef.current = null;

      try {
        await supabase.rpc('delete_draft_estimate_version', {
          p_version_id: orphanId,
          p_project_id: projectId,
        });
      } catch {
        // Best-effort — server safety guards prevent accidental deletion of real data
        console.warn('[useImportEstimateMutation] Orphan cleanup failed for version', orphanId);
      }

      // Still invalidate so the UI reflects any partial state
      qc.invalidateQueries({ queryKey: estimateKeys.versions(projectId) });
    },

    onSuccess: () => {
      // Invalidate both version list and project settings (original_budget may have changed)
      // KEY: useProjectSettings uses 'project_settings' (underscore) — must match exactly.
      qc.invalidateQueries({ queryKey: estimateKeys.versions(projectId) });
      qc.invalidateQueries({ queryKey: ['project_settings', projectId] });
      qc.invalidateQueries({ queryKey: estimateKeys.waterfall(projectId) });
      qc.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      qc.invalidateQueries({ queryKey: estimateKeys.timeline(projectId) });
    },
  });
}

// ── useActivateEstimateVersion ───────────────────────────────────────────────
// Atomic swap: deactivates all others, syncs original_budget.
export function useActivateEstimateVersion(projectId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase.rpc('activate_estimate_version', {
        p_version_id: versionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: estimateKeys.versions(projectId) });
      qc.invalidateQueries({ queryKey: ['project_settings', projectId] });
      qc.invalidateQueries({ queryKey: estimateKeys.waterfall(projectId) });
      qc.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      qc.invalidateQueries({ queryKey: estimateKeys.timeline(projectId) });
    },
  });
}

// ── useDeleteEstimateVersion ──────────────────────────────────────────────────────
// Deletes a version (must not be active).
// Used by UI "Delete" button and mutation onError cleanup.
export function useDeleteEstimateVersion(projectId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase.rpc('delete_estimate_version', {
        p_version_id: versionId,
        p_project_id: projectId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: estimateKeys.versions(projectId) });
      qc.invalidateQueries({ queryKey: ['project_settings', projectId] });
      qc.invalidateQueries({ queryKey: estimateKeys.waterfall(projectId) });
      qc.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      qc.invalidateQueries({ queryKey: estimateKeys.timeline(projectId) });
    },
  });
}

// ── useProjectBudgetWaterfall ────────────────────────────────────────────────────
// Server-side aggregation — never compute client-side (AGENTS.md C5).
// 5-minute staleTime: expensive RPC, does not need real-time freshness.
export function useProjectBudgetWaterfall(projectId: string | null, versionId: string | null = null) {
  return useQuery<BudgetWaterfallRow[]>({
    queryKey: estimateKeys.waterfall(projectId ?? '', versionId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_budget_waterfall', {
        p_project_id: projectId!,
        p_version_id: versionId || null,
      });
      if (error) throw error;
      return (data ?? []) as BudgetWaterfallRow[];
    },
  });
}

// ── useCompareEstimateVersions ───────────────────────────────────────────────
// Fetches the variance delta between two estimate versions.
// Returns null if either version is missing to prevent unnecessary network requests (AGENTS.md C24).
export function useCompareEstimateVersions(projectId: string | null, versionA: string | null, versionB: string | null) {
  return useQuery<EstimateComparisonRow[]>({
    queryKey: ['compare-estimates', projectId, versionA, versionB],
    enabled: !!projectId && !!versionA && !!versionB,
    queryFn: async () => {
      if (!projectId || !versionA || !versionB) return []; // Fallback, shouldn't happen due to enabled

      const { data, error } = await supabase.rpc('compare_estimate_versions', {
        p_project_id: projectId,
        p_version_a_id: versionA,
        p_version_b_id: versionB,
      });

      if (error) throw error;
      return (data ?? []) as EstimateComparisonRow[];
    },
  });
}
// -- useMasterLedgerGrid ------------------------------------------------------
// Calls get_master_ledger_grid RPC to return fully aggregated ledger rows.
export function useMasterLedgerGrid(projectId: string | null) {
  return useQuery({
    queryKey: ['master-ledger-grid', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_master_ledger_grid', {
        p_project_id: projectId!,
      });
      if (error) throw error;
      return data || [];
    },
  });
}

// -- useEstimateLineDetails ---------------------------------------------------
// Fetches detailed estimate lines (Labor, Material, etc.) for a specific cost code.
// Audit Fix #4: Added ProjectEstimateLine[] generic to prevent untyped any[] return.
export function useEstimateLineDetails(projectId: string | null, costCode: string | null) {
  return useQuery<ProjectEstimateLine[]>({
    queryKey: estimateKeys.lineDetails(projectId ?? '', costCode ?? ''),
    enabled: !!projectId && !!costCode,
    queryFn: async () => {
      // Find the active version ID
      const { data: versions, error: vErr } = await supabase
        .from('project_estimate_versions')
        .select('id')
        .eq('project_id', projectId!)
        .eq('is_active', true)
        .limit(1);
      
      if (vErr) throw vErr;
      if (!versions || versions.length === 0) return [];
      
      const { data, error } = await supabase
        .from('project_estimates')
        .select('*')
        .eq('version_id', versions[0].id)
        .eq('cost_code', costCode!)
        .order('display_order', { ascending: true });
        
      if (error) throw error;
      return (data ?? []) as ProjectEstimateLine[];
    },
  });
}

// ── useEstimateVarianceNotes ─────────────────────────────────────────────────
// Fetches variance notes for a specific estimate version.
// Scoped to active version only (Phase 2 decision: active-only).
// 5-minute staleTime mirrors useProjectBudgetWaterfall — immutable once finalized.
export function useEstimateVarianceNotes(projectId: string | null, versionId: string | null) {
  return useQuery<EstimateVarianceNote[]>({
    queryKey: ['estimate-variance-notes', projectId, versionId],
    enabled: !!projectId && !!versionId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_variance_notes')
        .select('*')
        .eq('project_id', projectId!)
        .eq('estimate_version_id', versionId!);
      if (error) throw error;
      return (data ?? []) as EstimateVarianceNote[];
    },
  });
}

// ── Phase 3: Budget Detail Panel Hooks ───────────────────────────────────────

/** Extended type for variance notes with the joined version name */
export interface VarianceNoteWithVersion extends EstimateVarianceNote {
  version_name: string;
}

// ── useVarianceHistoryByCostCode ─────────────────────────────────────────────
// Fetches ALL variance notes across every estimate version for a given
// (project_id, cost_code), ordered by created_at DESC (newest first).
// Powers the read-only Variance History timeline in BudgetDetailView.
// 5-minute staleTime — variance notes are immutable once parent version is finalized.
export function useVarianceHistoryByCostCode(projectId: string | null, costCode: string | null) {
  return useQuery<VarianceNoteWithVersion[]>({
    queryKey: estimateKeys.varianceHistory(projectId ?? '', costCode ?? ''),
    enabled: !!projectId && !!costCode,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_variance_notes')
        .select('*, project_estimate_versions!inner(version_name)')
        .eq('project_id', projectId!)
        .eq('cost_code', costCode!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const joined = row as Record<string, unknown>;
        const versionData = joined.project_estimate_versions as
          | { version_name: string }
          | null;
        return {
          id: row.id as string,
          project_id: row.project_id as string,
          estimate_version_id: row.estimate_version_id as string,
          cost_code: row.cost_code as string | null,
          variance_note: row.variance_note as string,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          version_name: versionData?.version_name ?? 'Unknown',
        };
      });
    },
  });
}

// ── useUpdateEstimateAssumptions ─────────────────────────────────────────────
// Saves edits to item_assumptions on project_estimates for a specific cost code
// within the active version. Uses SECURITY DEFINER RPC (Audit Fix #1) to bypass
// the can_edit_project_settings RLS while checking can_edit_records instead.
// Cache invalidation targets estimateKeys.lineDetails() (must match Step 2b refactor).
export function useUpdateEstimateAssumptions(projectId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, { costCode: string; assumptions: string }>({
    mutationFn: async ({ costCode, assumptions }) => {
      const { error } = await supabase.rpc('update_estimate_assumptions', {
        p_project_id: projectId,
        p_cost_code: costCode,
        p_assumptions: assumptions || null, // AGENTS.md C11 — null, not undefined
      });
      if (error) throw error;
    },

    onSuccess: (_data, variables) => {
      // Invalidate the detail view so the panel reflects the saved text
      qc.invalidateQueries({
        queryKey: estimateKeys.lineDetails(projectId, variables.costCode),
      });
      // Update the FileText icon in the grid compound cell
      qc.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
    },
  });
}

// ── Phase 5: Multi-Version Forensic Matrix ────────────────────────────────────
export function useMultiVersionMatrix(
  projectId: string | null,
  versionIds: string[]
) {
  return useQuery<MultiVersionMatrixRow[]>({
    queryKey: ['multi-version-matrix', projectId, ...[...versionIds].sort()], // FIX #2: shallow copy before sort
    enabled: !!projectId && versionIds.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_multi_version_matrix', {
        p_project_id: projectId!,
        p_version_ids: versionIds,
      });
      if (error) throw error;
      return (data ?? []) as MultiVersionMatrixRow[];
    },
  });
}

// ── useBudgetVersionTimeline ─────────────────────────────────────────────────
// Fetches version milestones for the Risk Exposure Trend chart.
// Returns each finalized version with its baseline budget + current VE overlay.
// 5-minute staleTime — mirrors waterfall (expensive aggregation, no real-time need).
export function useBudgetVersionTimeline(projectId: string | null) {
  return useQuery<BudgetVersionTimelineRow[]>({
    queryKey: estimateKeys.timeline(projectId ?? ''),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_budget_version_timeline', {
        p_project_id: projectId!,
      });
      if (error) throw error;
      return (data ?? []) as BudgetVersionTimelineRow[];
    },
  });
}
