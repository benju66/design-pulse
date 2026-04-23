import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

export function useOpportunities(projectId) {
  return useQuery({
    queryKey: ['opportunities', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId
  });
}

export function useUpdateOpportunity(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('opportunities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      // Optimistic update for that "instant Excel" feel
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      queryClient.setQueriesData({ queryKey: ['opportunities', projectId] }, old => {
        if (!old) return old;
        return old.map(opp => opp.id === id ? { ...opp, ...updates } : opp);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    }
  });
}
