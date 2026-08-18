import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProfileState {
  name: string;
  setName: (name: string) => void;
  timeZones: string[];
  setTimeZones: (zones: string[]) => void;
}

function clampZones(zones: string[]): string[] {
  return [...new Set(zones)];
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      name: "",
      setName: (name) => set({ name }),
      timeZones: [],
      setTimeZones: (zones) => set({ timeZones: clampZones(zones) }),
    }),
    { name: "rw-profile" },
  ),
);