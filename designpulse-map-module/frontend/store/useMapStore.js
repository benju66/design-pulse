import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useMapStore = create(
  persist(
    (set) => ({
  // Tool State
  toolMode: 'pan',
  setToolMode: (mode) => set((state) => ({ toolMode: typeof mode === 'function' ? mode(state.toolMode) : mode })),


  // Selection State
  selectedZoneIds: [],
  setSelectedZoneIds: (ids) => set((state) => ({ selectedZoneIds: typeof ids === 'function' ? ids(state.selectedZoneIds) : ids })),
  toggleSelectedZoneId: (id) => set((state) => ({
    selectedZoneIds: state.selectedZoneIds.includes(id)
      ? state.selectedZoneIds.filter(zid => zid !== id)
      : [...state.selectedZoneIds, id]
  })),
  clearSelectedZones: () => set({ selectedZoneIds: [] }),

  editingZoneId: null,
  setEditingZoneId: (id) => set((state) => ({ editingZoneId: typeof id === 'function' ? id(state.editingZoneId) : id })),

  // Active Sheet State
  activeSheetId: '',
  setActiveSheetId: (id) => set((state) => ({ activeSheetId: typeof id === 'function' ? id(state.activeSheetId) : id })),

  savingZoneId: null,
  setSavingZoneId: (val) => set((state) => ({ savingZoneId: typeof val === 'function' ? val(state.savingZoneId) : val })),

  pendingPolygonPoints: null,
  setPendingPolygonPoints: (val) => set((state) => ({ pendingPolygonPoints: typeof val === 'function' ? val(state.pendingPolygonPoints) : val })),

  selectedFile: null,
  setSelectedFile: (val) => set((state) => ({ selectedFile: typeof val === 'function' ? val(state.selectedFile) : val })),

  pdfPageNumber: 1,
  setPdfPageNumber: (val) => set((state) => ({ pdfPageNumber: typeof val === 'function' ? val(state.pdfPageNumber) : val })),

  isUploading: false,
  setIsUploading: (val) => set((state) => ({ isUploading: typeof val === 'function' ? val(state.isUploading) : val })),
    }),
    {
      name: 'designpulse-map-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        activeSheetId: state.activeSheetId,
        toolMode: state.toolMode
      })
    }
  )
);
