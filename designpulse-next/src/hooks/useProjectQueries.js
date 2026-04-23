import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { DEFAULT_CATEGORIES, DEFAULT_SIDEBAR_ITEMS, DEFAULT_SCOPES } from '@/lib/constants';

export function useProjectSettings(projectId) {
  return useQuery({
    queryKey: ['project_settings', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_id', projectId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is not found, which is fine for new projects
        console.warn("Supabase Error:", error);
      }
      const defaultSettings = {
        categories: DEFAULT_CATEGORIES, 
        scopes: DEFAULT_SCOPES,
        sidebar_items: DEFAULT_SIDEBAR_ITEMS,
        project_name: projectId,
        location: 'Not Set',
        original_budget: 5000000
      };

      if (!data) return defaultSettings;

      return {
        categories: data.categories?.length > 0 ? data.categories : defaultSettings.categories,
        scopes: data.scopes?.length > 0 ? data.scopes : defaultSettings.scopes,
        sidebar_items: data.sidebar_items?.length > 0 ? data.sidebar_items : defaultSettings.sidebar_items,
        project_name: data.project_name || defaultSettings.project_name,
        location: data.location || defaultSettings.location,
        original_budget: data.original_budget ?? defaultSettings.original_budget
      };
    },
    enabled: !!projectId
  });
}

export function useUpdateProjectSettings(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('project_settings')
        .upsert({ project_id: projectId, ...updates })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project_settings', projectId]);
    }
  });
}

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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['all_options'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
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
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['opportunity_options', opportunityId] });
      await queryClient.cancelQueries({ queryKey: ['all_options'] });
      
      const previousOptions = queryClient.getQueryData(['opportunity_options', opportunityId]);
      
      queryClient.setQueryData(['opportunity_options', opportunityId], old => {
        if (!old) return old;
        return old.map(opt => opt.id === id ? { ...opt, ...updates } : opt);
      });

      queryClient.setQueriesData({ queryKey: ['all_options'] }, old => {
        if (!old) return old;
        return old.map(opt => opt.id === id ? { ...opt, ...updates } : opt);
      });

      return { previousOptions };
    },
    onError: (err, variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['opportunity_options', opportunityId], context.previousOptions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['all_options'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['opportunity_options', opportunityId] });
      await queryClient.cancelQueries({ queryKey: ['all_options'] });
      
      const previousOptions = queryClient.getQueryData(['opportunity_options', opportunityId]);
      
      queryClient.setQueryData(['opportunity_options', opportunityId], old => {
        if (!old) return old;
        return old.filter(opt => opt.id !== id);
      });

      queryClient.setQueriesData({ queryKey: ['all_options'] }, old => {
        if (!old) return old;
        return old.filter(opt => opt.id !== id);
      });

      return { previousOptions };
    },
    onError: (err, id, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['opportunity_options', opportunityId], context.previousOptions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['all_options'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
  });
}

export function useLockOption(opportunityId, projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (optionId) => {
      const { data, error } = await supabase.rpc('lock_opportunity_option', {
        p_option_id: optionId,
        p_opp_id: opportunityId
      });
      if (error) throw error;
      return data;
    },
    onMutate: async (optionId) => {
      await queryClient.cancelQueries({ queryKey: ['opportunity_options', opportunityId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      await queryClient.cancelQueries({ queryKey: ['all_options'] });

      const previousOptions = queryClient.getQueryData(['opportunity_options', opportunityId]);
      const previousOpportunities = queryClient.getQueryData(['opportunities', projectId]);

      // Optimistically update options
      queryClient.setQueryData(['opportunity_options', opportunityId], old => {
        if (!old) return old;
        return old.map(opt => ({ ...opt, is_locked: opt.id === optionId }));
      });

      queryClient.setQueriesData({ queryKey: ['all_options'] }, old => {
        if (!old) return old;
        return old.map(opt => 
          opt.opportunity_id === opportunityId 
            ? { ...opt, is_locked: opt.id === optionId }
            : opt
        );
      });

      // Optimistically update parent opportunity
      queryClient.setQueryData(['opportunities', projectId], old => {
        if (!old) return old;
        const targetOpt = previousOptions?.find(opt => opt.id === optionId);
        if (!targetOpt) return old;
        return old.map(opp => 
          opp.id === opportunityId 
            ? { 
                ...opp, 
                cost_impact: targetOpt.cost_impact || 0,
                days_impact: targetOpt.days_impact || 0,
                final_direction: `Locked: ${targetOpt.title}`,
                status: 'Pending Plan Update'
              } 
            : opp
        );
      });

      return { previousOptions, previousOpportunities };
    },
    onError: (err, optionId, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['opportunity_options', opportunityId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_options'] });
    }
  });
}

export function useToggleOptionBudget(opportunityId, projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ optionId, isIncluded }) => {
      const { data, error } = await supabase.rpc('toggle_option_budget', {
        p_option_id: optionId,
        p_opp_id: opportunityId,
        p_is_included: isIncluded
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ optionId, isIncluded }) => {
      await queryClient.cancelQueries({ queryKey: ['opportunity_options', opportunityId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      await queryClient.cancelQueries({ queryKey: ['all_options'] });

      const previousOptions = queryClient.getQueryData(['opportunity_options', opportunityId]);
      const previousOpportunities = queryClient.getQueryData(['opportunities', projectId]);

      queryClient.setQueryData(['opportunity_options', opportunityId], old => {
        if (!old) return old;
        return old.map(opt => opt.id === optionId ? { ...opt, include_in_budget: isIncluded } : opt);
      });

      queryClient.setQueriesData({ queryKey: ['all_options'] }, old => {
        if (!old) return old;
        return old.map(opt => opt.id === optionId ? { ...opt, include_in_budget: isIncluded } : opt);
      });

      queryClient.setQueryData(['opportunities', projectId], old => {
        if (!old) return old;
        const targetOpt = previousOptions?.find(opt => opt.id === optionId);
        if (!targetOpt) return old;
        return old.map(opp => 
          opp.id === opportunityId 
            ? { 
                ...opp, 
                cost_impact: isIncluded ? (targetOpt.cost_impact || 0) : 0,
                days_impact: isIncluded ? (targetOpt.days_impact || 0) : 0
              } 
            : opp
        );
      });

      return { previousOptions, previousOpportunities };
    },
    onError: (err, variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['opportunity_options', opportunityId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity_options', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_options'] });
    }
  });
}
