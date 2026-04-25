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
