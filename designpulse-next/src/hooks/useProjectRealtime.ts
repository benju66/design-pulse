import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

export function useProjectRealtime(projectId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const debouncedInvalidate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // AGENTS.md Rule C.2: Respect the Cache (Invalidate don't reload)
        queryClient.invalidateQueries({ queryKey: ['opportunities', projectId], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId], refetchType: 'active' });
      }, 300);
    };

    // AGENTS.md Rule C.26: The Subscription Firehose
    // Filter both opportunities and opportunity_options by project_id to ensure
    // we only receive payloads relevant to this specific project, preventing 
    // performance and security leaks across a multi-tenant instance.
    const channel = supabase
      .channel(`project-realtime-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opportunities', filter: `project_id=eq.${projectId}` },
        debouncedInvalidate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opportunity_options', filter: `project_id=eq.${projectId}` },
        debouncedInvalidate
      )
      .subscribe();

    // AGENTS.md Rule C.15: Cleanup
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
