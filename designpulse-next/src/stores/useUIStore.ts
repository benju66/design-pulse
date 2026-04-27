import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UIState {
  selectedOpportunityId: string | null;
  setSelectedOpportunityId: (id: string | null) => void;
  
  cardOrder: string[];
  setCardOrder: (newOrder: string[]) => void;
  
  visibleCards: Record<string, boolean>;
  toggleCardVisibility: (cardId: string) => void;
  
  compareQueue: string[];
  toggleCompareItem: (id: string) => void;
  clearCompareQueue: () => void;
  
  gridColumnVisibility: Record<string, boolean>;
  setGridColumnVisibility: (updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;
  
  gridColumnOrder: string[];
  setGridColumnOrder: (updater: string[] | ((old: string[]) => string[])) => void;
  
  gridMode: 'navigate' | 'edit' | string;
  setGridMode: (mode: string) => void;
  
  coordColumnVisibility: Record<string, boolean>;
  setCoordColumnVisibility: (updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;
  
  coordColumnOrder: string[];
  setCoordColumnOrder: (updater: string[] | ((old: string[]) => string[])) => void;
  
  coordinationViewMode: 'board' | 'table-split';
  setCoordinationViewMode: (mode: 'board' | 'table-split') => void;
  
  isBudgetSummaryCollapsed: boolean;
  toggleBudgetSummary: () => void;
  
  isCoordSummaryCollapsed: boolean;
  toggleCoordSummary: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedOpportunityId: null,
      setSelectedOpportunityId: (id) => set({ selectedOpportunityId: id }),
      
      cardOrder: ['priority', 'status', 'cost_impact', 'days_impact', 'assignee', 'arch_plans_spec', 'bok_standard', 'existing_conditions', 'mep_impact', 'owner_goals', 'final_direction', 'backing_required', 'coordination_required', 'design_lock_phase'],
      
      visibleCards: {
        priority: true,
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
      
      gridMode: 'navigate',
      setGridMode: (mode) => set({ gridMode: mode }),
      
      coordColumnVisibility: {},
      setCoordColumnVisibility: (updater) => set((state) => ({ 
        coordColumnVisibility: typeof updater === 'function' ? updater(state.coordColumnVisibility) : updater 
      })),
      
      coordColumnOrder: ['select', 'open_panel', 'display_id', 'record_type', 'title', 'final_direction', 'priority', 'status', 'due_date', 'discipline_status'],
      setCoordColumnOrder: (updater) => set((state) => ({ 
        coordColumnOrder: typeof updater === 'function' ? updater(state.coordColumnOrder) : updater 
      })),
      
      coordinationViewMode: 'table-split',
      setCoordinationViewMode: (mode) => set({ coordinationViewMode: mode }),
      
      isBudgetSummaryCollapsed: false,
      toggleBudgetSummary: () => set((state) => ({ isBudgetSummaryCollapsed: !state.isBudgetSummaryCollapsed })),
      
      isCoordSummaryCollapsed: false,
      toggleCoordSummary: () => set((state) => ({ isCoordSummaryCollapsed: !state.isCoordSummaryCollapsed })),
      
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
        coordColumnVisibility: state.coordColumnVisibility,
        coordColumnOrder: state.coordColumnOrder,
        coordinationViewMode: state.coordinationViewMode,
        isBudgetSummaryCollapsed: state.isBudgetSummaryCollapsed ?? false,
        isCoordSummaryCollapsed: state.isCoordSummaryCollapsed ?? false,
      }),
    }
  )
);
