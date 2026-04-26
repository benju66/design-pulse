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
