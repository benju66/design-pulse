import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { ItemActivity } from '@/types/models';
import { useEffect } from 'react';

const PAGE_SIZE = 20;

export function useActivityFeed(opportunityId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!opportunityId) return;

    // Supabase Realtime Subscription filtered strictly by opportunity_id
    const channel = supabase.channel(`activity-${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_activity',
          filter: `opportunity_id=eq.${opportunityId}`
        },
        () => {
          // Invalidate the query when new data arrives
          queryClient.invalidateQueries({ queryKey: ['activity_feed', opportunityId] });
        }
      )
      .subscribe();

    return () => {
      // Clean up to prevent memory leaks (AGENTS.md Rule 24/11)
      supabase.removeChannel(channel);
    };
  }, [opportunityId, queryClient]);

  return useInfiniteQuery<{ data: ItemActivity[]; nextCursor: number | null }, Error>({
    queryKey: ['activity_feed', opportunityId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!opportunityId) return { data: [], nextCursor: null };
      
      const { data, error } = await supabase
        .from('item_activity')
        .select('*')
        .eq('opportunity_id', opportunityId)
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
    enabled: !!opportunityId,
    initialPageParam: 0,
  });
}

export function useAddComment(opportunityId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ItemActivity,
    Error,
    { content: string; mentions: string[]; option_id?: string; include_in_oac?: boolean },
    { previousPages: any }
  >({
    mutationFn: async (newComment) => {
      const realUUID = (newComment as any).id; // ID generated in onMutate
      const { data, error } = await supabase
        .from('item_activity')
        .insert([{
          id: realUUID,
          project_id: projectId,
          opportunity_id: opportunityId,
          activity_type: 'user_comment',
          ...newComment
        }])
        .select()
        .single();

      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as ItemActivity;
    },
    onMutate: async (newComment) => {
      await queryClient.cancelQueries({ queryKey: ['activity_feed', opportunityId] });
      const previousPages = queryClient.getQueryData(['activity_feed', opportunityId]);

      const realUUID = crypto.randomUUID();
      (newComment as any).id = realUUID;

      queryClient.setQueryData(['activity_feed', opportunityId], (old: any) => {
        if (!old || !old.pages) return old;
        
        // Ensure optimistic update structure matches ItemActivity
        const optimisticComment: ItemActivity = {
          id: realUUID,
          project_id: projectId,
          opportunity_id: opportunityId,
          option_id: newComment.option_id || null,
          activity_type: 'user_comment',
          content: newComment.content,
          mentions: newComment.mentions,
          author_id: null, // We don't necessarily have it here synchronously, but Realtime will fix it
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
        queryClient.setQueryData(['activity_feed', opportunityId], context.previousPages);
      }
      toast.error(`Failed to add comment: ${err.message || 'Unknown error'}`);
    },
  });
}

export function useUpdateComment(opportunityId: string) {
  const queryClient = useQueryClient();

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
      await queryClient.cancelQueries({ queryKey: ['activity_feed', opportunityId] });
      const previousPages = queryClient.getQueryData(['activity_feed', opportunityId]);

      queryClient.setQueryData(['activity_feed', opportunityId], (old: any) => {
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
        queryClient.setQueryData(['activity_feed', opportunityId], context.previousPages);
      }
      toast.error(`Failed to update comment: ${err.message || 'Unknown error'}`);
    },
  });
}

export function useDeleteComment(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    string,
    Error,
    string,
    { previousPages: any }
  >({
    mutationFn: async (id) => {
      // Soft delete
      const { error } = await supabase
        .from('item_activity')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw new Error(error.message || JSON.stringify(error));
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['activity_feed', opportunityId] });
      const previousPages = queryClient.getQueryData(['activity_feed', opportunityId]);

      queryClient.setQueryData(['activity_feed', opportunityId], (old: any) => {
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
        queryClient.setQueryData(['activity_feed', opportunityId], context.previousPages);
      }
      toast.error(`Failed to delete comment: ${err.message || 'Unknown error'}`);
    },
  });
}
