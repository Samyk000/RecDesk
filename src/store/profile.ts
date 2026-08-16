import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProfileState {
  name: string;
  setName: (name: string) => void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      name: "",
      setName: (name) => set({ name }),
    }),
    { name: "rw-profile" },
  ),
);