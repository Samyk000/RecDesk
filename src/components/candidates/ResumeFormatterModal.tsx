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
} from "@phosphor-icons/react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { apiFiles } from "../../lib/api";
import { extractPdfToHtml } from "../../lib/pdfExtractor";
import {
  parseResumeSections,
  htmlToTextLines,
  plainTextToLines,
} from "../../lib/resumeSectionParser";
import { generatePreviewHtml } from "../../lib/clientResumeDocx";
import {
  chunkDocumentIntoBlocks,
  parseResumeWithBlockIdAI,
  reassembleHtmlFromBlocks,
} from "../../lib/blockIdResumeParser";
import { convertHtmlToDocxBytes } from "../../lib/docxExport";
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
  } = useOpenRouterStore();

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
    if (activeProvider === "local") return "Local AI";
    const found = modelsCache.find((m) => m.id === selectedModel);
    let name = found ? found.name : selectedModel.split("/").pop() || selectedModel;
    name = name.replace(/\(free\)/i, "").replace(/:free$/i, "").trim();
    return name;
  }, [activeProvider, selectedModel, modelsCache]);

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

        // Step 2: Use AI Block-ID Cognitive Engine if OpenRouter key is present
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
            console.warn("AI Block-ID parsing failed, falling back to local layout engine:", aiErr);
            toast.warning(`AI note: ${aiErr.message || "Using fallback engine"}`);
            // Fallback to local heuristic section classifier
            const parsedResume = parseResumeSections(textLines);
            candidateName = parsedResume.candidateName;
            finalFormattedHtml = generatePreviewHtml(parsedResume);
          }
        } else {
          // No AI key configured -> use local section classifier
          setProcessing(true, "Formatting into client layout…");
          const parsedResume = parseResumeSections(textLines);
          candidateName = parsedResume.candidateName;
          finalFormattedHtml = generatePreviewHtml(parsedResume);
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

            {/* Model Badge */}
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-border/80 bg-surface-hover/80 px-2 py-0.5 text-[10.5px] text-fg-muted font-mono shrink-0">
              <Lightning className="h-2.5 w-2.5 text-amber-500 shrink-0" weight="fill" />
              <span className="truncate max-w-[120px]">{activeModelDisplay}</span>
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
                {apiKeys.length === 0 && (
                  <div className="flex items-center justify-between gap-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                    <div className="flex items-center gap-2">
                      <Sparkle className="h-4 w-4 shrink-0" weight="fill" />
                      <span>Configure OpenRouter for free AI formatting</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate("/settings");
                      }}
                      className="cursor-pointer font-semibold underline hover:opacity-80 shrink-0"
                    >
                      Settings
                    </button>
                  </div>
                )}

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
