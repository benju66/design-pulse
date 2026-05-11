'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { DrawingSet } from '@/types/map.types';

// ── useDrawingSets ────────────────────────────────────────────────────────────
// Fetches all drawing sets for a project, ordered by created_at DESC
// (newest set shown first in the selector list).
export function useDrawingSets(projectId: string | null) {
  return useQuery<DrawingSet[]>({
    queryKey: ['drawing_sets', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_drawing_sets')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DrawingSet[];
    },
    enabled: !!projectId,
  });
}

// ── useCreateDrawingSet ───────────────────────────────────────────────────────
// Calls create_drawing_set() SECURITY DEFINER RPC.
// Optimistically inserts the new set into the cache (AGENTS.md C2, C8).
// If p_set_active=true, the RPC atomically deactivates the current active set (C33).
export function useCreateDrawingSet() {
  const queryClient = useQueryClient();

  return useMutation<
    string,          // return: new set UUID
    Error,
    {
      projectId: string;
      setName: string;
      issueDate: string | null;
      makeActive: boolean;
    },
    { previousSets: DrawingSet[] | undefined }
  >({
    mutationFn: async ({ projectId, setName, issueDate, makeActive }) => {
      const { data, error } = await supabase.rpc('create_drawing_set', {
        p_project_id: projectId,
        p_set_name: setName,
        p_issue_date: issueDate ?? null,
        p_set_active: makeActive,
      });
      if (error) throw error;
      return data as string;
    },
    onMutate: async ({ projectId, setName, issueDate, makeActive }) => {
      await queryClient.cancelQueries({ queryKey: ['drawing_sets', projectId] });
      const previousSets = queryClient.getQueryData<DrawingSet[]>(['drawing_sets', projectId]);

      // Optimistic insert — client-minted UUID matches server on settle (C8)
      const optimisticId = crypto.randomUUID();
      const now = new Date().toISOString();

      queryClient.setQueryData<DrawingSet[]>(['drawing_sets', projectId], (old) => {
        const base = old ?? [];
        // If making active, optimistically flip others to is_active=false
        const updated = makeActive ? base.map((s) => ({ ...s, is_active: false })) : base;
        return [
          {
            id: optimisticId,
            project_id: projectId,
            set_name: setName,
            issue_date: issueDate,
            description: null,
            is_active: makeActive,
            created_at: now,
            updated_at: now,
          },
          ...updated,
        ];
      });

      return { previousSets };
    },
    onError: (_err, { projectId }, context) => {
      if (context?.previousSets) {
        queryClient.setQueryData(['drawing_sets', projectId], context.previousSets);
      }
    },
    onSettled: (_data, _err, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_sets', projectId] });
    },
  });
}

// ── useActivateDrawingSet ─────────────────────────────────────────────────────
// Calls activate_drawing_set() SECURITY DEFINER RPC.
// Atomic swap: all others → is_active=false, target → is_active=true (C33).
export function useActivateDrawingSet() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { setId: string; projectId: string },
    { previousSets: DrawingSet[] | undefined }
  >({
    mutationFn: async ({ setId }) => {
      const { error } = await supabase.rpc('activate_drawing_set', {
        p_set_id: setId,
      });
      if (error) throw error;
    },
    onMutate: async ({ setId, projectId }) => {
      await queryClient.cancelQueries({ queryKey: ['drawing_sets', projectId] });
      const previousSets = queryClient.getQueryData<DrawingSet[]>(['drawing_sets', projectId]);

      // Optimistic atomic swap
      queryClient.setQueryData<DrawingSet[]>(['drawing_sets', projectId], (old) =>
        (old ?? []).map((s) => ({ ...s, is_active: s.id === setId }))
      );

      return { previousSets };
    },
    onError: (_err, { projectId }, context) => {
      if (context?.previousSets) {
        queryClient.setQueryData(['drawing_sets', projectId], context.previousSets);
      }
    },
    onSettled: (_data, _err, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_sets', projectId] });
    },
  });
}
