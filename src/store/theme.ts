import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode, ThemeName } from "../types";

interface ThemeState {
  mode: ThemeMode;
  theme: ThemeName;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: ThemeName) => void;
}

const THEME_CLASSES = [
  "dark",
  "theme-blue",
  "theme-teal",
  "theme-violet",
  "theme-sunset",
  "theme-forest",
  "theme-rose",
  "theme-emerald",
  "theme-amber",
  "theme-slate",
] as const;

const THEMES: ThemeName[] = [
  "blue",
  "teal",
  "violet",
  "sunset",
  "forest",
  "rose",
  "emerald",
  "amber",
  "slate",
];

function legacyTheme(value: unknown): ThemeName {
  if (value === "sunset" || value === "forest" || value === "teal" || value === "violet" || value === "rose") {
    return value as ThemeName;
  }
  if (value === "orange") return "sunset";
  if (value === "olive") return "forest";
  return "blue";
}

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode, theme: ThemeName) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  if (mode === "dark" || (mode === "system" && resolve(mode) === "dark")) {
    root.classList.add("dark");
  }
  root.classList.add(`theme-${theme}`);
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",
      theme: "blue",
      resolved: resolve("dark"),
      setMode: (mode) => {
        const resolved = resolve(mode);
        set({ mode, resolved });
        applyTheme(mode, get().theme);
      },
      setTheme: (theme) => {
        set({ theme });
        applyTheme(get().mode, theme);
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
            theme: legacyTheme(legacy),
            resolved: "dark",
          };
        }
        return {
          ...p,
          mode: ["light", "dark", "system"].includes(p.mode as string) ? (p.mode as ThemeMode) : "dark",
          theme: THEMES.includes(p.theme as ThemeName)
            ? (p.theme as ThemeName)
            : legacyTheme(p.accent),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolve(state.mode ?? "dark");
          state.resolved = resolved;
          applyTheme(state.mode ?? "dark", state.theme ?? "blue");
        }
      },
    },
  ),
);

export function initTheme() {
  const { mode, theme } = useTheme.getState();
  applyTheme(mode, theme);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    const { mode, theme } = useTheme.getState();
    if (mode === "system") {
      const r = resolve(mode);
      useTheme.setState({ resolved: r });
      applyTheme(mode, theme);
    }
  });
}