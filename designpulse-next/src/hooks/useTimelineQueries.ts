import { useMemo } from 'react';
import { useKeyDates } from './useKeyDateQueries';
import { useDeliverables } from './useDeliverableQueries';
import { usePermits } from './usePermitQueries';
import { TimelineEvent } from '@/types/models';
import { toDateInputValue } from '@/lib/formatters';

/**
 * Composes useKeyDates + useDeliverables + usePermits into a single unified timeline.
 *
 * - Standalone key dates are always included
 * - Deliverables are included only when is_elevated_key_date = true
 * - Permits are included only when is_elevated_key_date = true
 *   (a permit with no target_approval_date is included but rendered with an empty date)
 * - Results are sorted by timeline_date ascending (empty dates sort to the end)
 *
 * All three source queries are already cached by react-query. This hook
 * reuses that cache — no additional network requests. When any source query
 * is invalidated (e.g., via realtime), the useMemo recomputes automatically.
 */
export function useUnifiedTimeline(projectId: string | null) {
  const { data: keyDates = [], isLoading: keyDatesLoading } = useKeyDates(projectId);
  const { data: deliverables = [], isLoading: deliverablesLoading } = useDeliverables(projectId);
  const { data: permits = [], isLoading: permitsLoading } = usePermits(projectId);

  const timeline = useMemo<TimelineEvent[]>(() => {
    const keyDateEvents: TimelineEvent[] = keyDates.map(kd => ({
      id: kd.id,
      project_id: kd.project_id,
      display_id: kd.display_id,
      title: kd.title,
      description: kd.description,
      timeline_date: kd.event_date,
      source_type: 'key_date' as const,
      status: null,
      assignee: null,
      is_deleted: kd.is_deleted,
      created_at: kd.created_at,
      updated_at: kd.updated_at,
    }));

    const deliverableEvents: TimelineEvent[] = deliverables
      .filter(d => d.is_elevated_key_date)
      .map(d => ({
        id: d.id,
        project_id: d.project_id,
        display_id: d.display_id,
        title: d.title,
        description: d.description,
        timeline_date: d.due_date,
        source_type: 'deliverable' as const,
        status: d.status,
        assignee: d.assignee,
        is_deleted: d.is_deleted,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));

    const permitEvents: TimelineEvent[] = permits
      .filter(p => p.is_elevated_key_date)
      .map(p => ({
        id: p.id,
        project_id: p.project_id,
        display_id: p.display_id,
        title: p.title,
        description: p.description,
        timeline_date: p.target_approval_date ? (toDateInputValue(p.target_approval_date) ?? '') : '',
        source_type: 'permit' as const,
        status: p.status,
        assignee: p.assignee,
        is_deleted: p.is_deleted ?? false,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));

    return [...keyDateEvents, ...deliverableEvents, ...permitEvents]
      .sort((a, b) => (a.timeline_date ?? '').localeCompare(b.timeline_date ?? ''));
  }, [keyDates, deliverables, permits]);

  return {
    data: timeline,
    isLoading: keyDatesLoading || deliverablesLoading || permitsLoading,
  };
}
