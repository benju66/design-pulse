'use client';
/**
 * useUpsertVarianceNote.ts
 *
 * TanStack mutation hook for creating/updating variance notes on the active
 * estimate version. Used by VarianceNotePopover and BudgetDetailView.
 *
 * Architecture:
 *  - Writes scoped to active version only (upsert_variance_note RPC)
 *  - Invalidates both the active-version note cache and per-cost-code history
 *  - RBAC: can_edit_project_settings (matches estimate_variance_notes RLS)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { estimateKeys } from './useEstimateQueries';

export function useUpsertVarianceNote(projectId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, { costCode: string; note: string }>({
    mutationFn: async ({ costCode, note }) => {
      const { error } = await supabase.rpc('upsert_variance_note', {
        p_project_id: projectId,
        p_cost_code: costCode,
        p_note: note,
      });
      if (error) throw error;
    },

    onSuccess: (_data, variables) => {
      // Invalidate active-version notes (grid icon)
      qc.invalidateQueries({ queryKey: ['estimate-variance-notes', projectId] });
      // Invalidate per-cost-code history (detail panel timeline)
      qc.invalidateQueries({
        queryKey: estimateKeys.varianceHistory(projectId, variables.costCode),
      });
      // Refresh the master ledger grid so the delta cell icon updates
      qc.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
    },
  });
}
