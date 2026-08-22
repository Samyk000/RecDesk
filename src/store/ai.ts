import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AiState {
  isAiEnabled: boolean;
  setIsAiEnabled: (enabled: boolean) => void;
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      isAiEnabled: true,
      setIsAiEnabled: (enabled) => set({ isAiEnabled: enabled }),
      selectedModelId: "qwen-1.5b",
      setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
    }),
    { name: "recdesk-ai-settings" },
  ),
);
