import { useMemo, useEffect, useRef } from 'react';
import type { Opportunity, OpportunityOption } from '@/types/models';
import type { VePackageItem } from '@/types/sandbox';
import { resolveStandardCost } from '@/utils/financialMath';
import { useCleanupStaleOptionRef } from '@/hooks/useSandboxQueries';

// ============================================================================
// Per-Item Metric Types
// ============================================================================

export interface ContenderSummary {
  id: string;
  title: string;
  costImpact: number;
  isLocked: boolean;
}

export interface PackageItemMetric {
  packageItemId: string;
  opportunityId: string;
  displayId: string;
  title: string;
  status: string;
  assumedOptionId: string | null;
  assumedOptionTitle: string | null;
  resolvedCostImpact: number;
  currentCostImpact: number;
  isStaleRef: boolean;
  availableOptions: ContenderSummary[];
}

export interface PackageMetrics {
  items: PackageItemMetric[];
  totals: {
    approvedCount: number;
    pendingCount: number;
    draftCount: number;
    netImpact: number;
  };
}

// ============================================================================
// Hook: useSandboxMetrics
// ============================================================================

/**
 * Scenario-aware per-package financial calculator.
 *
 * Differences from calculateBudgetMetrics:
 * - Filters out is_budget_line rows (BUG-2)
 * - Resolves per-item cost using assumed_option_id when set
 * - Falls back to standard BudgetSummary algorithm when assumed_option_id is null
 * - Detects stale contender refs and fires cleanup (EDGE-1)
 */
export function useSandboxMetrics(
  projectId: string,
  packageItems: VePackageItem[],
  allOpportunities: Opportunity[],
  allOptions: OpportunityOption[],
): PackageMetrics {
  const cleanupMutation = useCleanupStaleOptionRef(projectId);
  // Track which stale refs we've already cleaned to avoid infinite loops
  const cleanedRefsRef = useRef<Set<string>>(new Set());

  const result = useMemo(() => {
    // Pre-group options by opportunity_id (O(m) once, not O(n×m) per item)
    const optionsByOppId = allOptions.reduce<Record<string, OpportunityOption[]>>((acc, opt) => {
      acc[opt.opportunity_id] = acc[opt.opportunity_id] || [];
      acc[opt.opportunity_id].push(opt);
      return acc;
    }, {});

    const items: PackageItemMetric[] = [];
    const staleItemIds: string[] = [];

    for (const pi of packageItems) {
      const opp = allOpportunities.find(o => o.id === pi.opportunity_id);
      // BUG-2: Skip budget-line rows
      if (!opp || opp.is_budget_line) continue;

      const oppOptions = optionsByOppId[pi.opportunity_id] || [];
      const currentCost = resolveStandardCost(opp, oppOptions);

      let resolvedCost: number;
      let isStaleRef = false;
      let assumedTitle: string | null = null;

      if (pi.assumed_option_id) {
        const assumed = oppOptions.find(o => o.id === pi.assumed_option_id);
        if (!assumed) {
          // EDGE-1: Contender soft-deleted or missing — mark stale
          isStaleRef = true;
          resolvedCost = currentCost;
          staleItemIds.push(pi.id);
        } else {
          resolvedCost = Number(assumed.cost_impact) || 0;
          assumedTitle = assumed.title;
        }
      } else {
        resolvedCost = currentCost;
      }

      items.push({
        packageItemId: pi.id,
        opportunityId: opp.id,
        displayId: opp.display_id || '',
        title: opp.title || '',
        status: opp.status || 'Draft',
        assumedOptionId: pi.assumed_option_id,
        assumedOptionTitle: assumedTitle,
        resolvedCostImpact: resolvedCost,
        currentCostImpact: currentCost,
        isStaleRef,
        availableOptions: oppOptions.map(o => ({
          id: o.id,
          title: o.title,
          costImpact: Number(o.cost_impact) || 0,
          isLocked: o.is_locked ?? false,
        })),
      });
    }

    // Aggregate totals
    let approvedCount = 0;
    let pendingCount = 0;
    let draftCount = 0;
    let netImpact = 0;

    for (const item of items) {
      netImpact += item.resolvedCostImpact;
      if (item.status === 'Approved') approvedCount++;
      else if (item.status === 'Pending Review') pendingCount++;
      else if (item.status !== 'Rejected') draftCount++;
    }

    return {
      items,
      totals: { approvedCount, pendingCount, draftCount, netImpact },
      _staleItemIds: staleItemIds,
    };
  }, [packageItems, allOpportunities, allOptions]);

  // EDGE-1: Fire-and-forget cleanup for stale contender refs
  useEffect(() => {
    for (const itemId of result._staleItemIds) {
      if (!cleanedRefsRef.current.has(itemId)) {
        cleanedRefsRef.current.add(itemId);
        cleanupMutation.mutate(itemId);
      }
    }
  }, [result._staleItemIds, cleanupMutation]);

  return {
    items: result.items,
    totals: result.totals,
  };
}
