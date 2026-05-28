import type { Opportunity, DisciplineConfig, CoordinationTask } from '@/types/models';

/**
 * Computes done/total counts from an opportunity's coordination_details,
 * covering both discipline entries and free-form tasks.
 */
export function getSubTaskSummary(
  opp: Opportunity,
  disciplines: DisciplineConfig[],
): { done: number; total: number } {
  const details = (opp.coordination_details || {}) as Record<string, unknown>;
  let done = 0;
  let total = 0;

  // Count discipline entries
  for (const d of disciplines) {
    const rawEntry = details[d.id];
    if (typeof rawEntry === 'object' && rawEntry !== null && 'status' in rawEntry) {
      const status = (rawEntry as { status: string }).status;
      if (status !== 'Not Required') {
        total++;
        if (status === 'Complete') done++;
      }
    }
  }

  // Count free-form tasks
  const tasks = details.tasks;
  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      if (t && typeof t === 'object' && 'status' in t) {
        total++;
        if ((t as CoordinationTask).status === 'Done') done++;
      }
    }
  }

  return { done, total };
}
