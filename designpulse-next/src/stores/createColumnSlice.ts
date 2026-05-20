import { VisibilityState } from '@tanstack/react-table';

/**
 * Factory for creating column visibility/order state slices in Zustand.
 *
 * Replaces 6 identical column state patterns (~120 lines) in useUIStore.ts:
 *   - gridColumnVisibility / gridColumnOrder
 *   - gridV2ColumnVisibility
 *   - coordColumnVisibility / coordColumnOrder
 *   - permitColumnVisibility / permitColumnOrder
 *   - lessonsColumnVisibility
 *   - brandStandardsColumnVisibility / brandStandardsColumnOrder
 *
 * Each slice stores per-project column state as Record<projectId, state>.
 *
 * Usage in useUIStore:
 *   ...createColumnSlice('grid'),
 *   ...createColumnSlice('coord'),
 *   ...createColumnSlice('permit'),
 */

type Updater<T> = T | ((old: T) => T);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ColumnSliceActions {
  [key: string]: unknown;
}

/**
 * Creates a column visibility + order state slice for a given domain.
 *
 * Generates the following state keys and setters:
 *   - `${domain}ColumnVisibility`: Record<string, VisibilityState>
 *   - `set${Domain}ColumnVisibility`: (projectId, updater) => void
 *   - `${domain}ColumnOrder`: Record<string, string[]>
 *   - `set${Domain}ColumnOrder`: (projectId, updater) => void
 */
export function createColumnSlice(domain: string) {
  const visKey = `${domain}ColumnVisibility`;
  const setVisKey = `set${capitalize(domain)}ColumnVisibility`;
  const orderKey = `${domain}ColumnOrder`;
  const setOrderKey = `set${capitalize(domain)}ColumnOrder`;

  return (set: (fn: (state: Record<string, unknown>) => Record<string, unknown>) => void) => ({
    [visKey]: {} as Record<string, VisibilityState>,
    [setVisKey]: (projectId: string, updater: Updater<VisibilityState>) =>
      set((state: Record<string, unknown>) => {
        const current = (state[visKey] as Record<string, VisibilityState>) ?? {};
        const old = current[projectId] ?? {};
        const next = typeof updater === 'function' ? updater(old) : updater;
        return { [visKey]: { ...current, [projectId]: next } };
      }),
    [orderKey]: {} as Record<string, string[]>,
    [setOrderKey]: (projectId: string, updater: Updater<string[]>) =>
      set((state: Record<string, unknown>) => {
        const current = (state[orderKey] as Record<string, string[]>) ?? {};
        const old = current[projectId] ?? [];
        const next = typeof updater === 'function' ? updater(old) : updater;
        return { [orderKey]: { ...current, [projectId]: next } };
      }),
  });
}
