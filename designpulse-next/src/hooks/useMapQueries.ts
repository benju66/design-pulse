import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { Zone } from '@/types/map.types';

export function useProjectSheets(projectId: string | null) {
  return useQuery({
    queryKey: ['project_sheets', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_sheets')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }); // MVCC Tie-breaker
      if (error) throw error;
      return data;
    },
    enabled: !!projectId
  });
}

export function useSheetMarkups(sheetId: string | null) {
  return useQuery({
    queryKey: ['sheet_markups', sheetId],
    queryFn: async () => {
      if (!sheetId) return [];
      const { data, error } = await supabase
        .from('sheet_markups')
        .select('*')
        .eq('sheet_id', sheetId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }); // MVCC Tie-breaker
      if (error) throw error;
      return data;
    },
    enabled: !!sheetId
  });
}

/** Shape of a sheet_markups row returned from Supabase queries. */
interface SheetMarkupRow {
  id: string;
  sheet_id: string;
  opportunity_id: string;
  geometry: Record<string, unknown>;
  style: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Typed rollback context for optimistic mutation recovery. */
interface MarkupMutationContext {
  previousMarkups: SheetMarkupRow[] | undefined;
}

export function useUpdateSheetMarkups() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { sheetId: string; opportunityId: string; markups: Zone[] },
    MarkupMutationContext
  >({
    mutationFn: async ({ sheetId, opportunityId, markups }) => {
      // Build the JSONB payload for the atomic RPC
      const sanitizedMarkups = markups.map(m => ({
        geometry: { ...m, id: m.id || crypto.randomUUID() },
        style: {},
        metadata: {}
      }));

      const { error } = await supabase.rpc('upsert_sheet_markups', {
        p_sheet_id: sheetId,
        p_opportunity_id: opportunityId,
        p_markups: sanitizedMarkups as unknown as Record<string, unknown>
      });

      if (error) throw error;
    },
    onMutate: async ({ sheetId, opportunityId, markups }) => {
      await queryClient.cancelQueries({ queryKey: ['sheet_markups', sheetId] });

      const previousMarkups = queryClient.getQueryData<SheetMarkupRow[]>(['sheet_markups', sheetId]);

      // Optimistic update — strictly typed, no `any`
      queryClient.setQueryData<SheetMarkupRow[]>(['sheet_markups', sheetId], (old) => {
        if (!old) return old;
        // Remove old markups for this opportunity
        const filtered = old.filter((m) => m.opportunity_id !== opportunityId);
        // Add new mock markups
        const newMockMarkups: SheetMarkupRow[] = markups.map(m => ({
          id: m.id || crypto.randomUUID(),
          sheet_id: sheetId,
          opportunity_id: opportunityId,
          geometry: m as unknown as Record<string, unknown>,
          style: {},
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        return [...filtered, ...newMockMarkups];
      });

      return { previousMarkups };
    },
    onError: (_err, { sheetId }, context) => {
      if (context?.previousMarkups) {
        queryClient.setQueryData(['sheet_markups', sheetId], context.previousMarkups);
      }
    },
    onSettled: (_data, _err, { sheetId }) => {
      queryClient.invalidateQueries({ queryKey: ['sheet_markups', sheetId] });
    }
  });
}
