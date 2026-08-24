import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  FileDoc,
  FilePdf,
  FileText,
  DownloadSimple,
  X,
  CloudArrowUp,
  SpinnerGap,
  WarningCircle,
  Columns,
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  ListBullets,
  ListNumbers,
  ArrowCounterClockwise,
  ArrowClockwise,
  Eraser,
  Minus,
  Plus,
  Lightning,
  Sparkle,
  CaretDown,
  Check,
  Gear,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { apiFiles } from "../../lib/api";
import { extractPdfToHtml } from "../../lib/pdfExtractor";
import {
  htmlToTextLines,
  plainTextToLines,
} from "../../lib/resumeSectionParser";
import {
  chunkDocumentIntoBlocks,
  parseResumeWithBlockIdAI,
  parseResumeWithLocalEngine,
  reassembleHtmlFromBlocks,
} from "../../lib/blockIdResumeParser";
import { convertHtmlToDocxBytes } from "../../lib/docxExport";
import { fetchOpenRouterModels } from "../../lib/openRouterClient";
import { useAiModels } from "../../hooks/useQueries";
import { useOpenRouterStore } from "../../store/openRouterStore";
import { useResumeFormatterStore } from "../../store/resumeFormatterStore";
import { useAiStore } from "../../store/ai";
import { errorMessage } from "../../lib/utils";
import mammoth from "mammoth";

// TipTap custom extension for inline font size
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const FONT_FAMILIES = [
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, serif" },
];

const FONT_SIZES = [
  { label: "10 pt", value: "10pt" },
  { label: "11 pt", value: "11pt" },
  { label: "12 pt", value: "12pt" },
  { label: "14 pt", value: "14pt" },
  { label: "16 pt", value: "16pt" },
  { label: "18 pt", value: "18pt" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ResumeFormatterModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const {
    apiKeys,
    selectedModel,
    modelsCache,
    activeProvider,
    setActiveProvider,
    setSelectedModel,
  } = useOpenRouterStore();

  const { selectedModelId, setSelectedModelId } = useAiStore();
  const { data: aiModels } = useAiModels();
  const isModelDownloaded = useCallback(
    (id: string) => aiModels?.some((m) => m.id === id && m.is_downloaded) ?? false,
    [aiModels]
  );
  const currentLocalModelDownloaded = isModelDownloaded(selectedModelId);

  const [showAiPicker, setShowAiPicker] = useState(false);
  const aiPickerRef = useRef<HTMLDivElement>(null);

  const [openRouterSearch, setOpenRouterSearch] = useState("");

  // Auto-fetch OpenRouter models if cache is empty when popover opens
  useEffect(() => {
    if (showAiPicker && activeProvider === "openrouter" && modelsCache.length === 0) {
      fetchOpenRouterModels().catch(() => {});
    }
  }, [showAiPicker, activeProvider, modelsCache.length]);

  const FALLBACK_FREE_MODELS = useMemo(
    () => [
      { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)", desc: "Meta · 128k context" },
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)", desc: "Google · Fast multimodal" },
      { id: "google/gemini-2.0-flash-thinking-exp:free", name: "Gemini 2.0 Flash Thinking (Free)", desc: "Google · Deep reasoning" },
      { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B (Free)", desc: "Alibaba · High reasoning" },
      { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", desc: "DeepSeek · Reasoning model" },
      { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3 (Free)", desc: "DeepSeek · General purpose" },
      { id: "mistralai/mistral-small-24b-instruct-2501:free", name: "Mistral Small 24B (Free)", desc: "Mistral AI · 32k context" },
      { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (Free)", desc: "Meta · Lightweight" },
      { id: "microsoft/phi-3-medium-128k-instruct:free", name: "Phi-3 Medium (Free)", desc: "Microsoft · 128k context" },
      { id: "cognitivecomputations/dolphin3.0-r1-mistral-24b:free", name: "Dolphin 3.0 R1 24B (Free)", desc: "Uncensored · Reasoning" },
    ],
    []
  );

  const freeCloudModels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; desc: string }>();

    for (const m of FALLBACK_FREE_MODELS) {
      map.set(m.id, m);
    }

    for (const m of modelsCache) {
      if (m.is_free || m.id.endsWith(":free")) {
        const cleanName = m.name.replace(/\(free\)/i, "").replace(/:free$/i, "").trim() + " (Free)";
        const existing = map.get(m.id);
        map.set(m.id, {
          id: m.id,
          name: cleanName,
          desc: m.description
            ? m.description.slice(0, 42) + (m.description.length > 42 ? "…" : "")
            : existing?.desc || m.id.split("/")[0] || "Free Cloud Model",
        });
      }
    }

    const list = Array.from(map.values());

    if (!openRouterSearch.trim()) return list;

    const q = openRouterSearch.toLowerCase();
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q)
    );
  }, [FALLBACK_FREE_MODELS, modelsCache, openRouterSearch]);

  useEffect(() => {
    if (!showAiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (aiPickerRef.current && !aiPickerRef.current.contains(e.target as Node)) {
        setShowAiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAiPicker]);

  const {
    step,
    processingMessage,
    detectedCandidateName,
    originalRawText,
    formattedHtml,
    selectedFont,
    selectedSize,
    scale,
    showOriginal,
    error,
    setStep,
    setProcessing,
    setDetectedCandidateName,
    setOriginalRawText,
    setFormattedHtml,
    setSelectedFont,
    setSelectedSize,
    setScale,
    setShowOriginal,
    setError,
    resetFormatter,
  } = useResumeFormatterStore();

  const [downloading, setDownloading] = useState(false);

  // TipTap Word-like editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-6 my-2 space-y-1",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal pl-6 my-2 space-y-1",
          },
        },
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily.configure({ types: ["textStyle"] }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Formatted resume content…" }),
    ],
    content: formattedHtml || "",
    onUpdate: ({ editor }) => {
      setFormattedHtml(editor.getHTML());
    },
  });

  // Sync editor content whenever formattedHtml is populated from background processing
  useEffect(() => {
    if (editor && !editor.isDestroyed && formattedHtml && editor.getHTML() !== formattedHtml) {
      editor.commands.setContent(formattedHtml);
      editor.chain().focus().setFontFamily(selectedFont).run();
    }
  }, [editor, formattedHtml, selectedFont]);

  const activeModelDisplay = useMemo(() => {
    if (activeProvider === "local") {
      const localNames: Record<string, string> = {
        "qwen-0.5b": "Local AI (Qwen 0.5B)",
        "qwen-1.5b": "Local AI (Qwen 1.5B)",
        "qwen-3b": "Local AI (Qwen 3B)",
      };
      return localNames[selectedModelId] || "Local AI Engine";
    }
    const found = modelsCache.find((m) => m.id === selectedModel);
    let name = found ? found.name : selectedModel.split("/").pop() || selectedModel;
    name = name.replace(/\(free\)/i, "").replace(/:free$/i, "").trim();
    return name;
  }, [activeProvider, selectedModelId, selectedModel, modelsCache]);

  const handleReset = useCallback(() => {
    resetFormatter();
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent("");
    }
  }, [resetFormatter, editor]);

  const processResumeFile = useCallback(
    async (filePath: string) => {
      setStep("processing");
      setProcessing(true, "Reading resume file…");
      setError(null);

      try {
        const bytes = await apiFiles.readResumeBytes(filePath);
        const data = new Uint8Array(bytes);
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

        setProcessing(true, "Extracting text content…");

        let textLines;
        let rawExtractedText = "";

        if (ext === "pdf") {
          const result = await extractPdfToHtml(data);
          if (result.isScanned || result.textCharCount < 40) {
            setError(
              "This resume appears to be a scanned image. Please provide a text-based PDF or DOCX file."
            );
            setProcessing(false);
            setStep("upload");
            return;
          }
          textLines = htmlToTextLines(result.html);
          rawExtractedText = textLines.map((l) => l.text).join("\n");
        } else if (ext === "docx" || ext === "doc") {
          const safeBuffer = data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength
          );
          const result = await mammoth.convertToHtml({ arrayBuffer: safeBuffer });
          if (!result.value || result.value.trim().length < 20) {
            setError("Could not extract readable text from this document.");
            setProcessing(false);
            setStep("upload");
            return;
          }
          textLines = htmlToTextLines(result.value);
          rawExtractedText = textLines.map((l) => l.text).join("\n");
        } else {
          // Plain text / RTF
          const rawText = new TextDecoder().decode(data);
          if (rawText.trim().length < 20) {
            setError("The uploaded file appears to be empty.");
            setProcessing(false);
            setStep("upload");
            return;
          }
          rawExtractedText = rawText;
          textLines = plainTextToLines(rawText);
        }

        if (textLines.length < 2) {
          setError("Insufficient text content extracted from document.");
          setProcessing(false);
          setStep("upload");
          return;
        }

        setOriginalRawText(rawExtractedText);

        // Step 1: Chunk document into indexed text blocks
        const blocks = chunkDocumentIntoBlocks(textLines);

        let finalFormattedHtml = "";
        let candidateName = "Candidate";

        // Step 2: Use AI Block-ID Cognitive Engine based on selected provider
        const openRouterState = useOpenRouterStore.getState();
        const provider = openRouterState.activeProvider;
        const effectiveKeys = openRouterState.apiKeys;
        const effectiveModel = selectedModel || openRouterState.selectedModel;

        if (provider === "openrouter" && effectiveKeys.length > 0) {
          setProcessing(true, `AI analyzing structure (${activeModelDisplay})…`);
          try {
            const { structure, rawBlocks } = await parseResumeWithBlockIdAI(
              blocks,
              effectiveModel
            );
            candidateName = structure.candidate_name || "Candidate";
            finalFormattedHtml = reassembleHtmlFromBlocks(structure, rawBlocks);
          } catch (aiErr: any) {
            console.warn("OpenRouter AI parsing failed, seamlessly falling back to Local AI Engine:", aiErr);
            toast.warning(
              aiErr.message?.includes("429") || aiErr.message?.includes("credit")
                ? "OpenRouter credits/rate limit reached. Seamlessly formatted with Local Engine."
                : `AI Note: ${aiErr.message || "Using Local Engine fallback."}`
            );
            setProcessing(true, "Formatting with Local AI Engine…");
            const structure = parseResumeWithLocalEngine(blocks, textLines);
            candidateName = structure.candidate_name || "Candidate";
            finalFormattedHtml = reassembleHtmlFromBlocks(structure, blocks);
          }
        } else {
          // Local AI Engine is active (Offline, zero credits needed, 100% private)
          setProcessing(true, `Formatting with ${activeModelDisplay}…`);
          const structure = parseResumeWithLocalEngine(blocks, textLines);
          candidateName = structure.candidate_name || "Candidate";
          finalFormattedHtml = reassembleHtmlFromBlocks(structure, blocks);
        }

        setDetectedCandidateName(candidateName);
        setFormattedHtml(finalFormattedHtml);

        if (editor && !editor.isDestroyed) {
          editor.commands.setContent(finalFormattedHtml);
          editor.chain().focus().setFontFamily(FONT_FAMILIES[0].value).run();
        }

        setProcessing(false);
        setStep("editor");
      } catch (err) {
        console.error("Resume formatting error:", err);
        setError(errorMessage(err));
        setProcessing(false);
        setStep("upload");
      }
    },
    [
      editor,
      apiKeys,
      selectedModel,
      activeModelDisplay,
      setStep,
      setProcessing,
      setError,
      setOriginalRawText,
      setDetectedCandidateName,
      setFormattedHtml,
    ]
  );

  const handleFileSelect = useCallback(async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Resume", extensions: ["pdf", "docx", "doc", "txt", "rtf"] }],
      });

      if (!selected) return;
      const filePath = typeof selected === "string" ? selected : selected[0];
      if (filePath) {
        await processResumeFile(filePath);
      }
    } catch (err) {
      console.error("Open file error:", err);
      setError(errorMessage(err));
    }
  }, [processResumeFile, setError]);

  const handleDownload = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;

    setDownloading(true);
    try {
      const currentHtml = editor.getHTML();
      const safeName = (detectedCandidateName || "Candidate")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      const defaultFilename = `${safeName || "Candidate"}_Formatted.docx`;

      const savePath = await saveDialog({
        defaultPath: defaultFilename,
        filters: [{ name: "Word Document", extensions: ["docx"] }],
      });

      if (!savePath) {
        setDownloading(false);
        return;
      }

      // Convert current editor HTML directly to DOCX bytes
      const docxBytes = await convertHtmlToDocxBytes(currentHtml);
      await apiFiles.writeResumeBytes(savePath, docxBytes);

      toast.success("Formatted resume downloaded successfully!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error(`Failed to save: ${errorMessage(err)}`);
    } finally {
      setDownloading(false);
    }
  }, [editor, detectedCandidateName]);

  // Keyboard shortcut Ctrl+S / Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleDownload();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleDownload, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative flex flex-col w-full ${
          showOriginal ? "max-w-6xl" : "max-w-4xl"
        } h-[88vh] max-h-[900px] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden transition-all duration-200`}
      >
        {/* ─── Top Header Bar ────────────────────────────────────────────── */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileDoc className="h-4 w-4 text-primary shrink-0" weight="duotone" />
            <span className="text-[13px] font-bold text-fg shrink-0 tracking-tight">RecDesk Formatter</span>

            {/* Interactive AI Engine Selector */}
            <div className="relative shrink-0" ref={aiPickerRef}>
              <button
                type="button"
                onClick={() => setShowAiPicker((v) => !v)}
                className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition-all cursor-pointer select-none ${
                  activeProvider === "local"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                    : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                title="Select AI Provider & Model (Local AI / OpenRouter)"
              >
                {activeProvider === "local" ? (
                  <Lightning className="h-2.5 w-2.5 text-amber-400 shrink-0" weight="fill" />
                ) : (
                  <Sparkle className="h-2.5 w-2.5 text-primary shrink-0" weight="fill" />
                )}
                <span className="truncate max-w-[125px]">{activeModelDisplay}</span>
                <CaretDown
                  className={`h-2.5 w-2.5 transition-transform duration-200 ${
                    showAiPicker ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Popover */}
              {showAiPicker && (
                <div className="absolute left-0 top-full mt-1.5 z-60 w-80 rounded-xl border border-border bg-surface shadow-2xl p-2.5 animate-scale-in text-fg">
                  {/* Header */}
                  <div className="flex items-center justify-between px-1 pb-1.5 border-b border-border/60">
                    <span className="text-[11px] font-bold text-fg">AI Engine Selector</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAiPicker(false);
                        onClose();
                        navigate("/settings");
                      }}
                      className="flex items-center gap-1 text-[10.5px] text-fg-muted hover:text-primary transition-colors cursor-pointer"
                    >
                      <Gear className="h-3 w-3" />
                      <span>Settings</span>
                    </button>
                  </div>

                  {/* Provider Switcher Tabs */}
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-hover/80 p-1 my-2">
                    <button
                      type="button"
                      onClick={() => setActiveProvider("local")}
                      className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                        activeProvider === "local"
                          ? "bg-surface text-amber-300 shadow-xs border border-amber-500/20"
                          : "text-fg-muted hover:text-fg"
                      }`}
                    >
                      <Lightning className="h-3 w-3 text-amber-400" weight="fill" />
                      <span>Local AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveProvider("openrouter")}
                      className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                        activeProvider === "openrouter"
                          ? "bg-surface text-primary shadow-xs border border-primary/20"
                          : "text-fg-muted hover:text-fg"
                      }`}
                    >
                      <Sparkle className="h-3 w-3 text-primary" weight="fill" />
                      <span>OpenRouter</span>
                    </button>
                  </div>

                  {/* Provider Content */}
                  {activeProvider === "local" ? (
                    <div className="space-y-1 pt-0.5">
                      <div className="px-1 text-[10px] text-fg-subtle font-medium uppercase tracking-wider mb-1">
                        Local GGUF Models
                      </div>
                      {[
                        { id: "qwen-1.5b", name: "Qwen 2.5 1.5B", tag: "Recommended · Balanced", size: "1.1 GB" },
                        { id: "qwen-0.5b", name: "Qwen 2.5 0.5B", tag: "Ultra-Fast · Low RAM", size: "468 MB" },
                        { id: "qwen-3b", name: "Qwen 2.5 3B", tag: "High Precision", size: "2.2 GB" },
                      ].map((m) => {
                        const downloaded = isModelDownloaded(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedModelId(m.id);
                              setShowAiPicker(false);
                            }}
                            className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                              selectedModelId === m.id
                                ? "bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20"
                                : "hover:bg-surface-hover text-fg"
                            }`}
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11.5px] leading-tight font-medium">{m.name}</span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                                    downloaded
                                      ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                                      : "bg-surface-hover text-fg-subtle font-normal"
                                  }`}
                                >
                                  {downloaded ? "Ready" : m.size}
                                </span>
                              </div>
                              <span className="text-[9.5px] text-fg-subtle">{m.tag}</span>
                            </div>
                            {selectedModelId === m.id && (
                              <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" weight="bold" />
                            )}
                          </button>
                        );
                      })}

                      {!currentLocalModelDownloaded ? (
                        <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                          <div className="flex items-center gap-1.5 font-medium">
                            <WarningCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Model not downloaded</span>
                          </div>
                          <p className="text-[10px] text-amber-300/80 mt-0.5">
                            Download model in Settings to enable offline LLM inference.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAiPicker(false);
                              onClose();
                              navigate("/settings");
                            }}
                            className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-amber-300 underline hover:text-amber-200 cursor-pointer"
                          >
                            <span>Open Settings to Download →</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1 px-1 text-[10px] text-emerald-400/90 flex items-center gap-1">
                          <span>🛡️ 100% offline & private · Zero credits</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center justify-between px-1 text-[10px] text-fg-subtle font-medium uppercase tracking-wider">
                        <span>Free Cloud Models ({freeCloudModels.length})</span>
                        <span className="text-fg-subtle lowercase">
                          {apiKeys.length} key{apiKeys.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {apiKeys.length === 0 ? (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-center text-[11px] text-amber-300">
                          <p className="font-medium">No API keys saved</p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAiPicker(false);
                              onClose();
                              navigate("/settings");
                            }}
                            className="mt-1.5 inline-block text-[10.5px] font-semibold text-primary underline hover:text-primary-hover cursor-pointer"
                          >
                            Add OpenRouter key in Settings →
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Search Bar for Free Models */}
                          <div className="relative px-0.5">
                            <MagnifyingGlass className="absolute left-2.5 top-2 h-3.5 w-3.5 text-fg-subtle" />
                            <input
                              type="text"
                              placeholder="Search free models…"
                              value={openRouterSearch}
                              onChange={(e) => setOpenRouterSearch(e.target.value)}
                              className="w-full h-7 pl-7 pr-2 text-xs rounded-lg border border-border bg-surface-hover/60 placeholder:text-fg-subtle text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          {/* Scrollable Free Model List */}
                          <div className="max-h-52 overflow-y-auto scrollbar-thin pr-1 space-y-1">
                            {freeCloudModels.length === 0 ? (
                              <div className="py-4 text-center text-xs text-fg-subtle">
                                No matching free models found
                              </div>
                            ) : (
                              freeCloudModels.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedModel(m.id);
                                    setShowAiPicker(false);
                                  }}
                                  className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                    selectedModel === m.id
                                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                                      : "hover:bg-surface-hover text-fg"
                                  }`}
                                >
                                  <div className="flex flex-col min-w-0 pr-1.5">
                                    <span className="text-[11.5px] truncate font-medium">{m.name}</span>
                                    <span className="text-[9.5px] text-fg-subtle truncate">{m.desc}</span>
                                  </div>
                                  {selectedModel === m.id && (
                                    <Check className="h-3.5 w-3.5 text-primary shrink-0" weight="bold" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {detectedCandidateName && detectedCandidateName !== "Candidate" && (
              <span className="truncate max-w-[140px] text-[11.5px] text-fg-subtle font-normal shrink" title={detectedCandidateName}>
                · {detectedCandidateName}
              </span>
            )}
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {step === "editor" && (
              <>
                {/* Zoom Controls */}
                <div className="flex h-6 items-center gap-0.5 rounded border border-border bg-surface-hover/70 px-1 text-fg-muted">
                  <button
                    onClick={() => setScale((s) => Math.max(0.6, +(s - 0.1).toFixed(2)))}
                    title="Zoom out"
                    className="rounded p-0.5 hover:bg-surface-active text-fg-subtle hover:text-fg cursor-pointer"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="min-w-[28px] text-center font-mono text-[10px] tabular-nums font-semibold text-fg">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale((s) => Math.min(1.5, +(s + 0.1).toFixed(2)))}
                    title="Zoom in"
                    className="rounded p-0.5 hover:bg-surface-active text-fg-subtle hover:text-fg cursor-pointer"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>

                {/* Show Original Toggle */}
                <button
                  onClick={() => setShowOriginal((s) => !s)}
                  className={`cursor-pointer inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium border transition-colors ${
                    showOriginal
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-surface hover:bg-surface-hover text-fg-muted hover:text-fg"
                  }`}
                  title="Toggle side-by-side comparison"
                >
                  <Columns className="h-3 w-3" />
                  <span>{showOriginal ? "Hide Original" : "Show Original"}</span>
                </button>

                <button
                  onClick={handleReset}
                  className="cursor-pointer inline-flex h-6 items-center rounded border border-border bg-surface px-2 text-[11px] font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
                >
                  Format Another
                </button>

                {/* Download DOCX Button */}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="cursor-pointer inline-flex h-6 items-center gap-1 rounded bg-primary px-2.5 text-[11px] font-semibold text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {downloading ? (
                    <SpinnerGap className="h-3 w-3 animate-spin" />
                  ) : (
                    <DownloadSimple className="h-3 w-3" weight="bold" />
                  )}
                  <span>Download .docx</span>
                </button>
              </>
            )}

            <div className="h-3 w-px bg-border mx-0.5" />

            <button
              onClick={onClose}
              className="cursor-pointer flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
              title="Close / Minimize (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ─── Ribbon Formatting Toolbar ────────────────────────────────── */}
        {step === "editor" && editor && (
          <div className="relative z-30 flex flex-wrap items-center gap-1 border-b border-border bg-surface-active/60 px-3 py-1.5 text-fg shadow-xs select-none">
            {/* Font Family */}
            <select
              value={selectedFont}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFont(val);
                editor.chain().focus().setFontFamily(val).run();
              }}
              className="h-6.5 rounded border border-border bg-surface px-1.5 text-xs font-medium text-fg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Font Size */}
            <select
              value={selectedSize}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSize(val);
                (editor.chain().focus() as any).setMark("textStyle", { fontSize: val }).run();
              }}
              className="h-6.5 rounded border border-border bg-surface px-1.5 text-xs font-medium text-fg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {FONT_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="h-3.5 w-px bg-border mx-0.5" />

            {/* Bold, Italic, Underline, Strike */}
            <div className="flex items-center gap-0.5 rounded border border-border bg-surface p-0.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive("bold") ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Bold (Ctrl+B)"
              >
                <TextB className="h-3.5 w-3.5 font-bold" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive("italic") ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Italic (Ctrl+I)"
              >
                <TextItalic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive("underline") ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Underline (Ctrl+U)"
              >
                <TextUnderline className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive("strike") ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Strikethrough"
              >
                <TextStrikethrough className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-3.5 w-px bg-border mx-0.5" />

            {/* Heading Levels */}
            <div className="flex items-center gap-0.5 rounded border border-border bg-surface p-0.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`rounded px-1.5 py-0.5 text-xs font-bold transition-colors ${
                  editor.isActive("heading", { level: 1 })
                    ? "bg-primary text-white"
                    : "hover:bg-surface-hover text-fg"
                }`}
                title="Name Heading (H1)"
              >
                H1
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`rounded px-1.5 py-0.5 text-xs font-bold transition-colors ${
                  editor.isActive("heading", { level: 2 })
                    ? "bg-primary text-white"
                    : "hover:bg-surface-hover text-fg"
                }`}
                title="Section Heading (H2)"
              >
                H2
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                  editor.isActive("paragraph")
                    ? "bg-primary text-white font-medium"
                    : "hover:bg-surface-hover text-fg"
                }`}
                title="Normal paragraph"
              >
                P
              </button>
            </div>

            <div className="h-3.5 w-px bg-border mx-0.5" />

            {/* Lists */}
            <div className="flex items-center gap-0.5 rounded border border-border bg-surface p-0.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive("bulletList") ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Bullet List"
              >
                <ListBullets className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive("orderedList") ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Numbered List"
              >
                <ListNumbers className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-3.5 w-px bg-border mx-0.5" />

            {/* Alignments */}
            <div className="flex items-center gap-0.5 rounded border border-border bg-surface p-0.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive({ textAlign: "left" }) ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Align Left"
              >
                <TextAlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive({ textAlign: "center" }) ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Align Center"
              >
                <TextAlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive({ textAlign: "right" }) ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Align Right"
              >
                <TextAlignRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setTextAlign("justify").run()}
                className={`rounded p-1 transition-colors ${
                  editor.isActive({ textAlign: "justify" }) ? "bg-primary text-white" : "hover:bg-surface-hover text-fg"
                }`}
                title="Justify"
              >
                <TextAlignJustify className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-3.5 w-px bg-border mx-0.5" />

            {/* Undo / Redo / Clear */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="rounded p-1 text-fg hover:bg-surface-hover disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <ArrowCounterClockwise className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="rounded p-1 text-fg hover:bg-surface-hover disabled:opacity-30"
                title="Redo (Ctrl+Y)"
              >
                <ArrowClockwise className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                className="rounded p-1 text-fg hover:bg-surface-hover"
                title="Clear Formatting"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Main Viewport ─────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8 bg-surface-hover/20">
              <div className="flex flex-col items-center gap-4 max-w-md w-full">
                {/* Compact AI Provider Switcher Bar */}
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface-hover/50 p-1 w-full shadow-xs">
                    <button
                      type="button"
                      onClick={() => setActiveProvider("local")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-semibold transition-all cursor-pointer ${
                        activeProvider === "local"
                          ? "bg-surface text-amber-300 shadow-xs border border-amber-500/20"
                          : "text-fg-muted hover:text-fg hover:bg-surface/50"
                      }`}
                    >
                      <Lightning className="h-3.5 w-3.5 text-amber-400" weight="fill" />
                      <span>Local AI</span>
                      <span className="text-[10px] text-fg-subtle font-normal">
                        ({selectedModelId === "qwen-0.5b" ? "0.5B" : selectedModelId === "qwen-3b" ? "3B" : "1.5B"})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveProvider("openrouter")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-semibold transition-all cursor-pointer ${
                        activeProvider === "openrouter"
                          ? "bg-surface text-primary shadow-xs border border-primary/20"
                          : "text-fg-muted hover:text-fg hover:bg-surface/50"
                      }`}
                    >
                      <Sparkle className="h-3.5 w-3.5 text-primary" weight="fill" />
                      <span>OpenRouter</span>
                      <span className="text-[10px] text-fg-subtle font-normal">(Cloud)</span>
                    </button>
                  </div>

                  {activeProvider === "local" ? (
                    currentLocalModelDownloaded ? (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/90 font-medium">
                        <span>🛡️ 100% offline & private · Zero credits required (Model Ready)</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                        <div className="flex items-center gap-2">
                          <WarningCircle className="h-4 w-4 shrink-0 text-amber-400" />
                          <span className="text-[11.5px]">
                            <strong>{selectedModelId === "qwen-0.5b" ? "Qwen 2.5 0.5B" : selectedModelId === "qwen-3b" ? "Qwen 2.5 3B" : "Qwen 2.5 1.5B"}</strong> is not downloaded
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate("/settings");
                          }}
                          className="text-[11px] font-semibold text-amber-300 underline hover:text-amber-200 shrink-0 cursor-pointer"
                        >
                          Download in Settings →
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-between px-1 text-[11px] text-fg-subtle">
                      <span>
                        {apiKeys.length > 0
                          ? `✨ ${apiKeys.length} API key(s) active · Auto fallback`
                          : "⚠️ No OpenRouter keys configured"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate("/settings");
                        }}
                        className="text-primary hover:underline font-medium cursor-pointer"
                      >
                        {apiKeys.length === 0 ? "Add key in Settings →" : "Settings →"}
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={handleFileSelect}
                  className="group cursor-pointer flex w-full flex-col items-center gap-3.5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-surface/50 hover:bg-surface px-8 py-10 transition-all shadow-md"
                >
                  <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <CloudArrowUp className="h-6.5 w-6.5" weight="duotone" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-medium text-fg group-hover:text-primary transition-colors">
                      Click to select candidate resume
                    </p>
                    <p className="text-xs text-fg-subtle">
                      PDF, DOCX, DOC, TXT
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-fg-subtle pt-1">
                    <FilePdf className="h-4 w-4" />
                    <FileDoc className="h-4 w-4" />
                    <FileText className="h-4 w-4" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === "processing" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface-hover/20">
              <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-fg-muted font-medium">{processingMessage}</p>
            </div>
          )}

          {/* Editor Step */}
          {step === "editor" && (
            <div className="flex h-full w-full overflow-hidden">
              {/* Left Pane: Original Resume */}
              {showOriginal && (
                <div className="flex w-1/2 flex-col border-r border-border bg-surface overflow-hidden">
                  <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-surface-hover px-3">
                    <span className="text-[11px] font-semibold text-fg-muted">
                      Original Source Document
                    </span>
                    <span className="text-[10px] text-fg-subtle">Reference only</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 font-mono text-xs leading-relaxed text-fg-muted select-text whitespace-pre-wrap scrollbar-thin">
                    {originalRawText || "No source text available."}
                  </div>
                </div>
              )}

              {/* Right Pane (or Full Width): Document Canvas with consistent margins */}
              <div
                className={`flex-1 overflow-y-auto bg-zinc-900/95 scrollbar-thin px-4 py-8 pb-32 ${
                  showOriginal ? "w-1/2" : "w-full"
                }`}
              >
                {/* Paper Document Container — Word Narrow 0.5-inch margins */}
                <div
                  className="mx-auto w-full bg-white text-black shadow-2xl rounded-xs border border-black/10 px-8 py-8 md:px-10 md:py-10 transition-transform origin-top"
                  style={{
                    maxWidth: showOriginal ? "100%" : "816px",
                    minHeight: "1080px",
                    transform: scale !== 1.0 ? `scale(${scale})` : undefined,
                    transformOrigin: "top center",
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    boxSizing: "border-box",
                  }}
                >
                  <EditorContent
                    editor={editor}
                    className="tiptap-client-editor focus:outline-none w-full bg-white text-black min-h-[900px]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <style>{`
          .tiptap-client-editor {
            width: 100%;
            box-sizing: border-box;
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .tiptap-client-editor .ProseMirror {
            outline: none;
            width: 100%;
            min-height: 900px;
            box-sizing: border-box;
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: 'Times New Roman', serif;
            font-size: 10pt;
            line-height: 1.4;
            word-break: break-word;
            overflow-wrap: break-word;
          }
          .tiptap-client-editor .ProseMirror * {
            color: #000000 !important;
            box-sizing: border-box;
          }
          .tiptap-client-editor .ProseMirror h1 {
            font-size: 11pt;
            font-weight: bold;
            text-align: center;
            margin-top: 0;
            margin-bottom: 12px;
            line-height: 1.25;
          }
          .tiptap-client-editor .ProseMirror h2 {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 12px;
            margin-bottom: 3px;
            line-height: 1.3;
          }
          .tiptap-client-editor .ProseMirror p {
            font-size: 10pt;
            margin-top: 2px;
            margin-bottom: 3px;
            line-height: 1.4;
          }
          .tiptap-client-editor .ProseMirror ul {
            font-size: 10pt;
            list-style-type: disc;
            padding-left: 20px;
            margin-top: 2px;
            margin-bottom: 3px;
          }
          .tiptap-client-editor .ProseMirror ol {
            font-size: 10pt;
            list-style-type: decimal;
            padding-left: 20px;
            margin-top: 2px;
            margin-bottom: 3px;
          }
          .tiptap-client-editor .ProseMirror li {
            font-size: 10pt;
            margin-bottom: 2px;
            line-height: 1.4;
          }
        `}</style>
      </div>
    </div>
  );
}
