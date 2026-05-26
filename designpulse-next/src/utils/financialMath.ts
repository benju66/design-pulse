import { OpportunityOption } from '@/types/models';

export function calculateParentTotals(
  opportunityId: string, 
  previousOptions: OpportunityOption[], 
  updates: Partial<OpportunityOption>, 
  targetOptionId: string
): { cost_impact: number; days_impact: number } {
  // Simulate the updated array of options locally for optimistic UI
  const allOptsForOpp = previousOptions
    .filter(opt => opt.opportunity_id === opportunityId)
    .map(opt => opt.id === targetOptionId ? { ...opt, ...updates } : opt) as OpportunityOption[];

  const lockedOpt = allOptsForOpp.find(opt => opt.is_locked);
  if (lockedOpt) {
    return {
      cost_impact: Number(lockedOpt.cost_impact || 0),
      days_impact: Number(lockedOpt.days_impact || 0)
    };
  }
  
  const includedOpts = allOptsForOpp.filter(opt => opt.include_in_budget);
  if (includedOpts.length > 0) {
    return {
      cost_impact: includedOpts.reduce((sum, opt) => sum + Number(opt.cost_impact || 0), 0),
      days_impact: includedOpts.reduce((sum, opt) => sum + Number(opt.days_impact || 0), 0)
    };
  }

  if (allOptsForOpp.length > 0) {
    return {
      cost_impact: Math.max(...allOptsForOpp.map(opt => Number(opt.cost_impact || 0))),
      days_impact: Math.max(...allOptsForOpp.map(opt => Number(opt.days_impact || 0)))
    };
  }

  return { cost_impact: 0, days_impact: 0 };
}

// ============================================================================
// Budget Metrics — Extracted from BudgetSummary.tsx L52-104
// ============================================================================

export interface BudgetMetrics {
  approvedChanges: number;
  pendingChanges: number;
  potentialExposure: number;
  revisedBudget: number;
  projectedBudget: number;
  netImpact: number;
  itemCount: number;
}

/**
 * Core budget calculation engine — extracted from BudgetSummary.tsx L52-104.
 * Used by BudgetSummary (full project) and Sandbox (per-package).
 *
 * INVARIANT: This function produces identical results to the original inline
 * useMemo. Any behavioral change is a regression.
 *
 * NOTE: Budget-line rows (is_budget_line=true) are NOT filtered here — they
 * contribute $0 which is harmless. Filtering them would change BudgetSummary output.
 */
export function calculateBudgetMetrics(
  opportunities: Array<{ id: string; status: string | null; cost_impact: number | null }>,
  allOptions: Array<{ opportunity_id: string; cost_impact: number | null; is_locked: boolean | null; include_in_budget: boolean | null }>,
  originalBudget: number,
): BudgetMetrics {
  let approved = 0;
  let pending = 0;
  let exposure = 0;

  // BUG-6: Preserve O(n+m) pre-grouping from BudgetSummary L57-61
  const optionsByOppId = allOptions.reduce<Record<string, typeof allOptions>>((acc, opt) => {
    acc[opt.opportunity_id] = acc[opt.opportunity_id] || [];
    acc[opt.opportunity_id].push(opt);
    return acc;
  }, {});

  opportunities.forEach(opp => {
    if (opp.status === 'Rejected') return;

    const oppOptions = optionsByOppId[opp.id] || [];
    const hasOptions = oppOptions.length > 0;
    const lockedOption = oppOptions.find(o => o.is_locked);

    const oppImpact = Number(opp.cost_impact) || 0;

    if (opp.status === 'Approved' || lockedOption) {
      const impact = lockedOption ? (Number(lockedOption.cost_impact) || 0) : oppImpact;
      approved += impact;
    } else if (opp.status === 'Pending Review') {
      if (!hasOptions) {
        pending += oppImpact;
      } else {
        const includedOptions = oppOptions.filter(o => o.include_in_budget);
        if (includedOptions.length > 0) {
          const includedImpact = includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
          pending += includedImpact;
        } else {
          const maxImpact = Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
          pending += maxImpact;
        }
      }
    } else {
      if (!hasOptions) {
        exposure += oppImpact;
      } else {
        const includedOptions = oppOptions.filter(o => o.include_in_budget);
        if (includedOptions.length > 0) {
          const includedImpact = includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
          exposure += includedImpact;
        } else {
          const maxImpact = Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
          exposure += maxImpact;
        }
      }
    }
  });

  const revisedBudget = originalBudget + approved;
  const projectedBudget = revisedBudget + pending;
  return {
    approvedChanges: approved,
    pendingChanges: pending,
    potentialExposure: exposure,
    revisedBudget,
    projectedBudget,
    netImpact: approved + pending + exposure,
    itemCount: opportunities.filter(o => o.status !== 'Rejected').length,
  };
}

/**
 * Standard cost resolution for a single opportunity — used by useSandboxMetrics
 * as the fallback when no assumed_option_id is set.
 *
 * Priority: locked > include_in_budget > worst-case (Math.max)
 */
export function resolveStandardCost(
  opp: { status: string | null; cost_impact: number | null },
  oppOptions: Array<{ cost_impact: number | null; is_locked: boolean | null; include_in_budget: boolean | null }>,
): number {
  const lockedOption = oppOptions.find(o => o.is_locked);
  if (lockedOption) return Number(lockedOption.cost_impact) || 0;

  const hasOptions = oppOptions.length > 0;
  const oppImpact = Number(opp.cost_impact) || 0;

  if (!hasOptions) return oppImpact;

  const includedOptions = oppOptions.filter(o => o.include_in_budget);
  if (includedOptions.length > 0) {
    return includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
  }

  return Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
}

// ============================================================================
// Scenario Budget Metrics — What-if analysis with per-opportunity overrides
// ============================================================================

/**
 * Scenario-aware budget calculation engine.
 *
 * Given a Map of opportunity_id → assumed_option_id overrides (from packages
 * in a scenario), computes what the budget WOULD look like if those contenders
 * were locked.
 *
 * DR-9: If an assumed option is not found (soft-deleted contender), falls back
 * to resolveStandardCost() — same EDGE-1 pattern as useSandboxMetrics.
 *
 * DR-2: The caller (ScenarioColumn) is responsible for building the overrides
 * Map with first-package-wins priority (ascending sort_order), matching the
 * RPC's DISTINCT ON behavior.
 */
export function calculateScenarioBudgetMetrics(
  opportunities: Array<{ id: string; status: string | null; cost_impact: number | null }>,
  allOptions: Array<{ id: string; opportunity_id: string; cost_impact: number | null; is_locked: boolean | null; include_in_budget: boolean | null }>,
  originalBudget: number,
  overrides: Map<string, string>, // oppId → assumed optionId
): BudgetMetrics {
  let approved = 0;
  let pending = 0;
  let exposure = 0;

  // Pre-group options by opportunity_id (O(m) once)
  const optionsByOppId = allOptions.reduce<Record<string, typeof allOptions>>((acc, opt) => {
    acc[opt.opportunity_id] = acc[opt.opportunity_id] || [];
    acc[opt.opportunity_id].push(opt);
    return acc;
  }, {});

  opportunities.forEach(opp => {
    if (opp.status === 'Rejected') return;

    const oppOptions = optionsByOppId[opp.id] || [];
    const assumedOptionId = overrides.get(opp.id);

    if (assumedOptionId) {
      // This opportunity has a scenario override
      const assumedOption = oppOptions.find(o => o.id === assumedOptionId);

      if (!assumedOption) {
        // DR-9: Stale ref — option deleted. Fall back to standard cost.
        const fallbackCost = resolveStandardCost(opp, oppOptions);
        // Bucket using current status (same as non-overridden path)
        if (opp.status === 'Approved') approved += fallbackCost;
        else if (opp.status === 'Pending Review') pending += fallbackCost;
        else exposure += fallbackCost;
        return;
      }

      const assumedCost = Number(assumedOption.cost_impact) || 0;
      const lockedOption = oppOptions.find(o => o.is_locked);

      if (opp.status === 'Approved' && lockedOption?.id === assumedOptionId) {
        // Already locked with this exact contender — no change
        approved += assumedCost;
      } else if (opp.status === 'Approved') {
        // Already approved but with a DIFFERENT contender — would re-lock
        pending += assumedCost;
      } else {
        // Draft / Pending Review → scenario "what-if" projection
        pending += assumedCost;
      }
    } else {
      // No override — use standard bucketing (identical to calculateBudgetMetrics)
      const hasOptions = oppOptions.length > 0;
      const lockedOption = oppOptions.find(o => o.is_locked);
      const oppImpact = Number(opp.cost_impact) || 0;

      if (opp.status === 'Approved' || lockedOption) {
        const impact = lockedOption ? (Number(lockedOption.cost_impact) || 0) : oppImpact;
        approved += impact;
      } else if (opp.status === 'Pending Review') {
        if (!hasOptions) {
          pending += oppImpact;
        } else {
          const includedOptions = oppOptions.filter(o => o.include_in_budget);
          if (includedOptions.length > 0) {
            pending += includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
          } else {
            pending += Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
          }
        }
      } else {
        if (!hasOptions) {
          exposure += oppImpact;
        } else {
          const includedOptions = oppOptions.filter(o => o.include_in_budget);
          if (includedOptions.length > 0) {
            exposure += includedOptions.reduce((sum, o) => sum + (Number(o.cost_impact) || 0), 0);
          } else {
            exposure += Math.max(...oppOptions.map(o => Number(o.cost_impact) || 0));
          }
        }
      }
    }
  });

  const revisedBudget = originalBudget + approved;
  const projectedBudget = revisedBudget + pending;
  return {
    approvedChanges: approved,
    pendingChanges: pending,
    potentialExposure: exposure,
    revisedBudget,
    projectedBudget,
    netImpact: approved + pending + exposure,
    itemCount: opportunities.filter(o => o.status !== 'Rejected').length,
  };
}
