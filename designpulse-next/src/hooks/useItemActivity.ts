import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { ItemActivity } from '@/types/models';
import { useEffect } from 'react';

const PAGE_SIZE = 20;

export interface ActivityParams {
  opportunityId?: string | null;
  lessonId?: string | null;
  permitId?: string | null;
  deliverableId?: string | null;
}

function getQueryKey(params: ActivityParams) {
  if (params.lessonId) return ['activity_feed', 'lesson', params.lessonId];
  if (params.permitId) return ['activity_feed', 'permit', params.permitId];
  if (params.deliverableId) return ['activity_feed', 'deliverable', params.deliverableId];
  if (params.opportunityId) return ['activity_feed', 'opportunity', params.opportunityId];
  return ['activity_feed', 'unknown'];
}

export function useActivityFeed(params: ActivityParams) {
  const queryClient = useQueryClient();
  const id = params.lessonId || params.permitId || params.opportunityId || params.deliverableId;
  const filterCol = params.lessonId 
    ? 'lesson_id' 
    : params.permitId 
      ? 'permit_id' 
      : params.deliverableId 
        ? 'deliverable_id' 
        : 'opportunity_id';

  useEffect(() => {
    if (!id) return;

    // Supabase Realtime Subscription
    const channel = supabase.channel(`activity-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_activity',
          filter: `${filterCol}=eq.${id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: getQueryKey(params) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, filterCol, queryClient, params.opportunityId, params.lessonId, params.permitId, params.deliverableId]);

  return useInfiniteQuery<{ data: ItemActivity[]; nextCursor: number | null }, Error>({
    queryKey: getQueryKey(params),
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async ({ pageParam = 0 }) => {
      if (!id) return { data: [], nextCursor: null };
      
      const { data, error } = await supabase
        .from('item_activity')
        .select('*')
        .eq(filterCol, id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range((pageParam as number) * PAGE_SIZE, ((pageParam as number) + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error('Supabase error fetching activity:', error);
        throw error;
      }

      return {
        data: data as ItemActivity[],
        nextCursor: data.length === PAGE_SIZE ? (pageParam as number) + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!id,
    initialPageParam: 0,
  });
}

export function useAddComment(params: ActivityParams, projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = getQueryKey(params);

  return useMutation<
    ItemActivity,
    Error,
    { id?: string; content: string; mentions: string[]; option_id?: string; include_in_oac?: boolean; author_id?: string },
    { previousPages: any }
  >({
    mutationFn: async (newComment) => {
      const { id, ...rest } = newComment;
      const { data, error } = await supabase
        .from('item_activity')
        .insert([{
          id: id || crypto.randomUUID(),
          project_id: projectId,
          opportunity_id: params.opportunityId || null,
          lesson_id: params.lessonId || null,
          permit_id: params.permitId || null,
          deliverable_id: params.deliverableId || null,
          activity_type: 'user_comment',
          ...rest
        }])
        .select()
        .single();

      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ItemActivity;
    },
    onMutate: async (newComment) => {
      await queryClient.cancelQueries({ queryKey });
      const previousPages = queryClient.getQueryData(queryKey);

      const realUUID = newComment.id || crypto.randomUUID();

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old || !old.pages) return old;
        
        const optimisticComment: ItemActivity = {
          id: realUUID,
          project_id: projectId,
          opportunity_id: params.opportunityId || null,
          lesson_id: params.lessonId || null,
          permit_id: params.permitId || null,
          deliverable_id: params.deliverableId || null,
          option_id: newComment.option_id || null,
          activity_type: 'user_comment',
          content: newComment.content,
          mentions: newComment.mentions,
          author_id: newComment.author_id || null, 
          include_in_oac: newComment.include_in_oac || false,
          is_edited: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const newPages = [...old.pages];
        if (newPages.length > 0) {
           newPages[0] = {
             ...newPages[0],
             data: [optimisticComment, ...newPages[0].data]
           };
        }
        return { ...old, pages: newPages };
      });

      return { previousPages };
    },
    onError: (err, _newComment, context) => {
      if (context?.previousPages) {
        queryClient.setQueryData(queryKey, context.previousPages);
      }
      toast.error(`Failed to add comment: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    }
  });
}

export function useUpdateComment(params: ActivityParams) {
  const queryClient = useQueryClient();
  const queryKey = getQueryKey(params);

  return useMutation<
    ItemActivity,
    Error,
    { id: string; content: string; mentions: string[]; include_in_oac: boolean },
    { previousPages: any }
  >({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('item_activity')
        .update({
          content: updates.content,
          mentions: updates.mentions,
          include_in_oac: updates.include_in_oac
        })
        .eq('id', updates.id)
        .select()
        .single();

      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ItemActivity;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey });
      const previousPages = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old || !old.pages) return old;

        const newPages = old.pages.map((page: any) => ({
          ...page,
          data: page.data.map((item: ItemActivity) => 
            item.id === updates.id 
              ? { ...item, content: updates.content, mentions: updates.mentions, include_in_oac: updates.include_in_oac, is_edited: true, updated_at: new Date().toISOString() } 
              : item
          )
        }));
        return { ...old, pages: newPages };
      });

      return { previousPages };
    },
    onError: (err, _variables, context) => {
      if (context?.previousPages) {
        queryClient.setQueryData(queryKey, context.previousPages);
      }
      toast.error(`Failed to update comment: ${err.message || 'Unknown error'}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    }
  });
}

export function useDeleteComment(params: ActivityParams) {
  const queryClient = useQueryClient();
  const queryKey = getQueryKey(params);

  return useMutation<
    string,
    Error,
    string,
    { previousPages: any }
  >({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('item_activity')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw new Error(error.message || JSON.stringify(error));
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousPages = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old || !old.pages) return old;

        const newPages = old.pages.map((page: any) => ({
          ...page,
          data: page.data.filter((item: ItemActivity) => item.id !== id)
        }));
        return { ...old, pages: newPages };
      });

      return { previousPages };
    },
    onError: (err, _id, context) => {
      if (context?.previousPages) {
        queryClient.setQueryData(queryKey, context.previousPages);
      }
      toast.error(`Failed to delete comment: ${err.message || 'Unknown error'}`);
    },
  });
}
