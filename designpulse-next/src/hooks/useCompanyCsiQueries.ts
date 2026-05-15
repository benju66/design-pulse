import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { CompanyCsiDefault } from '@/types/models';
import { toast } from 'sonner';

/**
 * Fetch all company-level default CSI-to-Cost-Code mappings.
 * Readable by all authenticated users (RLS: SELECT USING true).
 */
export function useCompanyCsiDefaults() {
  return useQuery<CompanyCsiDefault[], Error>({
    queryKey: ['company_csi_defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_csi_defaults')
        .select('*')
        .order('csi_number', { ascending: true });
      if (error) throw error;
      return data as CompanyCsiDefault[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — company defaults rarely change
  });
}

/**
 * Bulk upsert company CSI defaults via SECURITY DEFINER RPC.
 * Platform Admin only. Chunk size 50 (AGENTS.md C20).
 */
export function useBulkUpsertCompanyCsiDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<CompanyCsiDefault>[]) => {
      if (!payload.length) return;

      const CHUNK_SIZE = 50;
      const chunks: Partial<CompanyCsiDefault>[][] = [];
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        chunks.push(payload.slice(i, i + CHUNK_SIZE));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          const { error } = await supabase.rpc('bulk_upsert_company_csi_defaults', {
            p_payload: chunk,
          });
          if (error) {
            const msg = error.message || error.details || error.hint || JSON.stringify(error);
            throw new Error(msg);
          }
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_csi_defaults'] });
      toast.success('Company CSI defaults saved successfully.');
    },
    onError: (err: Error) => {
      console.error('Bulk Upsert Company CSI Defaults Error:', err);
      toast.error(`Failed to save company defaults: ${err.message}`);
    },
  });
}

/**
 * Delete a single company CSI default row.
 * Platform Admin only (enforced by RLS DELETE policy).
 */
export function useDeleteCompanyCsiDefault() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_csi_defaults')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_csi_defaults'] });
      toast.success('Company default removed.');
    },
    onError: (err: Error) => {
      console.error('Delete Company CSI Default Error:', err);
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}

/**
 * Seed a project with company CSI defaults via SECURITY DEFINER RPC.
 * Uses ON CONFLICT DO NOTHING — safe to call repeatedly (idempotent).
 * Returns the number of newly seeded specs.
 */
export function useSeedFromCompanyDefaults(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('seed_project_from_company_defaults', {
        p_project_id: projectId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['project_csi_specs', projectId] });
      if (count > 0) {
        toast.success(`Seeded ${count} company default CSI specs into this project.`);
      } else {
        toast.info('All company defaults already exist in this project. 0 new specs seeded.');
      }
    },
    onError: (err: Error) => {
      console.error('Seed Company Defaults Error:', err);
      toast.error(`Failed to seed defaults: ${err.message}`);
    },
  });
}

// ── Phase 2: Rosetta Stone Aggregation ──────────────────────────────────────────

/** Row shape returned by `get_company_csi_rosetta_view` RPC */
export interface RosettaViewRow {
  cost_code: string | null;
  cost_code_description: string | null;
  default_csi_number: string;
  default_csi_description: string | null;
  project_specs: { project_id: string; project_name: string; csi_number: string }[];
}

/**
 * Fetches the Rosetta Stone aggregation view.
 * Shows company defaults alongside project-specific overrides.
 * Platform Admin only (enforced by RPC RBAC guard).
 */
export function useCompanyCsiRosettaView(enabled: boolean) {
  return useQuery<RosettaViewRow[], Error>({
    queryKey: ['company_csi_rosetta_view'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_csi_rosetta_view');
      if (error) throw error;
      return (data ?? []) as RosettaViewRow[];
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 min — admin dashboard view
  });
}
