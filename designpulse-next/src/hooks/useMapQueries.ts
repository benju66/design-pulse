import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { Zone, ProjectSheet } from '@/types/map.types';

// ── useProjectSheets ──────────────────────────────────────────────────────────
// Fetches all sheets for a project.
// Auto-polls every 3s while any sheet has status='processing' (AGENTS.md C2).
// MVCC tie-breaker: created_at DESC + id ASC (AGENTS.md C22).
export function useProjectSheets(projectId: string | null) {
  return useQuery<ProjectSheet[]>({
    queryKey: ['project_sheets', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_sheets')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }); // MVCC tie-breaker (C22)
      if (error) throw error;
      return (data ?? []) as ProjectSheet[];
    },
    enabled: !!projectId,
    // Realtime (useSheetRealtime) is the primary update driver.
    // This poll is a silent resilience fallback for WebSocket disconnections only.
    // 5s is deliberately slower than the previous 3s to de-prioritize it.
    refetchInterval: (query) => {
      const sheets = query.state.data;
      if (!Array.isArray(sheets)) return false;
      return sheets.some((s) => s.status === 'processing') ? 5000 : false;
    },
  });
}

// ── useSheetMarkups ───────────────────────────────────────────────────────────
export function useSheetMarkups(sheetId: string | null) {
  return useQuery<SheetMarkupRow[]>({
    queryKey: ['sheet_markups', sheetId],
    queryFn: async () => {
      if (!sheetId) return [];
      const { data, error } = await supabase
        .from('sheet_markups')
        .select('*')
        .eq('sheet_id', sheetId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }); // MVCC tie-breaker (C22)
      if (error) throw error;
      return (data ?? []) as SheetMarkupRow[];
    },
    enabled: !!sheetId,
  });
}

// ── markupsToZones ────────────────────────────────────────────────────────────
// Pure transform: SheetMarkupRow[] → Zone[].
// The geometry JSONB blob stores the full Zone object (set in useUpdateSheetMarkups).
// Uses unknown intermediate cast + runtime guard — no `any` (AGENTS.md C1).
export function markupsToZones(markups: SheetMarkupRow[]): Zone[] {
  return markups.flatMap((row) => {
    const geo = row.geometry as unknown;
    if (!geo || typeof geo !== 'object') return [];
    const z = geo as Partial<Zone>;
    if (!z.id || !Array.isArray(z.coordinates) || z.coordinates.length < 3) return [];
    return [{
      id: z.id,
      label: z.label ?? '',
      coordinates: z.coordinates,
      color: z.color ?? '#3b82f6',
      opacity: z.opacity ?? 0.4,
      opportunityId: z.opportunityId,
    } satisfies Zone];
  });
}

// ── Internal types ────────────────────────────────────────────────────────────

/** Shape of a sheet_markups row returned from Supabase queries. */
interface SheetMarkupRow {
  id: string;
  sheet_id: string;
  opportunity_id: string | null;  // nullable — unlinked zones have null here
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

/** Typed rollback context for sheet list mutations. */
interface SheetMutationContext {
  previousSheets: ProjectSheet[] | undefined;
}

// ── useUpdateSheetMarkups ─────────────────────────────────────────────────────
// Atomically replaces all markups for a (sheet_id, opportunity_id) pair via RPC.
// Pass opportunityId: null for unlinked zones — the RPC uses IS NOT DISTINCT FROM
// to handle the NULL case correctly (AGENTS.md C11).
export function useUpdateSheetMarkups() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { sheetId: string; opportunityId: string | null; markups: Zone[] },
    MarkupMutationContext
  >({
    mutationFn: async ({ sheetId, opportunityId, markups }) => {
      const sanitizedMarkups = markups.map((m) => ({
        geometry: { ...m, id: m.id || crypto.randomUUID() },
        style: {},
        metadata: {},
      }));

      const { error } = await supabase.rpc('upsert_sheet_markups', {
        p_sheet_id: sheetId,
        p_opportunity_id: opportunityId ?? null,  // C11: explicit null, never undefined
        p_markups: sanitizedMarkups as unknown as Record<string, unknown>,
      });

      if (error) throw error;
    },
    onMutate: async ({ sheetId, opportunityId, markups }) => {
      await queryClient.cancelQueries({ queryKey: ['sheet_markups', sheetId] });

      const previousMarkups = queryClient.getQueryData<SheetMarkupRow[]>(['sheet_markups', sheetId]);

      queryClient.setQueryData<SheetMarkupRow[]>(['sheet_markups', sheetId], (old) => {
        if (!old) return old;
        // IS NOT DISTINCT FROM semantics in JS: null matches null, string matches string
        const filtered = old.filter((m) =>
          opportunityId === null
            ? m.opportunity_id !== null
            : m.opportunity_id !== opportunityId
        );
        const newMockMarkups: SheetMarkupRow[] = markups.map((m) => ({
          id: m.id || crypto.randomUUID(),
          sheet_id: sheetId,
          opportunity_id: opportunityId,
          geometry: m as unknown as Record<string, unknown>,
          style: {},
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
    },
  });
}

// ── useCreateProjectSheet ─────────────────────────────────────────────────────
// Creates a project_sheets row, then the caller fires processSheetService in
// onSuccess to trigger tile generation. Client-mints the UUID (AGENTS.md C8).
export function useCreateProjectSheet() {
  const queryClient = useQueryClient();

  return useMutation<
    ProjectSheet,
    Error,
    { projectId: string; sheetName: string; id: string },
    SheetMutationContext
  >({
    mutationFn: async ({ projectId, sheetName, id }) => {
      // id is minted at call site (AGENTS.md C8) — never here
      const { data, error } = await supabase
        .from('project_sheets')
        .insert({ id, project_id: projectId, sheet_name: sheetName, status: 'processing' })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectSheet;
    },
    onMutate: async ({ projectId, sheetName, id }) => {
      await queryClient.cancelQueries({ queryKey: ['project_sheets', projectId] });
      const previousSheets = queryClient.getQueryData<ProjectSheet[]>(['project_sheets', projectId]);

      // Optimistic insert — same UUID as DB insert, no remount on onSettled (C8)
      const optimisticSheet: ProjectSheet = {
        id,
        project_id: projectId,
        sheet_name: sheetName,
        status: 'processing',
        progress_percent: 0,
        original_width: null,
        original_height: null,
        max_zoom: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<ProjectSheet[]>(['project_sheets', projectId], (old) =>
        old ? [...old, optimisticSheet] : [optimisticSheet]
      );
      return { previousSheets };
    },
    onError: (_err, { projectId }, context) => {
      if (context?.previousSheets) {
        queryClient.setQueryData(['project_sheets', projectId], context.previousSheets);
      }
    },
    onSettled: (_data, _err, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project_sheets', projectId] });
    },
  });
}

// ── useDeleteProjectSheet ─────────────────────────────────────────────────────
// Optimistically removes the sheet from cache; rolls back on error.
export function useDeleteProjectSheet() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { projectId: string; sheetId: string },
    SheetMutationContext
  >({
    mutationFn: async ({ sheetId }) => {
      const { error } = await supabase
        .from('project_sheets')
        .delete()
        .eq('id', sheetId);
      if (error) throw error;
    },
    onMutate: async ({ projectId, sheetId }) => {
      await queryClient.cancelQueries({ queryKey: ['project_sheets', projectId] });
      const previousSheets = queryClient.getQueryData<ProjectSheet[]>(['project_sheets', projectId]);
      queryClient.setQueryData<ProjectSheet[]>(['project_sheets', projectId], (old) =>
        old ? old.filter((s) => s.id !== sheetId) : []
      );
      return { previousSheets };
    },
    onError: (_err, { projectId }, context) => {
      if (context?.previousSheets) {
        queryClient.setQueryData(['project_sheets', projectId], context.previousSheets);
      }
    },
    onSettled: (_data, _err, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project_sheets', projectId] });
    },
  });
}

// ── useRenameProjectSheet ─────────────────────────────────────────────────────
// Optimistically updates sheet_name in cache; rolls back on error.
export function useRenameProjectSheet() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { projectId: string; sheetId: string; newName: string },
    SheetMutationContext
  >({
    mutationFn: async ({ sheetId, newName }) => {
      const { error } = await supabase
        .from('project_sheets')
        .update({ sheet_name: newName })
        .eq('id', sheetId);
      if (error) throw error;
    },
    onMutate: async ({ projectId, sheetId, newName }) => {
      await queryClient.cancelQueries({ queryKey: ['project_sheets', projectId] });
      const previousSheets = queryClient.getQueryData<ProjectSheet[]>(['project_sheets', projectId]);
      queryClient.setQueryData<ProjectSheet[]>(['project_sheets', projectId], (old) =>
        old
          ? old.map((s) => (s.id === sheetId ? { ...s, sheet_name: newName } : s))
          : []
      );
      return { previousSheets };
    },
    onError: (_err, { projectId }, context) => {
      if (context?.previousSheets) {
        queryClient.setQueryData(['project_sheets', projectId], context.previousSheets);
      }
    },
    onSettled: (_data, _err, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project_sheets', projectId] });
    },
  });
}
