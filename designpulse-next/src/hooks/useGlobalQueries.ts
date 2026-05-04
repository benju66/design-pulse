import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { CostCode, GlobalCsiTrainingData, RemapCsiEntryParams } from '@/types/models';
import { Database } from '@/types/database.types';

export function useCostCodes() {
  return useQuery({
    queryKey: ['cost_codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .order('code', { ascending: true });
      if (error) throw error;
      return data as CostCode[];
    },
    staleTime: Infinity, // Global codes rarely change
  });
}

// Upload (UPSERT) cost codes from a parsed CSV payload.
// Rule C20: Chunks into batches of 50 to prevent Kong API gateway timeouts.
// Rule C1:  Strict type — CostCode['Insert'][], no any casting.
// UPSERT strategy (onConflict: 'code') lets admins safely re-upload the master CSV
// to update descriptions or toggle boolean flags without breaking FK chains on
// opportunities, opportunity_options, project_csi_specs, and global_csi_training_data.
export function useUploadCostCodesCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Database['public']['Tables']['cost_codes']['Insert'][]) => {
      const CHUNK_SIZE = 50;
      const chunks: Database['public']['Tables']['cost_codes']['Insert'][][] = [];
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        chunks.push(payload.slice(i, i + CHUNK_SIZE));
      }
      await Promise.all(
        chunks.map(async (chunk) => {
          const { error } = await supabase
            .from('cost_codes')
            .upsert(chunk, { onConflict: 'code' });
          if (error) throw error;
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_codes'] });
    },
  });
}

export interface SystemUser {
  id: string;
  email: string;
  name: string | null;
  is_platform_admin: boolean;
}

export function useSystemUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['system_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_users');
      if (error) throw error;
      return data as SystemUser[];
    },
    enabled: options?.enabled !== false
  });
}

export function useTogglePlatformAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string, isAdmin: boolean }) => {
      if (isAdmin) {
        const { error } = await supabase.from('platform_admins').insert({ user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('platform_admins').delete().eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_users'] });
      queryClient.invalidateQueries({ queryKey: ['is_platform_admin'] });
    },
  });
}

export interface RolePermission {
  role: 'owner' | 'gc_admin' | 'design_team' | 'viewer';
  can_lock_options: boolean;
  can_unlock_options: boolean;
  can_manage_team: boolean;
  can_edit_project_settings: boolean;
  can_manage_budget: boolean;
  can_edit_records: boolean;
  can_delete_records: boolean;
  can_view_audit_logs: boolean;
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ['role_permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');
      if (error) throw error;
      
      const roleOrder = ['owner', 'gc_admin', 'design_team', 'viewer'];
      return (data as RolePermission[]).sort((a, b) => {
        return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
      });
    },
  });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ role, field, value }: { role: string, field: keyof Omit<RolePermission, 'role'>, value: boolean }) => {
      const { error } = await supabase
        .from('role_permissions')
        .update({ [field]: value })
        .eq('role', role);
      if (error) throw error;
    },
    onMutate: async (newUpdate) => {
      await queryClient.cancelQueries({ queryKey: ['role_permissions'] });
      const previousPermissions = queryClient.getQueryData<RolePermission[]>(['role_permissions']);

      queryClient.setQueryData<RolePermission[]>(['role_permissions'], old => 
        old?.map(p => p.role === newUpdate.role ? { ...p, [newUpdate.field]: newUpdate.value } : p)
      );

      return { previousPermissions };
    },
    onError: (_err, _newUpdate, context) => {
      if (context?.previousPermissions) {
        queryClient.setQueryData(['role_permissions'], context.previousPermissions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['role_permissions'] });
    },
  });
}

// ── Phase 4: ML Flywheel ─────────────────────────────────────────────────────

// Fetch the global CSI training data for the admin review grid.
// Sorted by normalized_csi_number + global_cost_code_id for MVCC tie-breaking
// (Rule C22 — prevents row jumping when the flywheel trigger fires during viewing).
export function useGlobalCsiTrainingData() {
  return useQuery<GlobalCsiTrainingData[], Error>({
    queryKey: ['global_csi_training_data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_csi_training_data')
        .select('*')
        .order('normalized_csi_number', { ascending: true })
        .order('global_cost_code_id', { ascending: true });
      if (error) throw error;
      return data as GlobalCsiTrainingData[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// Toggle is_admin_verified on a single row.
// Direct .update() is valid: RLS "FOR ALL USING (is_platform_admin())" covers this.
export function useToggleGlobalCsiVerified() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { normalizedCsiNumber: string; costCodeId: string; value: boolean }>({
    mutationFn: async ({ normalizedCsiNumber, costCodeId, value }) => {
      const { error } = await supabase
        .from('global_csi_training_data')
        .update({ is_admin_verified: value })
        .eq('normalized_csi_number', normalizedCsiNumber)
        .eq('global_cost_code_id', costCodeId);
      if (error) throw error;
    },
    onMutate: async ({ normalizedCsiNumber, costCodeId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['global_csi_training_data'] });
      const previous = queryClient.getQueryData<GlobalCsiTrainingData[]>(['global_csi_training_data']);
      queryClient.setQueryData<GlobalCsiTrainingData[]>(
        ['global_csi_training_data'],
        old => old?.map(r =>
          r.normalized_csi_number === normalizedCsiNumber && r.global_cost_code_id === costCodeId
            ? { ...r, is_admin_verified: value }
            : r
        )
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previous?: GlobalCsiTrainingData[] } | undefined;
      if (c?.previous) queryClient.setQueryData(['global_csi_training_data'], c.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['global_csi_training_data'] });
    },
  });
}

// Remap a CSI entry to a different base cost code via the SECURITY DEFINER RPC.
// Cannot use .update() because global_cost_code_id is part of the composite PK.
export function useRemapGlobalCsiEntry() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, RemapCsiEntryParams>({
    mutationFn: async ({ normalizedCsiNumber, oldCostCode, newCostCode, description, rawCsiNumber }) => {
      const { error } = await supabase.rpc('remap_global_csi_entry', {
        p_normalized_csi_number : normalizedCsiNumber,
        p_old_cost_code         : oldCostCode,
        p_new_cost_code         : newCostCode,
        p_description           : description  ?? null,
        p_raw_csi_number        : rawCsiNumber ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global_csi_training_data'] });
    },
  });
}

// ── Phase 5: ML Flywheel Auto-Suggest ────────────────────────────────────────

// Fetch suggestions using the optimized DISTINCT ON RPC to avoid 414 URI Too Long limits.
export function useCsiTrainingSuggestions(normalizedCodes: string[]) {
  return useQuery<GlobalCsiTrainingData[], Error>({
    queryKey: ['csi_training_suggestions', normalizedCodes],
    queryFn: async () => {
      if (!normalizedCodes.length) return [];
      
      const { data, error } = await supabase.rpc('get_csi_training_suggestions', {
        p_normalized_codes: normalizedCodes
      });
      if (error) throw error;
      return data as GlobalCsiTrainingData[];
    },
    enabled: normalizedCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Phase 6: Global User Management ──────────────────────────────────────────

export function useUserProjectMembers(userId: string | null) {
  return useQuery<{ project_id: string; role: string }[], Error>({
    queryKey: ['project_members', 'user', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useBulkUpdateUserProjects() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { userId: string; payload: { project_id: string; role: string; action: 'UPSERT' | 'DELETE' }[] }
  >({
    mutationFn: async ({ userId, payload }) => {
      // Guardrail 20 & 11: Chunking & Null Safety
      const CHUNK_SIZE = 100;
      const chunks = [];
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        chunks.push(payload.slice(i, i + CHUNK_SIZE));
      }
      await Promise.all(
        chunks.map((chunk) =>
          supabase.rpc('bulk_update_user_projects', {
            p_user_id: userId || null,
            p_assignments: chunk || null,
          })
        )
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project_members', 'user', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['project_members'] }); // Also invalidate any specific project member queries
    },
  });
}
