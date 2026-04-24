import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { DEFAULT_CATEGORIES, DEFAULT_SIDEBAR_ITEMS, DEFAULT_SCOPES } from '@/lib/constants';
import { calculateParentTotals } from '@/utils/financialMath';

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
        original_budget: 0
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
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      queryClient.setQueriesData({ queryKey: ['opportunities', projectId] }, old => {
        if (!old) return old;
        return old.map(opp => opp.id === id ? { ...opp, ...updates } : opp);
      });
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

export function useAllProjectOptions(projectId) {
  return useQuery({
    queryKey: ['all_project_options', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('opportunity_options')
        .select('*, opportunities!inner(project_id)')
        .eq('opportunities.project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data;
    },
    enabled: !!projectId
  });
}

export function useCreateOption(opportunityId, projectId) {
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
    onMutate: async (newOption) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      const previousOptions = queryClient.getQueryData(['all_project_options', projectId]);
      
      queryClient.setQueryData(['all_project_options', projectId], old => {
        const optimisticOption = { 
          id: `temp-${Date.now()}`, 
          opportunity_id: opportunityId, 
          title: 'New Contender', 
          cost_impact: 0,
          days_impact: 0,
          is_locked: false,
          include_in_budget: false,
          ...newOption 
        };
        return [...(old || []), optimisticOption];
      });

      return { previousOptions };
    },
    onError: (err, newOption, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => opt.id.toString().startsWith('temp-') ? data : opt);
      });
    }
  });
}

export function useUpdateOption(opportunityId, projectId) {
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
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      
      const previousOptions = queryClient.getQueryData(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData(['opportunities', projectId]);
      
      queryClient.setQueryData(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => opt.id === id ? { ...opt, ...updates } : opt);
      });

      // Bubble up edits to the parent opportunity if the edited option is locked or targeted
      const updatedOpt = previousOptions?.find(opt => opt.id === id);
      if (updatedOpt) {
        queryClient.setQueryData(['opportunities', projectId], old => {
          if (!old) return old;
          const { cost_impact, days_impact } = calculateParentTotals(opportunityId, previousOptions || [], updates, id);
          return old.map(opp => opp.id === opportunityId ? { ...opp, cost_impact, days_impact } : opp);
        });
      }

      return { previousOptions, previousOpportunities };
    },
    onError: (err, variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    }
  });
}

export function useDeleteOption(opportunityId, projectId) {
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
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      const previousOptions = queryClient.getQueryData(['all_project_options', projectId]);
      
      queryClient.setQueryData(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.filter(opt => opt.id !== id);
      });

      return { previousOptions };
    },
    onError: (err, id, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
    }
  });
}

export function useReorderOptions(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds) => {
      await Promise.all(orderedIds.map((id, index) => 
        supabase.from('opportunity_options').update({ order_index: index }).eq('id', id)
      ));
      return orderedIds;
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      const previousOptions = queryClient.getQueryData(['all_project_options', projectId]);
      
      queryClient.setQueryData(['all_project_options', projectId], old => {
        if (!old) return old;
        const newArray = [...old];
        return newArray.map(opt => ({
          ...opt,
          order_index: orderedIds.indexOf(opt.id) !== -1 ? orderedIds.indexOf(opt.id) : (opt.order_index || 0)
        }));
      });

      return { previousOptions };
    },
    onError: (err, variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
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
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });

      const previousOptions = queryClient.getQueryData(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData(['opportunities', projectId]);

      queryClient.setQueryData(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => 
          opt.opportunity_id === opportunityId 
            ? { ...opt, is_locked: opt.id === optionId }
            : opt
        );
      });

      return { previousOptions, previousOpportunities };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    },
    onError: (err, optionId, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
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
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });

      const previousOptions = queryClient.getQueryData(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData(['opportunities', projectId]);

      queryClient.setQueryData(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => opt.id === optionId ? { ...opt, include_in_budget: isIncluded } : opt);
      });

      return { previousOptions, previousOpportunities };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    },
    onError: (err, variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
    }
  });
}
