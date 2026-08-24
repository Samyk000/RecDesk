import { create } from "zustand";

export type FormatterStep = "upload" | "processing" | "editor";

interface ResumeFormatterState {
  isOpen: boolean;
  isProcessing: boolean;
  step: FormatterStep;
  processingMessage: string;
  detectedCandidateName: string;
  originalRawText: string;
  formattedHtml: string;
  selectedFont: string;
  selectedSize: string;
  scale: number;
  showOriginal: boolean;
  error: string | null;

  openModal: () => void;
  closeModal: () => void;
  setStep: (step: FormatterStep) => void;
  setProcessing: (isProcessing: boolean, message?: string) => void;
  setProcessingMessage: (message: string) => void;
  setDetectedCandidateName: (name: string) => void;
  setOriginalRawText: (text: string) => void;
  setFormattedHtml: (html: string) => void;
  setSelectedFont: (font: string) => void;
  setSelectedSize: (size: string) => void;
  setScale: (scale: number | ((s: number) => number)) => void;
  setShowOriginal: (show: boolean | ((s: boolean) => boolean)) => void;
  setError: (error: string | null) => void;
  resetFormatter: () => void;
}

export const useResumeFormatterStore = create<ResumeFormatterState>((set) => ({
  isOpen: false,
  isProcessing: false,
  step: "upload",
  processingMessage: "Analyzing resume…",
  detectedCandidateName: "Candidate",
  originalRawText: "",
  formattedHtml: "",
  selectedFont: "Times New Roman, serif",
  selectedSize: "10pt",
  scale: 1.0,
  showOriginal: false,
  error: null,

  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
  setStep: (step) => set({ step }),
  setProcessing: (isProcessing, message) =>
    set((state) => ({
      isProcessing,
      processingMessage: message !== undefined ? message : state.processingMessage,
    })),
  setProcessingMessage: (processingMessage) => set({ processingMessage }),
  setDetectedCandidateName: (detectedCandidateName) => set({ detectedCandidateName }),
  setOriginalRawText: (originalRawText) => set({ originalRawText }),
  setFormattedHtml: (formattedHtml) => set({ formattedHtml }),
  setSelectedFont: (selectedFont) => set({ selectedFont }),
  setSelectedSize: (selectedSize) => set({ selectedSize }),
  setScale: (scale) =>
    set((state) => ({
      scale: typeof scale === "function" ? scale(state.scale) : scale,
    })),
  setShowOriginal: (showOriginal) =>
    set((state) => ({
      showOriginal: typeof showOriginal === "function" ? showOriginal(state.showOriginal) : showOriginal,
    })),
  setError: (error) => set({ error }),
  resetFormatter: () =>
    set({
      step: "upload",
      isProcessing: false,
      processingMessage: "Analyzing resume…",
      detectedCandidateName: "Candidate",
      originalRawText: "",
      formattedHtml: "",
      error: null,
      showOriginal: false,
      scale: 1.0,
    }),
}));
