import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { ProjectKeyDate } from '@/types/models';
import { getTodayLocalDate } from '@/lib/formatters';

export function useKeyDates(projectId: string | null) {
  return useQuery<ProjectKeyDate[], Error>({
    queryKey: ['key-dates', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_key_dates')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('event_date', { ascending: true })
        .order('display_id', { ascending: true })
        .order('id', { ascending: true });
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data as ProjectKeyDate[];
    },
    enabled: !!projectId
  });
}

export function useCreateKeyDate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ProjectKeyDate, Error, Partial<ProjectKeyDate>, { previousKeyDates: ProjectKeyDate[] | undefined }>({
    mutationFn: async (newRow) => {
      const realUUID = (newRow as Record<string, unknown>).id as string | undefined; // Minted on client
      const defaultDate = getTodayLocalDate();
      const { data, error } = await supabase
        .from('project_key_dates')
        .insert([{ 
          project_id: projectId, 
          title: 'New Key Date',
          event_date: defaultDate,
          id: realUUID,
          is_deleted: false,
          ...newRow 
        }])
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ProjectKeyDate;
    },
    onMutate: async (newRow) => {
      await queryClient.cancelQueries({ queryKey: ['key-dates', projectId] });
      const previousKeyDates = queryClient.getQueryData<ProjectKeyDate[]>(['key-dates', projectId]);
      
      const realUUID = crypto.randomUUID();
      (newRow as Record<string, unknown>).id = realUUID;

      queryClient.setQueryData<ProjectKeyDate[]>(['key-dates', projectId], old => {
        const optimisticKeyDate: ProjectKeyDate = {
          id: realUUID,
          project_id: projectId,
          title: 'New Key Date',
          display_id: 'Pending...',
          description: null,
          event_date: getTodayLocalDate(),
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...newRow
        };
        return [...(old || []), optimisticKeyDate];
      });

      return { previousKeyDates };
    },
    onError: (err, _newRow, context) => {
      if (context?.previousKeyDates) {
        queryClient.setQueryData(['key-dates', projectId], context.previousKeyDates);
      }
      console.error('Create Key Date Error:', err);
      toast.error(`Failed to add key date: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-dates', projectId] });
    }
  });
}

export function useUpdateKeyDate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ProjectKeyDate, 
    Error, 
    { id: string; updates: Partial<ProjectKeyDate> },
    { previousKeyDates: ProjectKeyDate[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('project_key_dates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ProjectKeyDate;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['key-dates', projectId] });
      const previousKeyDates = queryClient.getQueryData<ProjectKeyDate[]>(['key-dates', projectId]);
      
      queryClient.setQueryData<ProjectKeyDate[]>(['key-dates', projectId], old => {
        if (!old) return old;
        return old.map(d => d.id === id ? { ...d, ...updates } : d);
      });

      return { previousKeyDates };
    },
    onError: (err, _variables, context) => {
      if (context?.previousKeyDates) {
        queryClient.setQueryData(['key-dates', projectId], context.previousKeyDates);
      }
      console.error('Update Key Date Error:', err);
      toast.error(`Failed to update key date: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-dates', projectId] });
    }
  });
}

export function useDeleteKeyDate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ProjectKeyDate, 
    Error, 
    string, // ID of key date
    { previousKeyDates: ProjectKeyDate[] | undefined }
  >({
    mutationFn: async (id) => {
      // Soft-delete integration: set is_deleted to true
      const { data, error } = await supabase
        .from('project_key_dates')
        .update({ is_deleted: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ProjectKeyDate;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['key-dates', projectId] });
      const previousKeyDates = queryClient.getQueryData<ProjectKeyDate[]>(['key-dates', projectId]);
      
      queryClient.setQueryData<ProjectKeyDate[]>(['key-dates', projectId], old => {
        if (!old) return old;
        return old.filter(d => d.id !== id);
      });

      return { previousKeyDates };
    },
    onError: (err, _id, context) => {
      if (context?.previousKeyDates) {
        queryClient.setQueryData(['key-dates', projectId], context.previousKeyDates);
      }
      console.error('Delete Key Date Error:', err);
      toast.error(`Failed to delete key date: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-dates', projectId] });
    }
  });
}
