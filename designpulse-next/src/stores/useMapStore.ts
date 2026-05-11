import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useUIStore } from '@/stores/useUIStore';
import { MapState, ToolMode, Point } from '@/types/map.types';

// C35: Only base modes are persisted to sessionStorage. Transient interaction
// modes (select, multi_select, add_node, delete_node, stamp) intentionally
// excluded — user always returns to a safe base mode on reload.
const PERSISTED_TOOL_MODES = new Set<ToolMode>(['pan', 'draw', 'edit']);

function isToolMode(v: string | undefined): v is ToolMode {
  return !!v && PERSISTED_TOOL_MODES.has(v as ToolMode);
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      // Tool State
      toolMode: 'pan',
      setToolMode: (mode: ToolMode | ((prev: ToolMode) => ToolMode)) => set((state) => ({ toolMode: typeof mode === 'function' ? mode(state.toolMode) : mode })),

      // Selection State
      selectedZoneIds: [],
      setSelectedZoneIds: (ids: string[] | ((prev: string[]) => string[])) => {
        const state = useMapStore.getState();
        const nextIds = typeof ids === 'function' ? ids(state.selectedZoneIds) : ids;
        // Shallow array equality — avoids O(n) JSON.stringify on every call
        if (nextIds.length === state.selectedZoneIds.length &&
            nextIds.every((id, i) => id === state.selectedZoneIds[i])) return;

        set({ selectedZoneIds: nextIds });

        if (nextIds.length === 1) {
          useUIStore.getState().setSelectedOpportunityId(nextIds[0]);
        } else if (nextIds.length === 0) {
          useUIStore.getState().setSelectedOpportunityId(null);
        }
      },
      toggleSelectedZoneId: (id: string) => {
        const state = useMapStore.getState();
        const isSelected = state.selectedZoneIds.includes(id);
        const nextIds = isSelected
          ? state.selectedZoneIds.filter(zid => zid !== id)
          : [...state.selectedZoneIds, id];

        set({ selectedZoneIds: nextIds });

        if (nextIds.length === 1) {
          useUIStore.getState().setSelectedOpportunityId(nextIds[0]);
        } else if (nextIds.length === 0) {
          useUIStore.getState().setSelectedOpportunityId(null);
        }
      },
      clearSelectedZones: () => {
        const state = useMapStore.getState();
        if (state.selectedZoneIds.length === 0) return;

        set({ selectedZoneIds: [] });
        useUIStore.getState().setSelectedOpportunityId(null);
      },

      editingZoneId: null,
      setEditingZoneId: (id: string | null | ((prev: string | null) => string | null)) => set((state) => ({ editingZoneId: typeof id === 'function' ? id(state.editingZoneId) : id })),

      // Active Sheet State
      activeSheetId: '',
      setActiveSheetId: (id: string | ((prev: string) => string)) => set((state) => ({ activeSheetId: typeof id === 'function' ? id(state.activeSheetId) : id })),

      savingZoneId: null,
      setSavingZoneId: (val: string | null | ((prev: string | null) => string | null)) => set((state) => ({ savingZoneId: typeof val === 'function' ? val(state.savingZoneId) : val })),

      pendingPolygonPoints: null,
      setPendingPolygonPoints: (val: Point[] | null | ((prev: Point[] | null) => Point[] | null)) => set((state) => ({ pendingPolygonPoints: typeof val === 'function' ? val(state.pendingPolygonPoints) : val })),
    }),
    {
      name: 'designpulse-map-session',
      storage: createJSONStorage(() => sessionStorage),
      version: 2,  // Bumped from 1 (AGENTS.md C34) — removes selectedFile, pdfPageNumber, isUploading
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // Strip dead fields from v1 stored state to prevent undefined reads
          const { selectedFile: _sf, pdfPageNumber: _pn, isUploading: _iu, ...rest } = state;
          void _sf; void _pn; void _iu; // suppress unused-var lint
          return {
            ...rest,
            activeSheetId: (rest.activeSheetId as string) || '',
            toolMode: isToolMode(rest.toolMode as string) ? (rest.toolMode as ToolMode) : 'pan',
          };
        }
        return {
          ...state,
          // Re-validate toolMode even if version matches to prevent corrupt session storage
          toolMode: isToolMode(state.toolMode as string) ? (state.toolMode as ToolMode) : 'pan',
        } as MapState;
      },
      partialize: (state) => ({
        activeSheetId: state.activeSheetId,
        toolMode: state.toolMode
      })
    }
  )
);
