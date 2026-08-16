import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode } from "../types";

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      resolved: resolve("dark"),
      setMode: (mode) => {
        const resolved = resolve(mode);
        set({ mode, resolved });
        applyTheme(resolved);
      },
    }),
    {
      name: "rw-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolve(state.mode);
          state.resolved = resolved;
          applyTheme(resolved);
        }
      },
    },
  ),
);

export function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
}

export function initTheme() {
  const { mode } = useTheme.getState();
  applyTheme(resolve(mode));
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    const { mode } = useTheme.getState();
    if (mode === "system") {
      const r = resolve(mode);
      useTheme.setState({ resolved: r });
      applyTheme(r);
    }
  });
}