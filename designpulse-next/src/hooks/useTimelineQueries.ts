import { useMemo } from 'react';
import { useKeyDates } from './useKeyDateQueries';
import { useDeliverables } from './useDeliverableQueries';
import { TimelineEvent } from '@/types/models';

/**
 * Composes useKeyDates + useDeliverables into a single unified timeline.
 *
 * - Standalone key dates are always included
 * - Deliverables are included only when is_elevated_key_date = true
 * - Results are sorted by timeline_date ascending
 *
 * Both source queries are already cached by react-query. This hook
 * reuses that cache — no additional network requests. When either
 * source query is invalidated (e.g., via realtime), the useMemo
 * recomputes automatically.
 *
 * Extensible: To add permits in a future sprint, import usePermits(),
 * filter by is_elevated_key_date, map to TimelineEvent, and concat.
 */
export function useUnifiedTimeline(projectId: string | null) {
  const { data: keyDates = [], isLoading: keyDatesLoading } = useKeyDates(projectId);
  const { data: deliverables = [], isLoading: deliverablesLoading } = useDeliverables(projectId);

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

    return [...keyDateEvents, ...deliverableEvents]
      .sort((a, b) => (a.timeline_date ?? '').localeCompare(b.timeline_date ?? ''));
  }, [keyDates, deliverables]);

  return {
    data: timeline,
    isLoading: keyDatesLoading || deliverablesLoading,
  };
}
