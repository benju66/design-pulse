import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_COORD_COLUMN_ORDER } from '@/lib/constants';

// ── Navigation domain types ───────────────────────────────────────────────────
export type ProjectView =
  | 'dashboard'
  | 'dashboard-v2'
  | 'map'
  | 'analytics'
  | 'coordination'
  | 'permits'
  | 'my-desk'
  | 'settings';

export type SettingsTab =
  | 'info'
  | 'team'
  | 'building_areas'
  | 'categories'
  | 'disciplines'
  | 'csi_specs'
  | 'estimate'
  | 'sidebar'
  | 've_matrix'
  | 'coord_matrix'
  | 'brand_standards'
  | 'permits';

// Flat view mode — matches coordinationViewMode / permitViewMode store pattern
export type VEGridViewMode = 'split' | 'flat' | 'card';

export interface UIState {
  selectedOpportunityId: string | null;
  setSelectedOpportunityId: (id: string | null) => void;
  
  cardOrder: string[];
  setCardOrder: (newOrder: string[]) => void;
  
  visibleCards: Record<string, boolean>;
  toggleCardVisibility: (cardId: string) => void;
  
  compareQueue: string[];
  setCompareQueue: (queue: string[]) => void;
  toggleCompareItem: (id: string) => void;
  clearCompareQueue: () => void;
  
  gridColumnVisibility: Record<string, Record<string, boolean>>;
  setGridColumnVisibility: (projectId: string, updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;
  
  gridColumnOrder: Record<string, string[]>;
  setGridColumnOrder: (projectId: string, updater: string[] | ((old: string[]) => string[])) => void;
  
  gridMode: 'navigate' | 'edit';
  setGridMode: (mode: 'navigate' | 'edit') => void;
  
  activeCell: { rowIndex: number; columnId: string } | null;
  setActiveCell: (cell: { rowIndex: number; columnId: string } | null) => void;
  
  coordColumnVisibility: Record<string, Record<string, boolean>>;
  setCoordColumnVisibility: (projectId: string, updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;
  
  coordColumnOrder: Record<string, string[]>;
  setCoordColumnOrder: (projectId: string, updater: string[] | ((old: string[]) => string[])) => void;
  
  coordinationViewMode: 'board' | 'table-split';
  setCoordinationViewMode: (mode: 'board' | 'table-split') => void;

  // VE grid view mode — flat, matching coordinationViewMode / permitViewMode pattern
  veGridViewMode: VEGridViewMode;
  setVeGridViewMode: (mode: VEGridViewMode) => void;

  // Per-project navigation persistence
  activeView: Record<string, ProjectView>;
  setActiveView: (projectId: string, view: ProjectView) => void;

  activeSettingsTab: Record<string, SettingsTab>;
  setActiveSettingsTab: (projectId: string, tab: SettingsTab) => void;

  // Atomic compound action — updates both fields in a single set() call to prevent flash
  navigateToSettings: (projectId: string, tab: SettingsTab) => void;

  isBudgetSummaryCollapsed: boolean;
  toggleBudgetSummary: () => void;
  
  isCoordSummaryCollapsed: boolean;
  toggleCoordSummary: () => void;
  
  isPermitSummaryCollapsed: boolean;
  togglePermitSummary: () => void;
  
  permitViewMode: 'board' | 'table-split';
  setPermitViewMode: (mode: 'board' | 'table-split') => void;
  
  permitFilters: Record<string, {
    status?: string[];
    type?: string[];
    assignee?: string[];
    ahj?: string[];
  }>;
  setPermitFilters: (projectId: string, filters: { status?: string[]; type?: string[]; assignee?: string[]; ahj?: string[] }) => void;
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
      setGridColumnVisibility: (projectId, updater) => set((state) => {
        const oldState = state.gridColumnVisibility[projectId] || {};
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          gridColumnVisibility: {
            ...state.gridColumnVisibility,
            [projectId]: newState
          }
        };
      }),
      
      gridColumnOrder: {},
      setGridColumnOrder: (projectId, updater) => set((state) => {
        const oldState = state.gridColumnOrder[projectId] || [];
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          gridColumnOrder: {
            ...state.gridColumnOrder,
            [projectId]: newState
          }
        };
      }),
      
      gridMode: 'navigate',
      setGridMode: (mode) => set({ gridMode: mode }),
      
      activeCell: null,
      setActiveCell: (cell) => set({ activeCell: cell }),
      
      coordColumnVisibility: {},
      setCoordColumnVisibility: (projectId, updater) => set((state) => {
        const oldState = state.coordColumnVisibility[projectId] || {};
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          coordColumnVisibility: {
            ...state.coordColumnVisibility,
            [projectId]: newState
          }
        };
      }),
      
      coordColumnOrder: {},
      setCoordColumnOrder: (projectId, updater) => set((state) => {
        const oldState = state.coordColumnOrder[projectId] || DEFAULT_COORD_COLUMN_ORDER as unknown as string[];
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          coordColumnOrder: {
            ...state.coordColumnOrder,
            [projectId]: newState
          }
        };
      }),
      
      coordinationViewMode: 'table-split',
      setCoordinationViewMode: (mode) => set({ coordinationViewMode: mode }),

      veGridViewMode: 'split',
      setVeGridViewMode: (mode) => set({ veGridViewMode: mode }),

      activeView: {},
      setActiveView: (projectId, view) => set((state) => ({
        activeView: { ...state.activeView, [projectId]: view },
      })),

      activeSettingsTab: {},
      setActiveSettingsTab: (projectId, tab) => set((state) => ({
        activeSettingsTab: { ...state.activeSettingsTab, [projectId]: tab },
      })),

      navigateToSettings: (projectId, tab) => set((state) => ({
        activeView: { ...state.activeView, [projectId]: 'settings' },
        activeSettingsTab: { ...state.activeSettingsTab, [projectId]: tab },
      })),
      
      isBudgetSummaryCollapsed: false,
      toggleBudgetSummary: () => set((state) => ({ isBudgetSummaryCollapsed: !state.isBudgetSummaryCollapsed })),
      
      isCoordSummaryCollapsed: false,
      toggleCoordSummary: () => set((state) => ({ isCoordSummaryCollapsed: !state.isCoordSummaryCollapsed })),
      
      isPermitSummaryCollapsed: false,
      togglePermitSummary: () => set((state) => ({ isPermitSummaryCollapsed: !state.isPermitSummaryCollapsed })),
      
      permitViewMode: 'table-split',
      setPermitViewMode: (mode) => set({ permitViewMode: mode }),
      
      permitFilters: {},
      setPermitFilters: (projectId, filters) => set((state) => ({
        permitFilters: {
          ...state.permitFilters,
          [projectId]: filters
        }
      })),
      
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
      
      setCompareQueue: (queue) => set({ compareQueue: queue }),
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
        isPermitSummaryCollapsed: state.isPermitSummaryCollapsed ?? false,
        permitViewMode: state.permitViewMode ?? 'table-split',
        permitFilters: state.permitFilters ?? {},
        // Navigation persistence (v2+)
        activeView: state.activeView ?? {},
        activeSettingsTab: state.activeSettingsTab ?? {},
        veGridViewMode: state.veGridViewMode ?? 'split',
      }),
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<UIState>;
        if (version < 1) {
          // v0 → v1: wipe legacy flat objects to prevent schema corruption
          return {
            ...state,
            gridColumnVisibility: {},
            gridColumnOrder: {},
            coordColumnVisibility: {},
            coordColumnOrder: {},
            permitFilters: {},
            // Also initialise v2 fields for users upgrading straight from v0
            activeView: {},
            activeSettingsTab: {},
            veGridViewMode: 'split' as VEGridViewMode,
          } as UIState;
        }
        if (version < 2) {
          // v1 → v2: add navigation persistence fields
          return {
            ...state,
            activeView: {},
            activeSettingsTab: {},
            veGridViewMode: 'split' as VEGridViewMode,
          } as UIState;
        }
        return state as UIState;
      },
    }
  )
);
