import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { Zone } from '@/types/map.types';

export function useUpdateDesignMarkups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      markups
    }: {
      opportunityId: string;
      markups: Zone[];
    }) => {
      // Ensure all markups have client-side UUIDs to prevent optimistic data loss (Rule C.8)
      const sanitizedMarkups = markups.map(m => ({
        ...m,
        id: m.id || crypto.randomUUID()
      }));

      const { data, error } = await supabase
        .from('opportunities')
        .update({ design_markups: sanitizedMarkups })
        .eq('id', opportunityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ opportunityId, markups }) => {
      // Optimistic Parent-Row Spreading (Rule C.9)
      await queryClient.cancelQueries({ queryKey: ['opportunities'] });

      const previousOpportunities = queryClient.getQueryData(['opportunities']);

      queryClient.setQueryData(['opportunities'], (old: any) => {
        if (!old) return old;
        return old.map((opp: any) =>
          opp.id === opportunityId
            ? { ...opp, design_markups: markups }
            : opp
        );
      });

      return { previousOpportunities };
    },
    onError: (_err, _variables, context: any) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(['opportunities'], context.previousOpportunities);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
  });
}
