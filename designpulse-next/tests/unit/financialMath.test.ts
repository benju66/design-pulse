import { describe, it, expect } from 'vitest';
import {
  calculateParentTotals,
  calculateBudgetMetrics,
  resolveStandardCost,
  calculateScenarioBudgetMetrics,
} from '@/utils/financialMath';

// ---------------------------------------------------------------------------
// Helper factories — produce minimal test fixtures matching function signatures
// ---------------------------------------------------------------------------

// `pick` returns an explicitly-provided override (including `null`) and only
// falls back to the default when the key is absent — so tests that pass `null`
// actually exercise the function's null handling instead of being silently
// coerced to the default by `??`.
function pick<T>(overrides: Record<string, unknown>, key: string, fallback: T): T {
  return key in overrides ? (overrides[key] as T) : fallback;
}

function makeOption(overrides: Record<string, unknown> = {}) {
  return {
    id: pick<string>(overrides, 'id', 'opt-1'),
    opportunity_id: pick<string>(overrides, 'opportunity_id', 'opp-1'),
    cost_impact: pick<number | null>(overrides, 'cost_impact', 0),
    days_impact: pick<number | null>(overrides, 'days_impact', 0),
    is_locked: pick<boolean | null>(overrides, 'is_locked', false),
    include_in_budget: pick<boolean | null>(overrides, 'include_in_budget', false),
  };
}

function makeOpp(overrides: Record<string, unknown> = {}) {
  return {
    id: pick<string>(overrides, 'id', 'opp-1'),
    status: pick<string | null>(overrides, 'status', 'Draft'),
    cost_impact: pick<number | null>(overrides, 'cost_impact', 0),
  };
}

// ===========================================================================
// calculateParentTotals
// ===========================================================================

describe('calculateParentTotals', () => {
  it('returns locked option values when a locked option exists', () => {
    const options = [
      makeOption({ id: 'a', cost_impact: 5000, days_impact: 3, is_locked: true }),
      makeOption({ id: 'b', cost_impact: 12000, days_impact: 7 }),
    ];
    const result = calculateParentTotals('opp-1', options, {}, 'b');
    expect(result.cost_impact).toBe(5000);
    expect(result.days_impact).toBe(3);
  });

  it('sums include_in_budget options when no option is locked', () => {
    const options = [
      makeOption({ id: 'a', cost_impact: 1000, days_impact: 1, include_in_budget: true }),
      makeOption({ id: 'b', cost_impact: 2000, days_impact: 2, include_in_budget: true }),
      makeOption({ id: 'c', cost_impact: 9999, days_impact: 99 }),
    ];
    const result = calculateParentTotals('opp-1', options, {}, 'c');
    expect(result.cost_impact).toBe(3000);
    expect(result.days_impact).toBe(3);
  });

  it('returns Math.max (worst-case exposure) when no option is locked or budgeted', () => {
    const options = [
      makeOption({ id: 'a', cost_impact: 3000, days_impact: 2 }),
      makeOption({ id: 'b', cost_impact: 7500, days_impact: 5 }),
      makeOption({ id: 'c', cost_impact: 1200, days_impact: 1 }),
    ];
    const result = calculateParentTotals('opp-1', options, {}, 'c');
    expect(result.cost_impact).toBe(7500);
    expect(result.days_impact).toBe(5);
  });

  it('returns zeroes when there are no options for the opportunity', () => {
    const options = [
      makeOption({ id: 'a', opportunity_id: 'other-opp', cost_impact: 5000 }),
    ];
    const result = calculateParentTotals('opp-1', options, {}, 'a');
    expect(result.cost_impact).toBe(0);
    expect(result.days_impact).toBe(0);
  });

  it('applies the pending update to the target option before calculating', () => {
    const options = [
      makeOption({ id: 'a', cost_impact: 1000, days_impact: 1 }),
      makeOption({ id: 'b', cost_impact: 2000, days_impact: 2 }),
    ];
    // Simulate the user editing option 'b' to $10,000
    const result = calculateParentTotals('opp-1', options, { cost_impact: 10000 }, 'b');
    // Math.max(1000, 10000) = 10000
    expect(result.cost_impact).toBe(10000);
  });

  it('handles null cost_impact values gracefully (coerced to 0)', () => {
    const options = [
      makeOption({ id: 'a', cost_impact: null }),
      makeOption({ id: 'b', cost_impact: 500 }),
    ];
    const result = calculateParentTotals('opp-1', options, {}, 'b');
    expect(result.cost_impact).toBe(500);
  });
});

// ===========================================================================
// resolveStandardCost
// ===========================================================================

describe('resolveStandardCost', () => {
  it('returns locked option cost when present', () => {
    const opp = makeOpp({ cost_impact: 100 });
    const options = [
      makeOption({ cost_impact: 5000, is_locked: true }),
      makeOption({ cost_impact: 9000 }),
    ];
    expect(resolveStandardCost(opp, options)).toBe(5000);
  });

  it('returns parent cost_impact when no options exist', () => {
    const opp = makeOpp({ cost_impact: 7777 });
    expect(resolveStandardCost(opp, [])).toBe(7777);
  });

  it('sums include_in_budget options when no lock exists', () => {
    const opp = makeOpp();
    const options = [
      makeOption({ cost_impact: 1000, include_in_budget: true }),
      makeOption({ cost_impact: 2500, include_in_budget: true }),
      makeOption({ cost_impact: 50000 }),
    ];
    expect(resolveStandardCost(opp, options)).toBe(3500);
  });

  it('returns worst-case (Math.max) when no lock or budgeted options', () => {
    const opp = makeOpp();
    const options = [
      makeOption({ cost_impact: 1000 }),
      makeOption({ cost_impact: 8000 }),
      makeOption({ cost_impact: 3000 }),
    ];
    expect(resolveStandardCost(opp, options)).toBe(8000);
  });
});

// ===========================================================================
// calculateBudgetMetrics
// ===========================================================================

describe('calculateBudgetMetrics', () => {
  const BUDGET = 1_000_000;

  it('correctly categorizes Approved items into approvedChanges', () => {
    const opps = [makeOpp({ id: 'a', status: 'Approved', cost_impact: 15000 })];
    const opts = [makeOption({ opportunity_id: 'a', cost_impact: 15000, is_locked: true })];
    const metrics = calculateBudgetMetrics(opps, opts, BUDGET);

    expect(metrics.approvedChanges).toBe(15000);
    expect(metrics.pendingChanges).toBe(0);
    expect(metrics.potentialExposure).toBe(0);
    expect(metrics.revisedBudget).toBe(BUDGET + 15000);
  });

  it('correctly categorizes Pending Review items into pendingChanges', () => {
    const opps = [makeOpp({ id: 'a', status: 'Pending Review', cost_impact: 5000 })];
    const metrics = calculateBudgetMetrics(opps, [], BUDGET);

    expect(metrics.pendingChanges).toBe(5000);
    expect(metrics.approvedChanges).toBe(0);
    expect(metrics.projectedBudget).toBe(BUDGET + 5000);
  });

  it('correctly categorizes Draft items into potentialExposure', () => {
    const opps = [makeOpp({ id: 'a', status: 'Draft', cost_impact: 8000 })];
    const metrics = calculateBudgetMetrics(opps, [], BUDGET);

    expect(metrics.potentialExposure).toBe(8000);
    expect(metrics.approvedChanges).toBe(0);
    expect(metrics.pendingChanges).toBe(0);
  });

  it('excludes Rejected items from all buckets', () => {
    const opps = [
      makeOpp({ id: 'a', status: 'Rejected', cost_impact: 50000 }),
      makeOpp({ id: 'b', status: 'Draft', cost_impact: 1000 }),
    ];
    const metrics = calculateBudgetMetrics(opps, [], BUDGET);

    expect(metrics.approvedChanges).toBe(0);
    expect(metrics.pendingChanges).toBe(0);
    expect(metrics.potentialExposure).toBe(1000);
    expect(metrics.itemCount).toBe(1);
  });

  it('uses worst-case (Math.max) for Draft items with unbudgeted options', () => {
    const opps = [makeOpp({ id: 'a', status: 'Draft', cost_impact: 0 })];
    const opts = [
      makeOption({ opportunity_id: 'a', cost_impact: 2000 }),
      makeOption({ opportunity_id: 'a', cost_impact: 9500 }),
      makeOption({ opportunity_id: 'a', cost_impact: 4000 }),
    ];
    const metrics = calculateBudgetMetrics(opps, opts, BUDGET);
    expect(metrics.potentialExposure).toBe(9500);
  });

  it('calculates netImpact as sum of all buckets', () => {
    const opps = [
      makeOpp({ id: 'a', status: 'Approved', cost_impact: 1000 }),
      makeOpp({ id: 'b', status: 'Pending Review', cost_impact: 2000 }),
      makeOpp({ id: 'c', status: 'Draft', cost_impact: 3000 }),
    ];
    const opts = [makeOption({ opportunity_id: 'a', cost_impact: 1000, is_locked: true })];
    const metrics = calculateBudgetMetrics(opps, opts, BUDGET);
    expect(metrics.netImpact).toBe(1000 + 2000 + 3000);
  });

  it('handles an empty opportunity list gracefully', () => {
    const metrics = calculateBudgetMetrics([], [], BUDGET);
    expect(metrics.approvedChanges).toBe(0);
    expect(metrics.pendingChanges).toBe(0);
    expect(metrics.potentialExposure).toBe(0);
    expect(metrics.revisedBudget).toBe(BUDGET);
    expect(metrics.projectedBudget).toBe(BUDGET);
    expect(metrics.itemCount).toBe(0);
  });
});

// ===========================================================================
// calculateScenarioBudgetMetrics
// ===========================================================================

describe('calculateScenarioBudgetMetrics', () => {
  const BUDGET = 500_000;

  it('applies scenario overrides to pending bucket', () => {
    const opps = [makeOpp({ id: 'a', status: 'Draft', cost_impact: 0 })];
    const opts = [
      makeOption({ id: 'opt-1', opportunity_id: 'a', cost_impact: 3000 }),
      makeOption({ id: 'opt-2', opportunity_id: 'a', cost_impact: 7000 }),
    ];
    const overrides = new Map([['a', 'opt-2']]);
    const metrics = calculateScenarioBudgetMetrics(opps, opts, BUDGET, overrides);

    // Overridden Draft item goes to pending bucket
    expect(metrics.pendingChanges).toBe(7000);
    expect(metrics.potentialExposure).toBe(0);
  });

  it('falls back to resolveStandardCost when assumed option is missing (stale ref)', () => {
    const opps = [makeOpp({ id: 'a', status: 'Draft', cost_impact: 0 })];
    const opts = [
      makeOption({ id: 'opt-1', opportunity_id: 'a', cost_impact: 4000 }),
      makeOption({ id: 'opt-2', opportunity_id: 'a', cost_impact: 6000 }),
    ];
    // 'deleted-option' does not exist in opts
    const overrides = new Map([['a', 'deleted-option']]);
    const metrics = calculateScenarioBudgetMetrics(opps, opts, BUDGET, overrides);

    // Fallback: Math.max(4000, 6000) = 6000 into exposure (Draft status)
    expect(metrics.potentialExposure).toBe(6000);
  });

  it('keeps already-locked-with-same-contender in approved bucket', () => {
    const opps = [makeOpp({ id: 'a', status: 'Approved', cost_impact: 5000 })];
    const opts = [
      makeOption({ id: 'opt-1', opportunity_id: 'a', cost_impact: 5000, is_locked: true }),
      makeOption({ id: 'opt-2', opportunity_id: 'a', cost_impact: 8000 }),
    ];
    const overrides = new Map([['a', 'opt-1']]);
    const metrics = calculateScenarioBudgetMetrics(opps, opts, BUDGET, overrides);

    expect(metrics.approvedChanges).toBe(5000);
    expect(metrics.pendingChanges).toBe(0);
  });

  it('treats non-overridden items identically to calculateBudgetMetrics', () => {
    const opps = [
      makeOpp({ id: 'a', status: 'Approved', cost_impact: 1000 }),
      makeOpp({ id: 'b', status: 'Draft', cost_impact: 2000 }),
    ];
    const opts = [makeOption({ id: 'opt-1', opportunity_id: 'a', cost_impact: 1000, is_locked: true })];
    const noOverrides = new Map<string, string>();

    const scenario = calculateScenarioBudgetMetrics(opps, opts, BUDGET, noOverrides);
    const baseline = calculateBudgetMetrics(opps, opts, BUDGET);

    expect(scenario.approvedChanges).toBe(baseline.approvedChanges);
    expect(scenario.pendingChanges).toBe(baseline.pendingChanges);
    expect(scenario.potentialExposure).toBe(baseline.potentialExposure);
  });
});
