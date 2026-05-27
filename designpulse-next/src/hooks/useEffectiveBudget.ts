'use client';
/**
 * useEffectiveBudget.ts
 *
 * Resolves budget values for a project using the construction-standard
 * budget hierarchy:
 *
 *   Original Budget  → Static baseline (GMP / initial contract value)
 *   Revised Budget   → Active estimate version's total_budget (current working budget)
 *
 * effectiveBudget resolution (for "Original Budget" display):
 *  1. `project_settings.original_budget` — manually entered or synced by
 *     `activate_estimate_version` RPC
 *  2. Active estimate version's `total_budget` — fallback when settings = 0
 *     (covers the "imported budget but didn't manually set" scenario)
 *  3. 0 — no budget data exists yet
 *
 * revisedBudget:
 *  - Always the active finalized estimate version's `total_budget`
 *  - Represents the current working budget maintained by the estimating team
 *  - Includes incorporated VE items, buyout results, quantity changes, etc.
 *
 * Both source queries are already cached by react-query — this hook adds
 * zero additional network requests.
 */

import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { useProjectEstimateVersions } from '@/hooks/useEstimateQueries';

export function useEffectiveBudget(projectId: string | null): {
  effectiveBudget: number;
  revisedBudget: number;
  source: 'settings' | 'estimate-version' | 'none';
} {
  const { data: settings } = useProjectSettings(projectId);
  const { data: versions } = useProjectEstimateVersions(projectId);

  const settingsBudget = settings ? Number(settings.original_budget) || 0 : 0;

  // Revised Budget: always the active finalized version's total_budget
  const activeVersion = versions?.find((v) => v.is_active && v.is_finalized);
  const activeVersionBudget = activeVersion ? Number(activeVersion.total_budget) || 0 : 0;

  // Original Budget resolution: settings first, then active version fallback
  if (settingsBudget > 0) {
    return {
      effectiveBudget: settingsBudget,
      revisedBudget: activeVersionBudget,
      source: 'settings',
    };
  }

  if (activeVersionBudget > 0) {
    return {
      effectiveBudget: activeVersionBudget,
      revisedBudget: activeVersionBudget,
      source: 'estimate-version',
    };
  }

  return { effectiveBudget: 0, revisedBudget: 0, source: 'none' };
}
