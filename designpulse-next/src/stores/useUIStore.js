import { create } from 'zustand';

export const useUIStore = create((set) => ({
  selectedOpportunityId: null,
  setSelectedOpportunityId: (id) => set({ selectedOpportunityId: id }),
  cardOrder: ['status', 'cost_impact', 'days_impact', 'assignee', 'arch_plans_spec', 'bok_standard', 'existing_conditions', 'mep_impact', 'owner_goals', 'final_direction', 'backing_required', 'coordination_required', 'design_lock_phase'],
  visibleCards: {
    status: true,
    cost_impact: true,
    days_impact: true,
    assignee: true,
    arch_plans_spec: true,
    bok_standard: true,
    existing_conditions: true,
    mep_impact: true,
    owner_goals: true,
    final_direction: true,
    backing_required: true,
    coordination_required: true,
    design_lock_phase: true,
  },
  compareQueue: [],
  setCardOrder: (newOrder) => set({ cardOrder: newOrder }),
  toggleCardVisibility: (cardId) => set((state) => ({
    visibleCards: {
      ...state.visibleCards,
      [cardId]: !state.visibleCards[cardId]
    }
  })),
  toggleCompareItem: (id) => set((state) => ({
    compareQueue: state.compareQueue.includes(id) 
      ? state.compareQueue.filter(itemId => itemId !== id)
      : [...state.compareQueue, id]
  })),
  clearCompareQueue: () => set({ compareQueue: [] }),
}));
