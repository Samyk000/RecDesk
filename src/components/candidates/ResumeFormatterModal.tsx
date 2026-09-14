import { useState, useCallback, useEffect, useMemo } from "react";
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
  Minus,
  Plus,
  Sparkle,
} from "@phosphor-icons/react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ModelSelectorDropdown } from "./formatter/ModelSelectorDropdown";
import { FormatterToolbar, FONT_FAMILIES } from "./formatter/FormatterToolbar";
import { RawDocumentPreview } from "./formatter/RawDocumentPreview";
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
import { useOpenRouterStore } from "../../store/openRouterStore";
import { useResumeFormatterStore } from "../../store/resumeFormatterStore";
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
    setSelectedModel,
  } = useOpenRouterStore();

  // Auto-fetch OpenRouter models if cache is empty
  useEffect(() => {
    if (open && modelsCache.length === 0) {
      fetchOpenRouterModels().catch(() => {});
    }
  }, [open, modelsCache.length]);

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

    return Array.from(map.values());
  }, [FALLBACK_FREE_MODELS, modelsCache]);

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
    if (apiKeys.length === 0) {
      return "Built-in Formatter";
    }
    const found = modelsCache.find((m) => m.id === selectedModel);
    let name = found ? found.name : selectedModel.split("/").pop() || selectedModel;
    name = name.replace(/\(free\)/i, "").replace(/:free$/i, "").trim();
    return name;
  }, [apiKeys.length, selectedModel, modelsCache]);

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

        // Step 2: Use AI Block-ID Cognitive Engine based on OpenRouter key availability
        const openRouterState = useOpenRouterStore.getState();
        const effectiveKeys = openRouterState.apiKeys;
        const effectiveModel = selectedModel || openRouterState.selectedModel;

        if (effectiveKeys.length > 0) {
          setProcessing(true, `AI analyzing structure (${activeModelDisplay})…`);
          try {
            const { structure, rawBlocks } = await parseResumeWithBlockIdAI(
              blocks,
              effectiveModel
            );
            candidateName = structure.candidate_name || "Candidate";
            finalFormattedHtml = reassembleHtmlFromBlocks(structure, rawBlocks);
          } catch (aiErr: any) {
            console.warn("OpenRouter AI parsing failed, falling back to built-in engine:", aiErr);
            toast.warning(
              aiErr.message?.includes("429") || aiErr.message?.includes("credit")
                ? "OpenRouter credits/rate limit reached. Formatted with built-in engine."
                : `AI note: ${aiErr.message || "Using built-in engine fallback."}`
            );
            setProcessing(true, "Formatting with built-in engine…");
            const structure = parseResumeWithLocalEngine(blocks, textLines);
            candidateName = structure.candidate_name || "Candidate";
            finalFormattedHtml = reassembleHtmlFromBlocks(structure, blocks);
          }
        } else {
          // Built-in rule engine (Offline, zero credits needed, 100% private)
          setProcessing(true, "Formatting with built-in engine…");
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
        className={`relative flex flex-col w-full ${showOriginal ? "max-w-6xl" : "max-w-4xl"
          } h-[88vh] max-h-[900px] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden transition-all duration-200`}
      >
        {/* ─── Top Header Bar ────────────────────────────────────────────── */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileDoc className="h-4 w-4 text-primary shrink-0" weight="duotone" />
            <span className="text-[13px] font-bold text-fg shrink-0 tracking-tight">RecDesk Formatter</span>

            {/* Interactive AI Engine Selector */}
            <ModelSelectorDropdown
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              activeModelDisplay={activeModelDisplay}
              freeCloudModels={freeCloudModels}
              apiKeys={apiKeys}
              onCloseModal={onClose}
            />

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
                  className={`cursor-pointer inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium border transition-colors ${showOriginal
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
          <FormatterToolbar
            editor={editor}
            selectedFont={selectedFont}
            setSelectedFont={setSelectedFont}
            selectedSize={selectedSize}
            setSelectedSize={setSelectedSize}
          />
        )}

        {/* ─── Main Viewport ─────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8 bg-surface-hover/20">
              <div className="flex flex-col items-center gap-4 max-w-md w-full">
                {/* Clean AI Info / Configuration Strip */}
                <div className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-border bg-surface-hover/50 text-xs">
                  <div className="flex items-center gap-2 text-fg-muted">
                    <Sparkle className="h-3.5 w-3.5 text-primary shrink-0" weight="fill" />
                    <span className="text-[11.5px]">
                      {apiKeys.length > 0
                        ? `Cloud AI: ${activeModelDisplay}`
                        : "Built-in offline engine (100% private, zero setup)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/settings");
                    }}
                    className="text-[11px] font-medium text-primary hover:underline cursor-pointer shrink-0"
                  >
                    {apiKeys.length === 0 ? "Add OpenRouter Key →" : "Settings →"}
                  </button>
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
              <RawDocumentPreview
                showOriginal={showOriginal}
                originalRawText={originalRawText}
              />

              {/* Right Pane (or Full Width): Document Canvas with consistent margins */}
              <div
                className={`flex-1 overflow-y-auto bg-zinc-900/95 scrollbar-thin px-4 py-8 pb-32 ${showOriginal ? "w-1/2" : "w-full"
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
