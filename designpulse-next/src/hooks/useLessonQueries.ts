import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { ProjectLesson, LessonAttachment, LessonOpportunityLink, LessonIndicator, DashboardLesson } from '@/types/models';
import { toast } from 'sonner';

// Cross-project lessons rollup for the main dashboard (via get_lessons_dashboard RPC).
// Lazy: pass enabled=false until the Lessons tab is active to avoid an upfront fetch.
export function useGlobalLessons(enabled = true) {
  return useQuery({
    queryKey: ['lessons_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_lessons_dashboard');
      if (error) throw new Error(error.message);
      return data as DashboardLesson[];
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useLessons(projectId: string) {
  return useQuery({
    queryKey: ['lessons', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_lessons')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data as ProjectLesson[];
    },
    enabled: !!projectId,
  });
}

export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (error) throw new Error(error.message);
      return data as ProjectLesson;
    },
    enabled: !!lessonId,
  });
}

export function useCreateLesson(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newLesson: Partial<ProjectLesson>) => {
      const id = newLesson.id || crypto.randomUUID();
      const { data, error } = await supabase
        .from('project_lessons')
        .insert([{
          ...newLesson,
          id,
          project_id: projectId,
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as ProjectLesson;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['lesson', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['lessons', projectId] });
    },
    onError: (err) => {
      toast.error(`Failed to create lesson: ${err.message}`);
    }
  });
}

export function useUpdateLesson(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<ProjectLesson> & { id: string }) => {
      const { id, ...rest } = updates;
      const { data, error } = await supabase
        .from('project_lessons')
        .update({
          ...rest,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as ProjectLesson;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['lesson', updates.id] });
      const previousLesson = queryClient.getQueryData(['lesson', updates.id]);

      queryClient.setQueryData(['lesson', updates.id], (old: any) => ({
        ...old,
        ...updates,
      }));

      return { previousLesson };
    },
    onError: (err, updates, context: any) => {
      if (context?.previousLesson) {
        queryClient.setQueryData(['lesson', updates.id], context.previousLesson);
      }
      toast.error(`Failed to update lesson: ${err.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons', projectId] });
    }
  });
}

export function useUpdateLessonStatus(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProjectLesson['status'] }) => {
      // Use the SECURITY DEFINER RPC to bypass immutability safely
      const { error } = await supabase.rpc('update_lesson_status', {
        p_lesson_id: id,
        p_status: status
      });

      if (error) throw new Error(error.message);
      
      // Fetch the updated record since RPC doesn't return it
      const { data: updatedData, error: fetchError } = await supabase
        .from('project_lessons')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError) throw new Error(fetchError.message);
      return updatedData as ProjectLesson;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['lesson', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['lessons', projectId] });
    },
    onError: (err) => {
      toast.error(`Failed to update status: ${err.message}`);
    }
  });
}

export function useDeleteLesson(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase
        .from('project_lessons')
        .update({ is_deleted: true })
        .eq('id', lessonId);

      if (error) throw new Error(error.message);
      return lessonId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons', projectId] });
      toast.success('Lesson deleted');
    },
    onError: (err) => {
      toast.error(`Failed to delete lesson: ${err.message}`);
    }
  });
}

export function useLessonAttachments(lessonId: string) {
  return useQuery({
    queryKey: ['lesson_attachments', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_attachments')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data as LessonAttachment[];
    },
    enabled: !!lessonId,
  });
}

export function useUploadLessonAttachment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, file }: { lessonId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${projectId}/${lessonId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lesson_attachments')
        .upload(filePath, file);

      if (uploadError) throw new Error(uploadError.message);

      const { data, error: dbError } = await supabase
        .from('lesson_attachments')
        .insert([{
          lesson_id: lessonId,
          project_id: projectId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
        }])
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);
      return data as LessonAttachment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson_attachments', data.lesson_id] });
    },
    onError: (err) => {
      toast.error(`Failed to upload attachment: ${err.message}`);
    }
  });
}

export function useDeleteLessonAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attachmentId, filePath, lessonId }: { attachmentId: string; filePath: string; lessonId: string }) => {
      const { error: storageError } = await supabase.storage
        .from('lesson_attachments')
        .remove([filePath]);

      if (storageError) throw new Error(storageError.message);

      const { error: dbError } = await supabase
        .from('lesson_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw new Error(dbError.message);
      return { attachmentId, lessonId };
    },
    onSuccess: ({ lessonId }) => {
      queryClient.invalidateQueries({ queryKey: ['lesson_attachments', lessonId] });
    },
    onError: (err) => {
      toast.error(`Failed to delete attachment: ${err.message}`);
    }
  });
}

export function useLessonOpportunityLinks(lessonId: string) {
  return useQuery({
    queryKey: ['lesson_links', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_opportunity_links')
        .select('*')
        .eq('lesson_id', lessonId);

      if (error) throw new Error(error.message);
      return data as LessonOpportunityLink[];
    },
    enabled: !!lessonId,
  });
}

export function useLinkLessonOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (link: LessonOpportunityLink) => {
      const { error } = await supabase
        .from('lesson_opportunity_links')
        .insert([link]);

      if (error) throw new Error(error.message);
      return link;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson_links', data.lesson_id] });
    },
    onError: (err) => {
      toast.error(`Failed to link item: ${err.message}`);
    }
  });
}

export function useUnlinkLessonOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lesson_id, opportunity_id }: LessonOpportunityLink) => {
      const { error } = await supabase
        .from('lesson_opportunity_links')
        .delete()
        .eq('lesson_id', lesson_id)
        .eq('opportunity_id', opportunity_id);

      if (error) throw new Error(error.message);
      return { lesson_id, opportunity_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson_links', data.lesson_id] });
    },
    onError: (err) => {
      toast.error(`Failed to unlink item: ${err.message}`);
    }
  });
}

export function useLessonIndicators(projectId: string, costCodes: string[]) {
  return useQuery({
    queryKey: ['lesson_indicators', projectId, costCodes],
    queryFn: async () => {
      if (!costCodes.length) return [];
      
      const { data, error } = await supabase.rpc('get_lesson_indicators', {
        p_project_id: projectId,
        p_cost_codes: costCodes
      });

      if (error) throw new Error(error.message);
      return data as LessonIndicator[];
    },
    enabled: !!projectId && costCodes.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
