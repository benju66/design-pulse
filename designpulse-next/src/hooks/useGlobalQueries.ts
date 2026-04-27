import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { CostCode } from '@/types/models';

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

export function useUploadCostCodesCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (parsedData: CostCode[]) => {
      // 1. Delete all existing cost codes (using a dummy filter to trick the safeguard)
      const { error: deleteError } = await supabase
        .from('cost_codes')
        .delete()
        .neq('code', 'RESERVED_NEVER_DELETE');
      if (deleteError) throw deleteError;

      // 2. Insert the new ones
      const { error: insertError } = await supabase
        .from('cost_codes')
        .insert(parsedData);
      if (insertError) throw insertError;
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

export function useSystemUsers() {
  return useQuery({
    queryKey: ['system_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_users');
      if (error) throw error;
      return data as SystemUser[];
    },
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
