import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_COORD_COLUMN_ORDER, DEFAULT_KEY_DATES_COLUMN_ORDER } from '@/lib/constants';
import { useMapStore } from '@/stores/useMapStore';

// ── Navigation domain types ───────────────────────────────────────────────────
export type ProjectView =
  | 'dashboard'
  | 'dashboard-v2'
  | 'budget-compare'
  | 'map'
  | 'analytics'
  | 'coordination'
  | 'permits'
  | 'deliverables'
  | 'my-desk'
  | 'settings'
  | 'lessons'
  | 'key-dates'
  | 'scenario-planner';

export type SettingsTab =
  | 'info'
  | 'team'
  | 'building_areas'
  | 'categories'
  | 'drawings'
  | 'csi_specs'
  | 'estimate'
  | 'sidebar'
  | 've_matrix'
  | 'coord_matrix'
  | 'brand_standards'
  | 'permits'
  | 'packages';

// Flat view mode — matches coordinationViewMode / permitViewMode store pattern
export type VEGridViewMode = 'split' | 'flat' | 'card';

// Flat view mode for Projects / Clients dashboard
export type DashboardViewMode = 'card' | 'table';

export interface PermitFilters {
  status?: string[];
  type?: string[];
  ahj?: string[];
}

export interface DeliverableFilters {
  status?: string[];
  isKeyDate?: boolean;
}

export interface UIState {
  selectedOpportunityId: string | null;
  setSelectedOpportunityId: (id: string | null) => void;
  
  selectedDrawingId: string | null;
  setSelectedDrawingId: (id: string | null) => void;
  
  cardOrder: string[];
  setCardOrder: (newOrder: string[]) => void;
  
  visibleCards: Record<string, boolean>;
  toggleCardVisibility: (cardId: string) => void;
  
  // Unified column visibility for OpportunityGridV2 (serves both Value Matrix and Budget Ledger)
  gridV2ColumnVisibility: Record<string, Record<string, boolean>>;
  setGridV2ColumnVisibility: (projectId: string, updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;
  
  gridColumnPinningOverrides: Record<string, { pinned: string[]; unpinned: string[] }>;
  toggleUserColumnPin: (projectId: string, columnId: string, isPinned: boolean) => void;
  clearUserColumnPinOverrides: (projectId: string) => void;
  
  permitColumnPinningOverrides: Record<string, { pinned: string[]; unpinned: string[] }>;
  togglePermitColumnPin: (projectId: string, columnId: string, isPinned: boolean) => void;
  clearPermitColumnPinOverrides: (projectId: string) => void;
  
  deliverablesColumnPinningOverrides: Record<string, { pinned: string[]; unpinned: string[] }>;
  toggleDeliverablesColumnPin: (projectId: string, columnId: string, isPinned: boolean) => void;
  clearDeliverablesColumnPinOverrides: (projectId: string) => void;
  
  keyDatesColumnPinningOverrides: Record<string, { pinned: string[]; unpinned: string[] }>;
  toggleKeyDatesColumnPin: (projectId: string, columnId: string, isPinned: boolean) => void;
  clearKeyDatesColumnPinOverrides: (projectId: string) => void;
  
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

  drawingGridViewMode: 'split' | 'flat';
  setDrawingGridViewMode: (mode: 'split' | 'flat') => void;

  lessonsViewMode: 'split' | 'flat';
  setLessonsViewMode: (mode: 'split' | 'flat') => void;

  lessonsColumnVisibility: Record<string, Record<string, boolean>>;
  setLessonsColumnVisibility: (projectId: string, updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;

  // Dashboard view mode
  dashboardViewMode: DashboardViewMode;
  setDashboardViewMode: (mode: DashboardViewMode) => void;

  // Per-project navigation persistence
  activeView: Record<string, ProjectView>;
  setActiveView: (projectId: string, view: ProjectView) => void;

  activeSettingsTab: Record<string, SettingsTab>;
  setActiveSettingsTab: (projectId: string, tab: SettingsTab) => void;

  // Atomic compound action — updates both fields in a single set() call to prevent flash
  navigateToSettings: (projectId: string, tab: SettingsTab) => void;

  isBudgetSummaryCollapsed: boolean;
  toggleBudgetSummary: () => void;
  setBudgetSummaryCollapsed: (v: boolean) => void;
  
  isBudgetAnalyticsFullscreen: boolean;
  setBudgetAnalyticsFullscreen: (v: boolean) => void;
  
  isCoordSummaryCollapsed: boolean;
  toggleCoordSummary: () => void;
  
  isPermitSummaryCollapsed: boolean;
  togglePermitSummary: () => void;
  
  permitViewMode: 'board' | 'table-split';
  setPermitViewMode: (mode: 'board' | 'table-split') => void;
  
  permitFilters: Record<string, PermitFilters>;
  setPermitFilters: (projectId: string, filters: PermitFilters) => void;
  
  permitColumnVisibility: Record<string, import('@tanstack/react-table').VisibilityState>;
  setPermitColumnVisibility: (projectId: string, updater: import('@tanstack/react-table').VisibilityState | ((old: import('@tanstack/react-table').VisibilityState) => import('@tanstack/react-table').VisibilityState)) => void;
  
  permitColumnOrder: Record<string, string[]>;
  setPermitColumnOrder: (projectId: string, updater: string[] | ((old: string[]) => string[])) => void;
  
  isMapVisible: boolean;
  toggleMapVisibility: () => void;
  
  brandStandardsColumnVisibility: Record<string, import('@tanstack/react-table').VisibilityState>;
  setBrandStandardsColumnVisibility: (clientId: string, updater: import('@tanstack/react-table').VisibilityState | ((old: import('@tanstack/react-table').VisibilityState) => import('@tanstack/react-table').VisibilityState)) => void;
  
  brandStandardsColumnOrder: Record<string, string[]>;
  setBrandStandardsColumnOrder: (clientId: string, updater: string[] | ((old: string[]) => string[])) => void;

  versionMatrixColumnVisibility: Record<string, Record<string, boolean>>;
  setVersionMatrixColumnVisibility: (projectId: string, updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;

  deliverablesViewMode: 'board' | 'table-split';
  setDeliverablesViewMode: (mode: 'board' | 'table-split') => void;

  deliverablesColumnVisibility: Record<string, Record<string, boolean>>;
  setDeliverablesColumnVisibility: (projectId: string, updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;

  deliverablesColumnOrder: Record<string, string[]>;
  setDeliverablesColumnOrder: (projectId: string, updater: string[] | ((old: string[]) => string[])) => void;

  deliverablesFilters: Record<string, DeliverableFilters>;
  setDeliverablesFilters: (projectId: string, filters: DeliverableFilters) => void;

  keyDatesColumnVisibility: Record<string, Record<string, boolean>>;
  setKeyDatesColumnVisibility: (projectId: string, updater: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => void;

  keyDatesColumnOrder: Record<string, string[]>;
  setKeyDatesColumnOrder: (projectId: string, updater: string[] | ((old: string[]) => string[])) => void;

  keyDatesViewMode: 'table' | 'calendar';
  setKeyDatesViewMode: (mode: 'table' | 'calendar') => void;

  // VE Sandbox Packages panel
  isSandboxPanelOpen: boolean;
  toggleSandboxPanel: () => void;
  setSandboxPanelOpen: (v: boolean) => void;
  activeSandboxPackageId: string | null;
  setActiveSandboxPackageId: (id: string | null) => void;

  // Gold-Standard Filter Workspace linkage (v17)
  isFilterLinkingEnabled: boolean;
  setFilterLinkingEnabled: (enabled: boolean) => void;
  globalBuildingAreas: string[];
  setGlobalBuildingAreas: (areas: string[]) => void;
  globalCostCodes: string[];
  setGlobalCostCodes: (codes: string[]) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedOpportunityId: null,
      setSelectedOpportunityId: (id) => {
        const currentId = useUIStore.getState().selectedOpportunityId;
        if (currentId === id) return;
        set({ selectedOpportunityId: id });
        if (id) {
          useMapStore.getState().setSelectedZoneIds([id]);
        } else {
          useMapStore.getState().clearSelectedZones();
        }
      },
      
      selectedDrawingId: null,
      setSelectedDrawingId: (id) => {
        const currentId = useUIStore.getState().selectedDrawingId;
        if (currentId === id) return;
        set({ selectedDrawingId: id });
      },
      
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
      
      
      gridV2ColumnVisibility: {},
      setGridV2ColumnVisibility: (projectId, updater) => set((state) => {
        const oldState = state.gridV2ColumnVisibility[projectId] || {};
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          gridV2ColumnVisibility: {
            ...state.gridV2ColumnVisibility,
            [projectId]: newState
          }
        };
      }),
      
      gridColumnPinningOverrides: {},
      toggleUserColumnPin: (projectId, columnId, isPinned) => set((state) => {
        const current = state.gridColumnPinningOverrides[projectId] || { pinned: [], unpinned: [] };
        
        let newPinned = current.pinned.filter(id => id !== columnId);
        let newUnpinned = current.unpinned.filter(id => id !== columnId);
        
        if (isPinned) {
          newPinned.push(columnId);
        } else {
          newUnpinned.push(columnId);
        }
        
        return {
          gridColumnPinningOverrides: {
            ...state.gridColumnPinningOverrides,
            [projectId]: { pinned: newPinned, unpinned: newUnpinned }
          }
        };
      }),
      
      clearUserColumnPinOverrides: (projectId) => set((state) => {
        const newOverrides = { ...state.gridColumnPinningOverrides };
        delete newOverrides[projectId];
        return { gridColumnPinningOverrides: newOverrides };
      }),

      permitColumnPinningOverrides: {},
      togglePermitColumnPin: (projectId, columnId, isPinned) => set((state) => {
        const current = state.permitColumnPinningOverrides[projectId] || { pinned: [], unpinned: [] };
        
        let newPinned = current.pinned.filter(id => id !== columnId);
        let newUnpinned = current.unpinned.filter(id => id !== columnId);
        
        if (isPinned) {
          newPinned.push(columnId);
        } else {
          newUnpinned.push(columnId);
        }
        
        return {
          permitColumnPinningOverrides: {
            ...state.permitColumnPinningOverrides,
            [projectId]: { pinned: newPinned, unpinned: newUnpinned }
          }
        };
      }),
      
      clearPermitColumnPinOverrides: (projectId) => set((state) => {
        const newOverrides = { ...state.permitColumnPinningOverrides };
        delete newOverrides[projectId];
        return { permitColumnPinningOverrides: newOverrides };
      }),

      deliverablesColumnPinningOverrides: {},
      toggleDeliverablesColumnPin: (projectId, columnId, isPinned) => set((state) => {
        const current = state.deliverablesColumnPinningOverrides[projectId] || { pinned: [], unpinned: [] };
        
        let newPinned = current.pinned.filter(id => id !== columnId);
        let newUnpinned = current.unpinned.filter(id => id !== columnId);
        
        if (isPinned) {
          newPinned.push(columnId);
        } else {
          newUnpinned.push(columnId);
        }
        
        return {
          deliverablesColumnPinningOverrides: {
            ...state.deliverablesColumnPinningOverrides,
            [projectId]: { pinned: newPinned, unpinned: newUnpinned }
          }
        };
      }),
      
      clearDeliverablesColumnPinOverrides: (projectId) => set((state) => {
        const newOverrides = { ...state.deliverablesColumnPinningOverrides };
        delete newOverrides[projectId];
        return { deliverablesColumnPinningOverrides: newOverrides };
      }),

      keyDatesColumnPinningOverrides: {},
      toggleKeyDatesColumnPin: (projectId, columnId, isPinned) => set((state) => {
        const current = state.keyDatesColumnPinningOverrides[projectId] || { pinned: [], unpinned: [] };
        
        let newPinned = current.pinned.filter(id => id !== columnId);
        let newUnpinned = current.unpinned.filter(id => id !== columnId);
        
        if (isPinned) {
          newPinned.push(columnId);
        } else {
          newUnpinned.push(columnId);
        }
        
        return {
          keyDatesColumnPinningOverrides: {
            ...state.keyDatesColumnPinningOverrides,
            [projectId]: { pinned: newPinned, unpinned: newUnpinned }
          }
        };
      }),
      
      clearKeyDatesColumnPinOverrides: (projectId) => set((state) => {
        const newOverrides = { ...state.keyDatesColumnPinningOverrides };
        delete newOverrides[projectId];
        return { keyDatesColumnPinningOverrides: newOverrides };
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
        if (
          oldState.length === newState.length &&
          oldState.every((val, idx) => val === newState[idx])
        ) {
          return {};
        }
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

      drawingGridViewMode: 'split',
      setDrawingGridViewMode: (mode) => set({ drawingGridViewMode: mode }),

      lessonsViewMode: 'split',
      setLessonsViewMode: (mode) => set({ lessonsViewMode: mode }),

      lessonsColumnVisibility: {},
      setLessonsColumnVisibility: (projectId, updater) => set((state) => {
        const oldState = state.lessonsColumnVisibility?.[projectId] || {};
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          lessonsColumnVisibility: {
            ...state.lessonsColumnVisibility,
            [projectId]: newState
          }
        };
      }),

      dashboardViewMode: 'card',
      setDashboardViewMode: (mode) => set({ dashboardViewMode: mode }),

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
      setBudgetSummaryCollapsed: (v: boolean) => set({ isBudgetSummaryCollapsed: v }),
      
      isBudgetAnalyticsFullscreen: false,
      setBudgetAnalyticsFullscreen: (v) => set({ isBudgetAnalyticsFullscreen: v }),
      
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

      permitColumnVisibility: {},
      setPermitColumnVisibility: (projectId, updater) => set(state => ({
        permitColumnVisibility: {
          ...state.permitColumnVisibility,
          [projectId]: typeof updater === 'function' ? updater(state.permitColumnVisibility[projectId] || {}) : updater
        }
      })),

      permitColumnOrder: {},
      setPermitColumnOrder: (projectId, updater) => set(state => {
        const oldState = state.permitColumnOrder[projectId] || [];
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        if (
          oldState.length === newState.length &&
          oldState.every((val, idx) => val === newState[idx])
        ) {
          return {};
        }
        return {
          permitColumnOrder: {
            ...state.permitColumnOrder,
            [projectId]: newState
          }
        };
      }),
      
      setCardOrder: (newOrder) => set({ cardOrder: newOrder }),
      
      toggleCardVisibility: (cardId) => set((state) => ({
        visibleCards: {
          ...state.visibleCards,
          [cardId]: !state.visibleCards[cardId]
        }
      })),
      
      isMapVisible: false,
      toggleMapVisibility: () => set((state) => ({ isMapVisible: !state.isMapVisible })),
      
      
      brandStandardsColumnVisibility: {},
      setBrandStandardsColumnVisibility: (clientId, updater) => set(state => ({
        brandStandardsColumnVisibility: {
          ...state.brandStandardsColumnVisibility,
          [clientId]: typeof updater === 'function' ? updater(state.brandStandardsColumnVisibility[clientId] || {}) : updater
        }
      })),

      brandStandardsColumnOrder: {},
      setBrandStandardsColumnOrder: (clientId, updater) => set(state => {
        const oldState = state.brandStandardsColumnOrder[clientId] || [];
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        if (
          oldState.length === newState.length &&
          oldState.every((val, idx) => val === newState[idx])
        ) {
          return {};
        }
        return {
          brandStandardsColumnOrder: {
            ...state.brandStandardsColumnOrder,
            [clientId]: newState
          }
        };
      }),
      
      versionMatrixColumnVisibility: {},
      setVersionMatrixColumnVisibility: (projectId, updater) => set((state) => {
        const oldState = state.versionMatrixColumnVisibility?.[projectId] || {};
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          versionMatrixColumnVisibility: {
            ...state.versionMatrixColumnVisibility,
            [projectId]: newState
          }
        };
      }),

      deliverablesViewMode: 'table-split',
      setDeliverablesViewMode: (mode) => set({ deliverablesViewMode: mode }),

      deliverablesColumnVisibility: {},
      setDeliverablesColumnVisibility: (projectId, updater) => set((state) => {
        const oldState = state.deliverablesColumnVisibility?.[projectId] || {};
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          deliverablesColumnVisibility: {
            ...state.deliverablesColumnVisibility,
            [projectId]: newState
          }
        };
      }),

      deliverablesColumnOrder: {},
      setDeliverablesColumnOrder: (projectId, updater) => set((state) => {
        const oldState = state.deliverablesColumnOrder?.[projectId] || [];
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        if (
          oldState.length === newState.length &&
          oldState.every((val, idx) => val === newState[idx])
        ) {
          return {};
        }
        return {
          deliverablesColumnOrder: {
            ...state.deliverablesColumnOrder,
            [projectId]: newState
          }
        };
      }),

      deliverablesFilters: {},
      setDeliverablesFilters: (projectId, filters) => set((state) => ({
        deliverablesFilters: {
          ...state.deliverablesFilters,
          [projectId]: filters
        }
      })),

      keyDatesColumnVisibility: {},
      setKeyDatesColumnVisibility: (projectId, updater) => set((state) => {
        const oldState = state.keyDatesColumnVisibility?.[projectId] || {};
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        return {
          keyDatesColumnVisibility: {
            ...state.keyDatesColumnVisibility,
            [projectId]: newState
          }
        };
      }),

      keyDatesColumnOrder: {},
      setKeyDatesColumnOrder: (projectId, updater) => set((state) => {
        const oldState = state.keyDatesColumnOrder?.[projectId] || (DEFAULT_KEY_DATES_COLUMN_ORDER as unknown as string[]);
        const newState = typeof updater === 'function' ? updater(oldState) : updater;
        if (
          oldState.length === newState.length &&
          oldState.every((val, idx) => val === newState[idx])
        ) {
          return {};
        }
        return {
          keyDatesColumnOrder: {
            ...state.keyDatesColumnOrder,
            [projectId]: newState
          }
        };
      }),

      keyDatesViewMode: 'table',
      setKeyDatesViewMode: (mode) => set({ keyDatesViewMode: mode }),

      // VE Sandbox Packages panel
      isSandboxPanelOpen: false,
      toggleSandboxPanel: () => set((state) => ({ isSandboxPanelOpen: !state.isSandboxPanelOpen })),
      setSandboxPanelOpen: (v) => set({ isSandboxPanelOpen: v }),
      activeSandboxPackageId: null,
      setActiveSandboxPackageId: (id) => set({ activeSandboxPackageId: id }),

      // Gold-Standard Filter Workspace linkage (v17)
      isFilterLinkingEnabled: true,
      setFilterLinkingEnabled: (enabled) => set({ isFilterLinkingEnabled: enabled }),
      globalBuildingAreas: [],
      setGlobalBuildingAreas: (areas) => set({ globalBuildingAreas: areas }),
      globalCostCodes: [],
      setGlobalCostCodes: (codes) => set({ globalCostCodes: codes }),
    }),
    {
      name: 'design-pulse-ui-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cardOrder: state.cardOrder,
        visibleCards: state.visibleCards,
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
        drawingGridViewMode: state.drawingGridViewMode ?? 'split',
        gridColumnPinningOverrides: state.gridColumnPinningOverrides ?? {},
        gridV2ColumnVisibility: state.gridV2ColumnVisibility ?? {},
        dashboardViewMode: state.dashboardViewMode ?? 'card',
        lessonsViewMode: state.lessonsViewMode ?? 'split',
        lessonsColumnVisibility: state.lessonsColumnVisibility ?? {},
        permitColumnVisibility: state.permitColumnVisibility ?? {},
        permitColumnOrder: state.permitColumnOrder ?? {},
        brandStandardsColumnVisibility: state.brandStandardsColumnVisibility ?? {},
        brandStandardsColumnOrder: state.brandStandardsColumnOrder ?? {},
        versionMatrixColumnVisibility: state.versionMatrixColumnVisibility ?? {},
        deliverablesViewMode: state.deliverablesViewMode ?? 'table-split',
        deliverablesColumnVisibility: state.deliverablesColumnVisibility ?? {},
        deliverablesColumnOrder: state.deliverablesColumnOrder ?? {},
        deliverablesFilters: state.deliverablesFilters ?? {},
        keyDatesColumnVisibility: state.keyDatesColumnVisibility ?? {},
        keyDatesColumnOrder: state.keyDatesColumnOrder ?? {},
        keyDatesViewMode: state.keyDatesViewMode ?? 'table',
        isSandboxPanelOpen: state.isSandboxPanelOpen ?? false,
        permitColumnPinningOverrides: state.permitColumnPinningOverrides ?? {},
        deliverablesColumnPinningOverrides: state.deliverablesColumnPinningOverrides ?? {},
        keyDatesColumnPinningOverrides: state.keyDatesColumnPinningOverrides ?? {},
        // Persist v17 workspace filters
        isFilterLinkingEnabled: state.isFilterLinkingEnabled ?? true,
        globalBuildingAreas: state.globalBuildingAreas ?? [],
        globalCostCodes: state.globalCostCodes ?? [],
      }),
      version: 17,
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
        if (version < 3) {
          // v2 → v3: add grid column pinning overrides
          return {
            ...state,
            gridColumnPinningOverrides: {},
          } as UIState;
        }
        if (version < 4) {
          // v3 → v4: add dashboardViewMode
          return {
            ...state,
            dashboardViewMode: 'card' as DashboardViewMode,
          } as UIState;
        }
        if (version < 5) {
          // v4 → v5: isolate V2 grid visibility from V1 to prevent cross-pollution
          return {
            ...state,
            gridV2ColumnVisibility: {},
          } as UIState;
        }
        if (version < 6) {
          // v5 → v6: added 'budget-compare' to ProjectView union (no shape change)
          return state as UIState;
        }
        if (version < 7) {
          // v6 → v7: added lessonsViewMode and lessonsColumnVisibility
          return {
            ...state,
            lessonsViewMode: 'split',
            lessonsColumnVisibility: {}
          } as UIState;
        }
        if (version < 8) {
          // v7 → v8: added permitColumnVisibility and permitColumnOrder
          return {
            ...state,
            permitColumnVisibility: {},
            permitColumnOrder: {}
          } as UIState;
        }
        if (version < 9) {
          // v8 → v9: added brandStandardsColumnVisibility and brandStandardsColumnOrder
          return {
            ...state,
            brandStandardsColumnVisibility: {},
            brandStandardsColumnOrder: {}
          } as UIState;
        }
        if (version < 10) {
          // v9 → v10: V1 OpportunityGrid deprecated — remove compareQueue, gridColumnVisibility, gridColumnOrder
          const s = state as Record<string, unknown>;
          delete s.compareQueue;
          delete s.gridColumnVisibility;
          delete s.gridColumnOrder;
          s.versionMatrixColumnVisibility = {};
          return s as unknown as UIState;
        }
        if (version < 11) {
          // v10 → v11: added versionMatrixColumnVisibility
          return {
            ...state,
            versionMatrixColumnVisibility: {},
          } as UIState;
        }
        if (version < 12) {
          // v11 → v12: added deliverables view preferences
          return {
            ...state,
            deliverablesViewMode: 'table-split',
            deliverablesColumnVisibility: {},
            deliverablesColumnOrder: {},
            deliverablesFilters: {},
          } as unknown as UIState;
        }
        if (version < 13) {
          // v12 → v13: added key dates view preferences
          return {
            ...state,
            keyDatesColumnVisibility: {},
            keyDatesColumnOrder: {},
          } as unknown as UIState;
        }
        if (version < 14) {
          // v13 → v14: added VE Sandbox Packages panel state
          return {
            ...state,
            isSandboxPanelOpen: false,
            activeSandboxPackageId: null,
          } as unknown as UIState;
        }
        if (version < 15) {
          // v14 → v15: added scenario-planner view + packages settings tab — no new persisted fields
          return state as UIState;
        }
        if (version < 16) {
          // v15 → v16: added permit, deliverables, and keyDates column pinning overrides
          return {
            ...state,
            permitColumnPinningOverrides: {},
            deliverablesColumnPinningOverrides: {},
            keyDatesColumnPinningOverrides: {},
          } as unknown as UIState;
        }
        if (version < 17) {
          // v16 → v17: added filter workspace linking preferences
          return {
            ...state,
            isFilterLinkingEnabled: true,
            globalBuildingAreas: [],
            globalCostCodes: [],
          } as unknown as UIState;
        }
        return state as UIState;
      },
    }
  )
);
