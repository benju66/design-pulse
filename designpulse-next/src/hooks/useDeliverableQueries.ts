import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { ProjectDeliverable } from '@/types/models';
import { getTodayLocalDate } from '@/lib/formatters';

export function useDeliverables(projectId: string | null) {
  return useQuery<ProjectDeliverable[], Error>({
    queryKey: ['deliverables', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_deliverables')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('due_date', { ascending: true })
        .order('display_id', { ascending: true })
        .order('id', { ascending: true });
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data as ProjectDeliverable[];
    },
    enabled: !!projectId
  });
}

export function useCreateDeliverable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ProjectDeliverable, Error, Partial<ProjectDeliverable>, { previousDeliverables: ProjectDeliverable[] | undefined }>({
    mutationFn: async (newRow) => {
      const realUUID = (newRow as Record<string, unknown>).id as string | undefined; // Minted on client
      const defaultDate = getTodayLocalDate();
      const { data, error } = await supabase
        .from('project_deliverables')
        .insert([{ 
          project_id: projectId, 
          status: 'Open', 
          title: 'New Deliverable',
          due_date: defaultDate,
          id: realUUID,
          is_elevated_key_date: false,
          is_deleted: false,
          ...newRow 
        }])
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ProjectDeliverable;
    },
    onMutate: async (newRow) => {
      await queryClient.cancelQueries({ queryKey: ['deliverables', projectId] });
      const previousDeliverables = queryClient.getQueryData<ProjectDeliverable[]>(['deliverables', projectId]);
      
      const realUUID = crypto.randomUUID();
      (newRow as Record<string, unknown>).id = realUUID;

      queryClient.setQueryData<ProjectDeliverable[]>(['deliverables', projectId], old => {
        const optimisticDeliverable: ProjectDeliverable = {
          id: realUUID,
          project_id: projectId,
          title: 'New Deliverable',
          display_id: 'Pending...',
          status: 'Open',
          description: null,
          assignee: null,
          permit_id: null,
          due_date: getTodayLocalDate(),
          is_elevated_key_date: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...newRow
        };
        return [...(old || []), optimisticDeliverable];
      });

      return { previousDeliverables };
    },
    onError: (err, _newRow, context) => {
      if (context?.previousDeliverables) {
        queryClient.setQueryData(['deliverables', projectId], context.previousDeliverables);
      }
      console.error('Create Deliverable Error:', err);
      toast.error(`Failed to add deliverable: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] });
    }
  });
}

export function useUpdateDeliverable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ProjectDeliverable, 
    Error, 
    { id: string; updates: Partial<ProjectDeliverable> },
    { previousDeliverables: ProjectDeliverable[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('project_deliverables')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ProjectDeliverable;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['deliverables', projectId] });
      const previousDeliverables = queryClient.getQueryData<ProjectDeliverable[]>(['deliverables', projectId]);
      
      queryClient.setQueryData<ProjectDeliverable[]>(['deliverables', projectId], old => {
        if (!old) return old;
        return old.map(d => d.id === id ? { ...d, ...updates } : d);
      });

      return { previousDeliverables };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDeliverables) {
        queryClient.setQueryData(['deliverables', projectId], context.previousDeliverables);
      }
      console.error('Update Deliverable Error:', err);
      toast.error(`Failed to update deliverable: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] });
    }
  });
}

export function useDeleteDeliverable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ProjectDeliverable, 
    Error, 
    string, // ID of deliverable
    { previousDeliverables: ProjectDeliverable[] | undefined }
  >({
    mutationFn: async (id) => {
      // Soft-delete integration: set is_deleted to true
      const { data, error } = await supabase
        .from('project_deliverables')
        .update({ is_deleted: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ProjectDeliverable;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['deliverables', projectId] });
      const previousDeliverables = queryClient.getQueryData<ProjectDeliverable[]>(['deliverables', projectId]);
      
      queryClient.setQueryData<ProjectDeliverable[]>(['deliverables', projectId], old => {
        if (!old) return old;
        return old.filter(d => d.id !== id);
      });

      return { previousDeliverables };
    },
    onError: (err, _id, context) => {
      if (context?.previousDeliverables) {
        queryClient.setQueryData(['deliverables', projectId], context.previousDeliverables);
      }
      console.error('Delete Deliverable Error:', err);
      toast.error(`Failed to delete deliverable: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] });
    }
  });
}
