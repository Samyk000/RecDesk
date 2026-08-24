import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  is_free?: boolean;
}

interface OpenRouterState {
  apiKeyInput: string;
  apiKeys: string[];
  selectedModel: string;
  activeProvider: "openrouter" | "local";
  freeOnlyFilter: boolean;
  modelsCache: OpenRouterModel[];
  lastFetched: number | null;
  connectionStatus: "untested" | "checking" | "connected" | "error";
  connectionError: string | null;

  setApiKeyInput: (input: string) => void;
  setSelectedModel: (modelId: string) => void;
  setActiveProvider: (provider: "openrouter" | "local") => void;
  setFreeOnlyFilter: (freeOnly: boolean) => void;
  setModelsCache: (models: OpenRouterModel[]) => void;
  setConnectionStatus: (status: "untested" | "checking" | "connected" | "error", error?: string | null) => void;
  getActiveApiKey: () => string | null;
  rotateApiKey: (failedKey: string) => string | null;
}

export const DEFAULT_FREE_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export const useOpenRouterStore = create<OpenRouterState>()(
  persist(
    (set, get) => ({
      apiKeyInput: "",
      apiKeys: [],
      selectedModel: DEFAULT_FREE_MODEL,
      activeProvider: "openrouter",
      freeOnlyFilter: true,
      modelsCache: [],
      lastFetched: null,
      connectionStatus: "untested",
      connectionError: null,

      setApiKeyInput: (input: string) => {
        const keys = input
          .split(/[\n,;]+/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
        set({
          apiKeyInput: input,
          apiKeys: keys,
          connectionStatus: keys.length > 0 ? get().connectionStatus : "untested",
          connectionError: null,
        });
      },

      setSelectedModel: (modelId: string) => set({ selectedModel: modelId }),
      setActiveProvider: (provider: "openrouter" | "local") => set({ activeProvider: provider }),
      setFreeOnlyFilter: (freeOnly: boolean) => set({ freeOnlyFilter: freeOnly }),
      setModelsCache: (models: OpenRouterModel[]) =>
        set({ modelsCache: models, lastFetched: Date.now() }),
      setConnectionStatus: (status, error = null) =>
        set({ connectionStatus: status, connectionError: error }),

      getActiveApiKey: () => {
        const keys = get().apiKeys;
        if (keys.length === 0) return null;
        return keys[0];
      },

      rotateApiKey: (failedKey: string) => {
        const keys = get().apiKeys;
        if (keys.length <= 1) return keys[0] || null;
        // Move failed key to the end
        const remaining = keys.filter((k) => k !== failedKey);
        const reordered = [...remaining, failedKey];
        set({
          apiKeys: reordered,
          apiKeyInput: reordered.join("\n"),
        });
        return reordered[0];
      },
    }),
    {
      name: "recdesk-openrouter-settings",
      partialize: (state) => ({
        apiKeyInput: state.apiKeyInput,
        apiKeys: state.apiKeys,
        selectedModel: state.selectedModel,
        activeProvider: state.activeProvider,
        freeOnlyFilter: state.freeOnlyFilter,
        modelsCache: state.modelsCache,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
