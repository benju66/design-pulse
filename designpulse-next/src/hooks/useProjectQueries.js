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
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data;
    },
    enabled: !!projectId
  });
}

export function useOpportunity(opportunityId) {
  return useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();
      if (error) {
        console.warn("Supabase Error:", error);
        return null;
      }
      return data;
    },
    enabled: !!opportunityId
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

export function useCreateOpportunity(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newRow) => {
      const { data, error } = await supabase
        .from('opportunities')
        .insert([{ project_id: projectId, status: 'Draft', cost_impact: 0, title: 'New Option', scope: 'General', ...newRow }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    },
    onError: (err) => {
      console.error('Create Opportunity Error:', err);
      alert(`Failed to add: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn("Supabase Projects Error:", error);
        return [];
      }
      return data;
    }
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newProject) => {
      const { data, error } = await supabase
        .from('projects')
        .insert([newProject])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      console.error('Create Project Error:', err);
      alert(`Failed to create project: ${err.message}`);
    }
  });
}

export function useOpportunityOptions(opportunityId) {
  return useQuery({
    queryKey: ['opportunity_options', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      const { data, error } = await supabase
        .from('opportunity_options')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: true });
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data;
    },
    enabled: !!opportunityId
  });
}

export function useCreateOption(opportunityId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newOption) => {
      const { data, error } = await supabase
        .from('opportunity_options')
        .insert([{ opportunity_id: opportunityId, title: 'New Contender', ...newOption }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
    }
  });
}

export function useUpdateOption(opportunityId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('opportunity_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
    }
  });
}

export function useDeleteOption(opportunityId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('opportunity_options')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
    }
  });
}

export function useLockOption(opportunityId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (optionId) => {
      // 1. Set all options for this opportunity to unlocked
      await supabase
        .from('opportunity_options')
        .update({ is_locked: false })
        .eq('opportunity_id', opportunityId);
      
      // 2. Lock the chosen option
      const { data: lockedOption, error: lockError } = await supabase
        .from('opportunity_options')
        .update({ is_locked: true })
        .eq('id', optionId)
        .select()
        .single();
        
      if (lockError) throw lockError;

      // 3. Update the parent opportunity row
      const { error: oppError } = await supabase
        .from('opportunities')
        .update({
          cost_impact: lockedOption.cost_impact,
          days_impact: lockedOption.days_impact,
          final_direction: `Locked: ${lockedOption.title}`,
          status: 'Pending Plan Update'
        })
        .eq('id', opportunityId);
        
      if (oppError) throw oppError;

      return lockedOption;
    },
    onSuccess: () => {
      // Invalidate both options and parent opportunities queries
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
  });
}
