import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
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
      gridColumnVisibility: {},
      setGridColumnVisibility: (updater) => set((state) => ({ 
        gridColumnVisibility: typeof updater === 'function' ? updater(state.gridColumnVisibility) : updater 
      })),
      gridColumnOrder: [],
      setGridColumnOrder: (updater) => set((state) => ({ 
        gridColumnOrder: typeof updater === 'function' ? updater(state.gridColumnOrder) : updater 
      })),
      activeCell: { rowIndex: null, columnId: null },
      setActiveCell: (cell) => set({ activeCell: cell }),
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
    }),
    {
      name: 'design-pulse-ui-prefs',
      partialize: (state) => ({
        cardOrder: state.cardOrder,
        visibleCards: state.visibleCards,
        gridColumnVisibility: state.gridColumnVisibility,
        gridColumnOrder: state.gridColumnOrder,
      }),
    }
  )
);
