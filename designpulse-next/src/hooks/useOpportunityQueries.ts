import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { calculateParentTotals } from '@/utils/financialMath';
import { toast } from 'sonner';
import { Opportunity, OpportunityOption, CoordinationDetailsMap } from '@/types/models';

export function useOpportunities(projectId: string | null) {
  return useQuery<Opportunity[], Error>({
    queryKey: ['opportunities', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .order('display_id', { ascending: false })
        .order('id', { ascending: true });
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

export function useCreateOpportunity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Opportunity, Error, Partial<Opportunity>>({
    mutationFn: async (newRow) => {
      const { data, error } = await supabase
        .from('opportunities')
        .insert([{ project_id: projectId, status: 'Draft', cost_impact: 0, title: 'New Option', building_area: null, coordination_status: null, ...newRow }])
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
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
      if (error) throw new Error(error.message || JSON.stringify(error));
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
    onError: (err, _variables, context) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      console.error('Update Opportunity Error:', err);
      toast.error(`Failed to update opportunity: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
    }
  });
}

export function useDeleteOpportunity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    string, 
    Error, 
    string, 
    { previousOpportunities: Opportunity[] | undefined; previousOptions: OpportunityOption[] | undefined }
  >({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('opportunities')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw new Error(error.message || JSON.stringify(error));
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });

      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);

      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.filter(opp => opp.id !== id);
      });

      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.filter(opt => opt.opportunity_id !== id);
      });

      return { previousOpportunities, previousOptions };
    },
    onSuccess: () => {
      toast.success('Item deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
    },
    onError: (err, _id, context) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      console.error('Delete Opportunity Error:', err);
      toast.error(`Failed to delete: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useUpdateCoordinationDetails(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Opportunity, 
    Error, 
    { id: string; updates: Record<string, any> },
    { previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase.rpc('update_coordination_details_delta', {
        p_opp_id: id,
        p_updates: updates
      }).single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as Opportunity;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);
      
      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => {
          if (opp.id === id) {
             const currentDetails = (opp.coordination_details as Record<string, any>) || {};
             let newDetails = { ...currentDetails };
             for (const [key, value] of Object.entries(updates)) {
               if (key.startsWith('d_')) {
                 newDetails[key] = { ...(newDetails[key] || {}), ...(value as Record<string,any>) };
               } else {
                 newDetails[key] = value;
               }
             }
             return { ...opp, coordination_details: newDetails };
          }
          return opp;
        });
      });

      return { previousOpportunities };
    },
    onError: (err, _variables, context) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      console.error('Update Coordination Details Error:', err);
      toast.error(`Failed to update coordination details: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useDeEscalateOpportunity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { id: string },
    { previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc('de_escalate_opportunity', {
        p_opp_id: id   // string UUID — never undefined (AGENTS.md C11)
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onMutate: async ({ id }) => {
      // Cancel in-flight refetches so they don't overwrite the optimistic update (AGENTS.md C2)
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });

      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(
        ['opportunities', projectId]
      );

      // Optimistic update: reflect de-escalation instantly (AGENTS.md C9 — spread parent row)
      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => {
          if (opp.id !== id) return opp;
          const coordDetails = (opp.coordination_details as Record<string, unknown>) ?? {};
          const { is_escalated: _stripped, ...cleanDetails } = coordDetails;
          return {
            ...opp,  // always spread parent (AGENTS.md C9)
            cost_impact: 0,
            days_impact: 0,
            status: 'Draft',
            final_direction: null,
            coordination_details: cleanDetails,
          } as Opportunity;
        });
      });

      return { previousOpportunities };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(
          ['opportunities', projectId],
          context.previousOpportunities
        );
      }
      toast.error('Failed to remove from Value Matrix. Please try again.');
    },
    onSuccess: () => {
      // Hard refetch both tables — RPC mutated opportunity_options (is_locked)
      // AND opportunities. Both caches are now stale. (AGENTS.md C2)
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
    },
  });
}

export function useAllProjectOptions(projectId: string | null) {
  return useQuery<OpportunityOption[], Error>({
    queryKey: ['all_project_options', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('opportunity_options')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data as unknown as OpportunityOption[];
    },
    enabled: !!projectId
  });
}

export function useCreateOption(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    OpportunityOption, 
    Error, 
    { opportunityId: string; option: Partial<OpportunityOption> }, 
    { previousOptions: OpportunityOption[] | undefined }
  >({
    mutationFn: async ({ opportunityId, option }) => {
      const realUUID = (option as any).id; // ID generated in onMutate
      const { data, error } = await supabase
        .from('opportunity_options')
        .insert([{ 
          opportunity_id: opportunityId, 
          project_id: projectId,
          title: 'New Contender', 
          ...option, 
          id: realUUID 
        }])
        .select()
        .single();
      if (error) throw error;
      return data as OpportunityOption;
    },
    onMutate: async ({ opportunityId, option: newOption }) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      
      const realUUID = crypto.randomUUID();
      (newOption as any).id = realUUID;

      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        const optimisticOption: OpportunityOption = { 
          id: realUUID, 
          opportunity_id: opportunityId, 
          title: 'New Contender', 
          cost_impact: 0,
          days_impact: 0,
          is_locked: false,
          include_in_budget: false,
          description: null,
          category: null,
          order_index: 0,
          ...newOption,
          created_at: newOption.created_at ?? new Date().toISOString(),
          updated_at: newOption.updated_at ?? new Date().toISOString()
        };
        return [...(old || []), optimisticOption];
      });

      // Optimistically update the parent row cache to force structural sharing change
      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => opp.id === opportunityId ? { ...opp } : opp);
      });

      return { previousOptions };
    },
    onError: (err, _newOption, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      toast.error(`Failed to create option: ${err.message || 'Unknown error'}`);
    },
    onSuccess: (_, variables) => {
      // Explicitly invalidate the activity feed here because its Realtime subscription
      // only exists when the Activity tab is mounted. If the user is on the Details tab
      // when the option is created, the DB trigger fires and inserts into item_activity,
      // but no subscriber is listening — the event is silently missed. (AGENTS.md Rule C.2)
      queryClient.invalidateQueries({ queryKey: ['activity_feed', variables.opportunityId] });
    }
  });
}

export function useUpdateOption(projectId: string) {
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
          const { cost_impact, days_impact } = calculateParentTotals(updatedOpt.opportunity_id, previousOptions || [], updates, id);
          return old.map(opp => opp.id === updatedOpt.opportunity_id ? { ...opp, cost_impact, days_impact } : opp);
        });
      }

      return { previousOptions, previousOpportunities };
    },
    onError: (err, _variables, context) => {
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
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
    }
  });
}

export function useDeleteOption(opportunityId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    string, 
    Error, 
    string, 
    { previousOptions: OpportunityOption[] | undefined; previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('opportunity_options')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);
      
      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.filter(opt => opt.id !== id);
      });

      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => opp.id === opportunityId ? { ...opp } : opp);
      });

      return { previousOptions, previousOpportunities };
    },
    onError: (err, _id, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      toast.error(`Failed to delete option: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      // Confirm the soft-delete is reflected in the cache and propagate the DB trigger
      // activity log entry ("Option X was deleted") to the activity feed. (AGENTS.md Rule C.2)
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activity_feed', opportunityId] });
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
      const payload = orderedIds.map((id, index) => ({ id, order_index: index }));
      const { error } = await supabase.rpc('reorder_opportunity_options', {
        p_project_id: projectId,
        p_payload: payload
      });
      if (error) throw error;
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
    onError: (err, _variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      toast.error(`Failed to reorder options: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
    }
  });
}

export function useUpdateOptionRequirements(projectId: string, opportunityId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    OpportunityOption, 
    Error, 
    { id: string; updates: Record<string, { required?: boolean; notes?: string }> }, 
    { previousOptions: OpportunityOption[] | undefined; previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase.rpc('update_option_requirements_delta', {
        p_option_id: id,
        p_updates: updates
      }).single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as OpportunityOption;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      
      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);
      
      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => {
          if (opt.id === id) {
            const currentReqs = (opt.coordination_requirements as Record<string, { required: boolean; notes?: string }>) || {};
            let newReqs = { ...currentReqs };
            for (const [key, value] of Object.entries(updates)) {
              newReqs[key] = { ...(newReqs[key] || {}), ...(value as Record<string, any>) } as { required: boolean; notes?: string };
            }
            return { ...opt, coordination_requirements: newReqs };
          }
          return opt;
        });
      });

      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => opp.id === opportunityId ? { ...opp } : opp);
      });

      return { previousOptions, previousOpportunities };
    },
    onError: (err, _variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      console.error('Update Option Requirements Error:', err);
      toast.error(`Failed to update requirements: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
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

      const optionToLock = previousOptions?.find(o => o.id === optionId);

      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => 
          opt.opportunity_id === opportunityId 
            ? { ...opt, is_locked: opt.id === optionId }
            : opt
        );
      });

      if (optionToLock) {
        queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
          if (!old) return old;
          return old.map(opp => {
            if (opp.id === opportunityId) {
              const reqs = (optionToLock.coordination_requirements as Record<string, { required: boolean; notes?: string }>) || {};

              if (optionToLock.requires_coordination !== false) {
                // Merge: keep existing progress, add new disciplines only
                const existingDetails: CoordinationDetailsMap = (opp.coordination_details as CoordinationDetailsMap) || {};
                const mergedDetails: CoordinationDetailsMap = { ...existingDetails };

                for (const [k, v] of Object.entries(reqs)) {
                  if (v.required && !(k in mergedDetails)) {
                    mergedDetails[k] = { status: 'Pending', notes: v.notes || '' };
                  }
                }

                return {
                  ...opp,
                  status: 'Approved',
                  coordination_status: 'Pending Plan Update',
                  final_direction: `Locked: ${optionToLock.title}`,
                  cost_impact: optionToLock.cost_impact,
                  days_impact: optionToLock.days_impact,
                  coordination_details: mergedDetails
                } as Opportunity;
              } else {
                // requires_coordination = false: clear coordination_details (edge case)
                return {
                  ...opp,
                  status: 'Approved',
                  coordination_status: 'Not Required',
                  final_direction: `Locked: ${optionToLock.title}`,
                  cost_impact: optionToLock.cost_impact,
                  days_impact: optionToLock.days_impact,
                  coordination_details: {} as CoordinationDetailsMap
                } as Opportunity;
              }
            }
            return opp;
          });
        });
      }

      return { previousOptions, previousOpportunities };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
      queryClient.invalidateQueries({ queryKey: ['pending_estimate_updates', projectId] });
    },
    onError: (err, _optionId, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      toast.error(`Failed to lock option: ${err.message || 'Unknown error'}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
    },
  });
}

export function useUnlockOpportunityOption(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void, 
    Error, 
    string, 
    { previousOptions: OpportunityOption[] | undefined; previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async (oppId: string) => {
      const { error } = await supabase.rpc('unlock_opportunity_option', { p_opp_id: oppId });
      if (error) throw error;
    },
    onMutate: async (oppId) => {
      await queryClient.cancelQueries({ queryKey: ['all_project_options', projectId] });
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });

      const previousOptions = queryClient.getQueryData<OpportunityOption[]>(['all_project_options', projectId]);
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);

      queryClient.setQueryData<OpportunityOption[]>(['all_project_options', projectId], old => {
        if (!old) return old;
        return old.map(opt => opt.opportunity_id === oppId ? { ...opt, is_locked: false } : opt);
      });

      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => {
          if (opp.id === oppId) {
            const details = opp.coordination_details as Record<string, unknown> | null;
            const hasCoordProgress = details !== null && typeof details === 'object' && Object.keys(details).length > 0;
            return {
              ...opp,
              status: 'Draft',
              final_direction: null,
              coordination_status: hasCoordProgress ? 'Draft' : 'Not Required'
              // coordination_details intentionally untouched — preserves discipline progress
            };
          }
          return opp;
        });
      });

      return { previousOptions, previousOpportunities };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
      toast.success('Option unlocked successfully');
    },
    onError: (err, _oppId, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['all_project_options', projectId], context.previousOptions);
      }
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      toast.error(`Failed to unlock option: ${err.message || 'Unknown error'}`);
    }
  });
}

// Analytics Phase 4 Hooks

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

      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => opp.id === opportunityId ? { ...opp } : opp);
      });

      return { previousOptions, previousOpportunities };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
    },
    onError: (err, _variables, context) => {
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

export function useBulkImportCoordinationTasks(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: any[]) => {
      // Chunk tasks into groups of 100 to avoid payload size limits
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < tasks.length; i += chunkSize) {
        chunks.push(tasks.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const { error } = await supabase.rpc('bulk_import_coordination_tasks', {
          p_project_id: projectId,
          p_payload: chunk,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      toast.success('Tasks imported successfully.');
    },
    onError: (err: any) => {
      console.error('Bulk Import Error JSON:', JSON.stringify(err, null, 2));
      console.error('Bulk Import Error Raw:', err);
      toast.error(`Import failed: ${err.message || JSON.stringify(err)}`);
    },
  });
}




// -- Master Budget Ledger: Financial Lifecycle Hooks --------------------------

// Queries items marked for the Estimator's Inbox
export function usePendingEstimateUpdates(projectId: string | null) {
  return useQuery<Opportunity[], Error>({
    queryKey: ['pending_estimate_updates', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*, opportunity_options(*)')
        .eq('project_id', projectId!)
        .eq('estimate_sync_status', 'Pending Estimate Update')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Opportunity[];
    },
  });
}

// Reconciles and incorporates a VE item into an active budget version
export function useReconcileOpportunity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { opportunityId: string; versionId: string; realizedCost: number; note: string }
  >({
    mutationFn: async ({ opportunityId, versionId, realizedCost, note }) => {
      const { error } = await supabase.rpc('reconcile_and_incorporate_opportunity', {
        p_opp_id: opportunityId,
        p_version_id: versionId,
        p_realized_cost: realizedCost,
        p_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['pending_estimate_updates', projectId] });
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
    },
    onError: (err) => {
      console.error('Reconciliation Error:', err);
      toast.error(`Failed to reconcile opportunity: ${err.message}`);
    },
  });
}
export function useReturnOpportunity(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { opportunityId: string; revisedCost: number; note: string }>({
    mutationFn: async ({ opportunityId, revisedCost, note }) => {
      const { error } = await supabase.rpc('return_opportunity_to_design', {
        p_opp_id: opportunityId,
        p_revised_cost: revisedCost,
        p_note: note
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
      queryClient.invalidateQueries({ queryKey: ['pending_estimate_updates', projectId] });
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
    },
    onError: (err) => {
      console.error('Return Opportunity Error:', err);
      toast.error(`Failed to return opportunity: ${err.message || 'Unknown error'}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
    },
  });
}

export function useBulkUpdateCoordinationStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { ids: string[]; newStatus: string },
    { previousOpportunities: Opportunity[] | undefined }
  >({
    mutationFn: async ({ ids, newStatus }) => {
      const { error } = await supabase
        .from('opportunities')
        .update({ coordination_status: newStatus })
        .in('id', ids);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onMutate: async ({ ids, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['opportunities', projectId] });
      const previousOpportunities = queryClient.getQueryData<Opportunity[]>(['opportunities', projectId]);
      
      queryClient.setQueryData<Opportunity[]>(['opportunities', projectId], old => {
        if (!old) return old;
        return old.map(opp => 
          ids.includes(opp.id) 
            ? { ...opp, coordination_status: newStatus } 
            : opp
        );
      });

      return { previousOpportunities };
    },
    onError: (err, _variables, context) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities', projectId], context.previousOpportunities);
      }
      console.error('Bulk Update Status Error:', err);
      toast.error(`Failed to bulk update status: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
    }
  });
}

