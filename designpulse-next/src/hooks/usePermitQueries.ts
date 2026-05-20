import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { Permit, PermitTaskLink, PermitComment } from '@/types/models';

export function usePermits(projectId: string | null) {
  return useQuery<Permit[], Error>({
    queryKey: ['permits', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('permits')
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
      return data as Permit[];
    },
    enabled: !!projectId
  });
}

export function usePermitTaskLinks(projectId: string | null) {
  return useQuery<PermitTaskLink[], Error>({
    queryKey: ['permit_task_links', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      // We join with permits to only get links for the current project
      const { data, error } = await supabase
        .from('permit_task_links')
        .select('*, permits!inner(project_id)')
        .eq('permits.project_id', projectId);
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data as unknown as PermitTaskLink[];
    },
    enabled: !!projectId
  });
}

export function useCreatePermit(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Permit, Error, Partial<Permit>, { previousPermits: Permit[] | undefined }>({
    mutationFn: async (newRow) => {
      const realUUID = (newRow as Record<string, unknown>).id as string | undefined; // Minted on client
      const { data, error } = await supabase
        .from('permits')
        .insert([{ 
          project_id: projectId, 
          status: 'Preparing', 
          title: 'New Permit',
          id: realUUID,
          ...newRow 
        }])
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as Permit;
    },
    onMutate: async (newRow) => {
      await queryClient.cancelQueries({ queryKey: ['permits', projectId] });
      const previousPermits = queryClient.getQueryData<Permit[]>(['permits', projectId]);
      
      const realUUID = crypto.randomUUID();
      (newRow as Record<string, unknown>).id = realUUID;

      queryClient.setQueryData<Permit[]>(['permits', projectId], old => {
        const optimisticPermit: Permit = {
          id: realUUID,
          project_id: projectId,
          title: 'New Permit',
          display_id: 'Pending...',
          status: 'Preparing',
          description: null,
          permit_type: null,
          ahj: null,
          assignee: null,
          date_submitted: null,
          target_approval_date: null,
          revision_number: 0,
          revision_history: [],
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...newRow
        };
        return [optimisticPermit, ...(old || [])];
      });

      return { previousPermits };
    },
    onError: (err, _newRow, context) => {
      if (context?.previousPermits) {
        queryClient.setQueryData(['permits', projectId], context.previousPermits);
      }
      console.error('Create Permit Error:', err);
      toast.error(`Failed to add permit: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits', projectId] });
    }
  });
}

export function useUpdatePermit(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Permit, 
    Error, 
    { id: string; updates: Partial<Permit> },
    { previousPermits: Permit[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('permits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as Permit;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['permits', projectId] });
      const previousPermits = queryClient.getQueryData<Permit[]>(['permits', projectId]);
      
      queryClient.setQueryData<Permit[]>(['permits', projectId], old => {
        if (!old) return old;
        return old.map(p => p.id === id ? { ...p, ...updates } : p);
      });

      return { previousPermits };
    },
    onError: (err, _variables, context) => {
      if (context?.previousPermits) {
        queryClient.setQueryData(['permits', projectId], context.previousPermits);
      }
      console.error('Update Permit Error:', err);
      toast.error(`Failed to update permit: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits', projectId] });
    }
  });
}

export function useDeletePermit(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    string, 
    Error, 
    string, 
    { previousPermits: Permit[] | undefined }
  >({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('permits')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['permits', projectId] });
      const previousPermits = queryClient.getQueryData<Permit[]>(['permits', projectId]);

      queryClient.setQueryData<Permit[]>(['permits', projectId], old => {
        if (!old) return old;
        return old.filter(p => p.id !== id);
      });

      return { previousPermits };
    },
    onSuccess: () => {
      toast.success('Permit deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['permits', projectId] });
    },
    onError: (err, _id, context) => {
      if (context?.previousPermits) {
        queryClient.setQueryData(['permits', projectId], context.previousPermits);
      }
      console.error('Delete Permit Error:', err);
      toast.error(`Failed to delete: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useLogPermitActivity(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    unknown, 
    Error, 
    { permitId: string; eventType: 'submission' | 'status_change'; note: string; newStatus?: string },
    { previousPermits: Permit[] | undefined }
  >({
    mutationFn: async ({ permitId, eventType, note, newStatus }) => {
      const { data, error } = await supabase.rpc('log_permit_activity', {
        p_permit_id: permitId,
        p_event_type: eventType,
        p_note: note,
        p_new_status: newStatus || null
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data;
    },
    onMutate: async ({ permitId, eventType, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['permits', projectId] });
      const previousPermits = queryClient.getQueryData<Permit[]>(['permits', projectId]);
      
      queryClient.setQueryData<Permit[]>(['permits', projectId], old => {
        if (!old) return old;
        return old.map(p => {
          if (p.id === permitId) {
            return {
              ...p,
              revision_number: eventType === 'submission' ? (p.revision_number || 0) + 1 : p.revision_number,
              status: eventType === 'submission' ? 'Submitted' : (newStatus || p.status)
            };
          }
          return p;
        });
      });

      return { previousPermits };
    },
    onError: (err, _variables, context) => {
      if (context?.previousPermits) {
        queryClient.setQueryData(['permits', projectId], context.previousPermits);
      }
      console.error('Log Permit Activity Error:', err);
      toast.error(`Failed to log activity: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits', projectId] });
    }
  });
}

export function useUpdatePermitStatusWithLog(projectId: string) {
  const logActivity = useLogPermitActivity(projectId);
  return (permitId: string, newStatus: string) => {
    logActivity.mutate({
      permitId,
      eventType: 'status_change',
      note: `System: Status changed to ${newStatus}`,
      newStatus
    });
  };
}

export function useLinkPermitTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { permitId: string; taskId: string }
  >({
    mutationFn: async ({ permitId, taskId }) => {
      const { error } = await supabase
        .from('permit_task_links')
        .insert([{ permit_id: permitId, coordination_task_id: taskId }]);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permit_task_links', projectId] });
      // Spread the parent row caching
      queryClient.invalidateQueries({ queryKey: ['permits', projectId] });
    },
    onError: (err) => {
      toast.error(`Failed to link task: ${err.message}`);
    }
  });
}

export function useUnlinkPermitTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { permitId: string; taskId: string }
  >({
    mutationFn: async ({ permitId, taskId }) => {
      const { error } = await supabase
        .from('permit_task_links')
        .delete()
        .match({ permit_id: permitId, coordination_task_id: taskId });
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permit_task_links', projectId] });
      queryClient.invalidateQueries({ queryKey: ['permits', projectId] });
    },
    onError: (err) => {
      toast.error(`Failed to unlink task: ${err.message}`);
    }
  });
}

export function usePermitComments(projectId: string | null) {
  return useQuery<PermitComment[], Error>({
    queryKey: ['permit_comments', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('permit_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) {
        console.warn("Supabase Error:", error);
        return [];
      }
      return data as PermitComment[];
    },
    enabled: !!projectId
  });
}

export function useCreatePermitComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<PermitComment, Error, Partial<PermitComment>>({
    mutationFn: async (newRow) => {
      const { data, error } = await supabase
        .from('permit_comments')
        .insert([{ ...newRow, project_id: projectId }])
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as PermitComment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permit_comments', projectId] });
    },
    onError: (err) => {
      console.error('Create Permit Comment Error:', err);
      toast.error(`Failed to add comment: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useUpdatePermitComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<PermitComment, Error, { id: string; updates: Partial<PermitComment> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('permit_comments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as PermitComment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permit_comments', projectId] });
    },
    onError: (err) => {
      console.error('Update Permit Comment Error:', err);
      toast.error(`Failed to update comment: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useDeletePermitComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('permit_comments')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permit_comments', projectId] });
    },
    onError: (err) => {
      console.error('Delete Permit Comment Error:', err);
      toast.error(`Failed to delete comment: ${err.message || 'Unknown error'}`);
    }
  });
}
