import { create } from 'zustand';

export const useUIStore = create((set) => ({
  selectedOpportunityId: null,
  setSelectedOpportunityId: (id) => set({ selectedOpportunityId: id }),
}));
