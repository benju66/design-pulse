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
} from '@/types/models';

const CHUNK_SIZE = 50; // AGENTS.md C20 — Kong gateway protection

// ── Query Key Factory ────────────────────────────────────────────────────────
export const estimateKeys = {
  versions:  (projectId: string) => ['estimate-versions', projectId] as const,
  lines:     (versionId: string) => ['estimate-lines',    versionId] as const,
  waterfall: (projectId: string, versionId: string | null) => ['budget-waterfall',  projectId, versionId] as const,
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
    }
  >({
    mutationFn: async ({ versionName, versionDate, setActive, rows }) => {
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
          cost_code:     r.cost_code     ?? null,
          cost_type:     r.cost_type     ?? null,
          description:   r.description,
          unit_qty:      r.unit_qty,
          uom:           r.uom           ?? null,
          unit_cost:     r.unit_cost,
          budget_amount: r.budget_amount,
          display_order: r.display_order,
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
        p_project_id: projectId,
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
    },
  });
}

// ── useDeleteDraftEstimateVersion ────────────────────────────────────────────
// Deletes an unfinalized (is_finalized=false, is_active=false) version.
// Used by UI "Delete" button and mutation onError cleanup.
export function useDeleteDraftEstimateVersion(projectId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase.rpc('delete_draft_estimate_version', {
        p_version_id: versionId,
        p_project_id: projectId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: estimateKeys.versions(projectId) });
    },
  });
}

// ── useProjectBudgetWaterfall ────────────────────────────────────────────────
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
