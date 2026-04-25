import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { DEFAULT_CATEGORIES, DEFAULT_SIDEBAR_ITEMS, DEFAULT_SCOPES } from '@/lib/constants';
import { calculateParentTotals } from '@/utils/financialMath';
import { toast } from 'sonner';
import { Opportunity, OpportunityOption, ProjectSettings, Project } from '@/types/models';

export function useProjectSettings(projectId: string | null) {
  return useQuery<ProjectSettings, Error>({
    queryKey: ['project_settings', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No Project ID");
      const { data, error } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_id', projectId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is not found, which is fine for new projects
        console.warn("Supabase Error:", error);
      }
      
      const defaultSettings: Partial<ProjectSettings> = {
        categories: DEFAULT_CATEGORIES as unknown as any, 
        scopes: DEFAULT_SCOPES as unknown as any,
        sidebar_items: DEFAULT_SIDEBAR_ITEMS as unknown as any,
        project_name: projectId,
        location: 'Not Set',
        original_budget: 0,
        enable_audit_logging: false
      };

      if (!data) return defaultSettings as ProjectSettings;

      return {
        ...data,
        categories: (data.categories as any[])?.length > 0 ? data.categories : defaultSettings.categories,
        scopes: (data.scopes as any[])?.length > 0 ? data.scopes : defaultSettings.scopes,
        sidebar_items: (data.sidebar_items as any[])?.length > 0 ? data.sidebar_items : defaultSettings.sidebar_items,
        project_name: data.project_name || defaultSettings.project_name,
        location: data.location || defaultSettings.location,
        original_budget: data.original_budget ?? defaultSettings.original_budget,
        enable_audit_logging: data.enable_audit_logging ?? defaultSettings.enable_audit_logging
      } as ProjectSettings;
    },
    enabled: !!projectId
  });
}

export function useUpdateProjectSettings(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ProjectSettings, Error, Partial<ProjectSettings>>({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('project_settings')
        .upsert({ project_id: projectId, ...updates })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_settings', projectId] });
    },
    onError: (err) => {
      console.error('Update Project Settings Error:', err);
      toast.error(`Failed to update settings: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useOpportunities(projectId: string | null) {
  return useQuery<Opportunity[], Error>({
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
      return data as Opportunity[];
    },
    enabled: !!projectId
  });
}

export function useOpportunity(opportunityId: string | null) {
  return useQuery<Opportunity | null, Error>({
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
      return data as Opportunity;
    },
    enabled: !!opportunityId
  });
}

export function useUpdateOpportunity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Opportunity, 
    Error, 
    { id: string; updates: Partial<Opportunity> },
    { previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('opportunities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Opportunity;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);
      
      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => opp.id === id ? { ...opp, ...updates } : opp);
      });

      return { previousOpportunities };
    },
    onError: (err, variables, context) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      console.error('Update Opportunity Error:', err);
      toast.error(`Failed to update opportunity: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useCreateOpportunity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Opportunity, Error, Partial<Opportunity>>({
    mutationFn: async (newRow) => {
      const { data, error } = await supabase
        .from('opportunities')
        .insert([{ project_id: projectId, status: 'Draft', cost_impact: 0, title: 'New Option', scope: 'General', ...newRow }])
        .select()
        .single();
      if (error) throw error;
      return data as Opportunity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    },
    onError: (err) => {
      console.error('Create Opportunity Error:', err);
      toast.error(`Failed to add: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useDeleteOpportunity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast.success('Item deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    },
    onError: (err) => {
      console.error('Delete Opportunity Error:', err);
      toast.error(`Failed to delete: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useProjects() {
  return useQuery<Project[], Error>({
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
      return data as Project[];
    }
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation<Project, Error, Partial<Project>>({
    mutationFn: async (newProject) => {
      const { data, error } = await supabase
        .from('projects')
        .insert([newProject])
        .select()
        .single();
        
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      console.error('Create Project Error:', err);
      toast.error(`Failed to create project: ${err.message}`);
    }
  });
}

export function useAllProjectOptions(projectId: string | null) {
  return useQuery<OpportunityOption[], Error>({
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
      return data as unknown as OpportunityOption[];
    },
    enabled: !!projectId
  });
}

export function useCreateOption(opportunityId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    OpportunityOption, 
    Error, 
    Partial<OpportunityOption>, 
    { previousOptions: OpportunityOption[] | undefined }
  >({
    mutationFn: async (newOption) => {
      const { data, error } = await supabase
        .from('opportunity_options')
        .insert([{ opportunity_id: opportunityId, title: 'New Contender', ...newOption }])
        .select()
        .single();
      if (error) throw error;
      return data as OpportunityOption;
    },
    onMutate: async (newOption) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      
      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        const optimisticOption: OpportunityOption = { 
          id: `temp-${Date.now()}`, 
          opportunity_id: opportunityId, 
          title: 'New Contender', 
          cost_impact: 0,
          days_impact: 0,
          is_locked: false,
          include_in_budget: false,
          description: null,
          category: null,
          order_index: 0,
          created_at: new Date().toISOString(),
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
      toast.error(`Failed to create option: ${err.message || 'Unknown error'}`);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => opt.id.toString().startsWith('temp-') ? data : opt);
      });
    }
  });
}

export function useUpdateOption(opportunityId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    OpportunityOption, 
    Error, 
    { id: string; updates: Partial<OpportunityOption> }, 
    { previousOptions: OpportunityOption[] | undefined; previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('opportunity_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as OpportunityOption;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);
      
      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => opt.id === id ? { ...opt, ...updates } : opt);
      });

      // Bubble up edits to the parent opportunity if the edited option is locked or targeted
      const updatedOpt = previousOptions?.find(opt => opt.id === id);
      if (updatedOpt) {
        queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
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
      toast.error(`Failed to update option: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    }
  });
}

export function useDeleteOption(opportunityId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    string, 
    Error, 
    string, 
    { previousOptions: OpportunityOption[] | undefined }
  >({
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
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      
      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.filter(opt => opt.id !== id);
      });

      return { previousOptions };
    },
    onError: (err, id, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      toast.error(`Failed to delete option: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useReorderOptions(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    string[], 
    Error, 
    string[], 
    { previousOptions: OpportunityOption[] | undefined }
  >({
    mutationFn: async (orderedIds) => {
      await Promise.all(orderedIds.map((id, index) => 
        supabase.from('opportunity_options').update({ order_index: index }).eq('id', id)
      ));
      return orderedIds;
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      
      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
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
      toast.error(`Failed to reorder options: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useLockOption(opportunityId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    unknown, 
    Error, 
    string, 
    { previousOptions: OpportunityOption[] | undefined; previousOpportunities: Opportunity[] | undefined }
  >({
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

      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);

      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
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
      toast.error(`Failed to lock option: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useToggleOptionBudget(opportunityId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    unknown, 
    Error, 
    { optionId: string; isIncluded: boolean }, 
    { previousOptions: OpportunityOption[] | undefined; previousOpportunities: Opportunity[] | undefined }
  >({
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

      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);

      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
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
      toast.error(`Failed to toggle budget inclusion: ${err.message || 'Unknown error'}`);
    }
  });
}
