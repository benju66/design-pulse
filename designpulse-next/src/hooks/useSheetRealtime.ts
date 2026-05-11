import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

// AGENTS.md C26: Mandatory server-side filter — never subscribe to an unfiltered table.
// AGENTS.md C2:  Invalidate the TanStack cache only; never force a page reload.
// AGENTS.md C15: Return cleanup function — unsubscribe channel and clear debounce timer.
//
// Debounce rationale: Supabase Realtime fires a separate UPDATE event for every
// write to project_sheets (e.g., each progress_percent increment from the worker).
// A 400-tile drawing fires ~8 UPDATE events in a few seconds. Without debouncing,
// invalidateQueries schedules 8 concurrent refetches. The 300ms window collapses
// them into a single query — identical pattern to useProjectRealtime.ts.
//
// Multi-tab safety: each tab mounts its own channel with a unique channel name
// scoped to projectId. The debounce timer is local to each useEffect invocation,
// so rapid remounts do not cross-contaminate each other's timers.
export function useSheetRealtime(projectId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    // Timer scoped to this effect invocation — isolated per mount.
    let debounceTimer: ReturnType<typeof setTimeout>;

    const debouncedInvalidate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // C2: refetchType: 'active' limits refetch to currently mounted subscribers.
        // Background/inactive queries receive fresh data on their next mount.
        queryClient.invalidateQueries({
          queryKey: ['project_sheets', projectId],
          refetchType: 'active',
        });
      }, 300);
    };

    const channel = supabase
      .channel(`sheet-status-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',                          // INSERT/DELETE handled by mutation cache
          schema: 'public',
          table: 'project_sheets',
          filter: `project_id=eq.${projectId}`,    // C26: mandatory filter
        },
        debouncedInvalidate
      )
      .subscribe();

    // C15: cancel pending debounce timer AND remove Supabase channel on unmount.
    // Removing the channel prevents duplicate WebSocket subscriptions when the
    // component remounts (navigation, React StrictMode double-invoke, tab switch).
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
