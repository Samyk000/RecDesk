import { create } from "zustand";

interface CandidateDrawerState {
  candidateId: string | null;
  openCandidateDrawer: (candidateId: string) => void;
  closeCandidateDrawer: () => void;
}

export const useCandidateDrawer = create<CandidateDrawerState>((set) => ({
  candidateId: null,
  openCandidateDrawer: (candidateId) => set({ candidateId }),
  closeCandidateDrawer: () => set({ candidateId: null }),
}));
