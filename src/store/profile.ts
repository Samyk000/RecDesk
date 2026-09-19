import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProfileState {
  timeZones: string[];
  setTimeZones: (zones: string[]) => void;
}

function clampZones(zones: string[]): string[] {
  return [...new Set(zones)];
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      timeZones: [],
      setTimeZones: (zones) => set({ timeZones: clampZones(zones) }),
    }),
    { name: "rw-profile" },
  ),
);