import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeAccent, ThemeMode } from "../types";

interface ThemeState {
  mode: ThemeMode;
  accent: ThemeAccent;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
}

const THEME_CLASSES = ["dark", "theme-orange", "theme-gray", "theme-olive"] as const;

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode, accent: ThemeAccent) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  if (mode === "dark" || (mode === "system" && resolve(mode) === "dark")) {
    root.classList.add("dark");
  }
  if (accent !== "default") {
    root.classList.add(`theme-${accent}`);
  }
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",
      accent: "default",
      resolved: resolve("dark"),
      setMode: (mode) => {
        const resolved = resolve(mode);
        set({ mode, resolved });
        applyTheme(mode, get().accent);
      },
      setAccent: (accent) => {
        set({ accent });
        applyTheme(get().mode, accent);
      },
    }),
    {
      name: "rw-theme",
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        const legacy = p.mode;
        if (legacy === "orange" || legacy === "gray" || legacy === "olive") {
          return {
            ...p,
            mode: "dark",
            accent: legacy as ThemeAccent,
            resolved: "dark",
          };
        }
        return {
          ...p,
          mode: ["light", "dark", "system"].includes(p.mode as string) ? (p.mode as ThemeMode) : "dark",
          accent: ["orange", "gray", "olive"].includes(p.accent as string) ? (p.accent as ThemeAccent) : "default",
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolve(state.mode ?? "dark");
          state.resolved = resolved;
          applyTheme(state.mode ?? "dark", state.accent ?? "default");
        }
      },
    },
  ),
);

export function initTheme() {
  const { mode, accent } = useTheme.getState();
  applyTheme(mode, accent);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    const { mode, accent } = useTheme.getState();
    if (mode === "system") {
      const r = resolve(mode);
      useTheme.setState({ resolved: r });
      applyTheme(mode, accent);
    }
  });
}