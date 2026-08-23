import { useEffect, useState } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extension-placeholder";
import mammoth from "mammoth";
import { convertHtmlToDocxBytes } from "../../../lib/docxExport";
import {
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
  FloppyDisk,
  Printer,
  Minus,
  Plus,
  Eraser,
  CaretDown,
} from "@phosphor-icons/react";
import { Spinner } from "../../common/Spinner";
import { apiFiles } from "../../../lib/api";
import { toast } from "sonner";
import { errorMessage } from "../../../lib/utils";

// Custom FontSize Extension for TipTap
export const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
});

interface Props {
  filePath: string;
  candidateName?: string;
  data: Uint8Array;
  initialHtml?: string;
  onClose: () => void;
  onSaved?: (savedFilePath: string) => void;
}

const FONT_FAMILIES = [
  { label: "Times New Roman (Classic)", value: "Times New Roman, Times, serif" },
  { label: "Arial (Modern Clean)", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri (Standard Word)", value: "Calibri, Candara, Segoe, sans-serif" },
  { label: "Georgia (Editorial Serif)", value: "Georgia, serif" },
  { label: "Garamond (Executive Serif)", value: "Garamond, Baskerville, serif" },
  { label: "Plus Jakarta Sans", value: "Plus Jakarta Sans, sans-serif" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "JetBrains Mono (Technical)", value: "JetBrains Mono, monospace" },
  { label: "Courier New (Monospace)", value: "Courier New, monospace" },
];

const FONT_SIZES = [
  { label: "9 pt", value: "12px" },
  { label: "10 pt", value: "13.33px" },
  { label: "10.5 pt", value: "14px" },
  { label: "11 pt (Default)", value: "14.66px" },
  { label: "12 pt", value: "16px" },
  { label: "14 pt", value: "18.66px" },
  { label: "16 pt (Section Title)", value: "21.33px" },
  { label: "18 pt (Name Heading)", value: "24px" },
  { label: "20 pt", value: "26.66px" },
  { label: "24 pt", value: "32px" },
];

const COLOR_PALETTE = [
  { label: "Black", color: "#000000" },
  { label: "Slate Gray", color: "#475569" },
  { label: "Navy Blue", color: "#1e3a8a" },
  { label: "Royal Blue", color: "#2563eb" },
  { label: "Teal", color: "#0d9488" },
  { label: "Forest Green", color: "#166534" },
  { label: "Crimson Red", color: "#dc2626" },
  { label: "Purple", color: "#7c3aed" },
];

const HIGHLIGHT_PALETTE = [
  { label: "Yellow", color: "#fef08a" },
  { label: "Green", color: "#bbf7d0" },
  { label: "Cyan", color: "#a5f3fc" },
  { label: "Pink", color: "#fbcfe8" },
  { label: "Orange", color: "#fed7aa" },
  { label: "Purple", color: "#e9d5ff" },
];

export function ResumeEditor({ filePath, candidateName, data, initialHtml, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [scale, setScale] = useState(1.0);
  const [selectedFont, setSelectedFont] = useState(FONT_FAMILIES[0].value);
  const [selectedSize, setSelectedSize] = useState(FONT_SIZES[3].value);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const filename = filePath.split(/[\\/]/).pop() ?? "Resume";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

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
      FontFamily.configure({
        types: ["textStyle"],
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: "Write or edit candidate resume content…",
      }),
    ],
    content: "",
    onUpdate: () => {
      setIsDirty(true);
    },
  });

  // Convert and load content from data bytes or initialHtml
  useEffect(() => {
    let active = true;
    if (!editor) return;

    setLoading(true);

    async function loadContent() {
      try {
        if (initialHtml) {
          if (!active) return;
          editor?.commands.setContent(initialHtml);
        } else {
          const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          if (ext === "docx") {
            try {
              const result = await mammoth.convertToHtml({ arrayBuffer: safeBuffer });
              if (!active) return;
              editor?.commands.setContent(result.value || "<p>Empty document</p>");
            } catch (mammothErr) {
              const text = new TextDecoder().decode(safeBuffer);
              if (text.includes("<p>") || text.includes("<h1>") || text.includes("<div>")) {
                if (!active) return;
                editor?.commands.setContent(text);
              } else {
                throw mammothErr;
              }
            }
          } else {
            // Text / markdown / fallback
            const rawText = new TextDecoder().decode(safeBuffer);
            const html = rawText
              .split("\n")
              .map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return "<p><br/></p>";
                if (trimmed.startsWith("### ")) return `<h3>${escapeHtml(trimmed.slice(4))}</h3>`;
                if (trimmed.startsWith("## ")) return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
                if (trimmed.startsWith("# ")) return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
                if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
                  return `<ul><li>${escapeHtml(trimmed.slice(2))}</li></ul>`;
                return `<p>${escapeHtml(line)}</p>`;
              })
              .join("");
            if (!active) return;
            editor?.commands.setContent(html || "<p>Empty document</p>");
          }
        }
        // Set default font to Times New Roman at the start
        editor?.chain().focus().setFontFamily(FONT_FAMILIES[0].value).run();
        setIsDirty(false);
      } catch (err) {
        console.error("Failed to parse document for editing:", err);
        toast.error("Failed to load document content");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadContent();

    return () => {
      active = false;
    };
  }, [editor, data, ext, initialHtml]);

  const handleSave = async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const htmlContent = editor.getHTML();

      let targetPath = filePath;
      // If document is DOCX or was converted from PDF, save as full OpenXML .docx
      if (ext === "docx" || ext === "pdf") {
        targetPath = ext === "pdf" ? filePath.replace(/\.pdf$/i, ".docx") : filePath;
        const bytes = await convertHtmlToDocxBytes(htmlContent);
        await apiFiles.writeResumeBytes(targetPath, bytes);
      } else {
        // Text / markdown: extract plain text
        const textContent = editor.getText();
        const bytes = Array.from(new TextEncoder().encode(textContent));
        await apiFiles.writeResumeBytes(filePath, bytes);
      }

      setIsDirty(false);
      toast.success("Resume updated and saved successfully");
      if (onSaved) onSaved(targetPath);
    } catch (err) {
      console.error("Save error:", err);
      toast.error(`Failed to save: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (confirm("You have unsaved changes. Do you really want to discard and exit?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md animate-[fade-in_0.2s_ease-out]">
      {/* Click-outside backdrop to dismiss open popovers */}
      {(showColorPicker || showHighlightPicker) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowColorPicker(false);
            setShowHighlightPicker(false);
          }}
        />
      )}

      {/* Top Header Bar */}
      <div className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface/95 px-5 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500">
            <FloppyDisk className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-fg" title={filename}>
                {filename}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                Word-Like Editor
              </span>
              {isDirty && (
                <span className="rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-medium text-amber-500 border border-amber-500/20">
                  Unsaved Changes
                </span>
              )}
            </div>
            {candidateName && (
              <p className="truncate text-xs text-fg-subtle">
                Candidate: <span className="font-medium text-fg/90">{candidateName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom controls */}
          <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-hover px-1.5 text-xs text-fg-subtle shrink-0">
            <button
              onClick={() => setScale((s) => Math.max(0.6, +(s - 0.1).toFixed(2)))}
              title="Zoom out"
              className="rounded p-1 hover:bg-surface-active"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[42px] text-center font-mono text-[11px] tabular-nums font-medium text-fg whitespace-nowrap">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(1.8, +(s + 0.1).toFixed(2)))}
              title="Zoom in"
              className="rounded p-1 hover:bg-surface-active"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <button
            onClick={handlePrint}
            title="Print / Export as PDF"
            className="flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-border bg-surface-hover px-3 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md bg-primary px-3 text-xs font-medium text-primary-fg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Spinner /> : <FloppyDisk className="h-3.5 w-3.5 shrink-0" />}
            <span>Save</span>
          </button>

          <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

          <button
            onClick={handleClose}
            title="Exit editor"
            className="flex h-8 items-center justify-center whitespace-nowrap shrink-0 rounded-md border border-border/80 px-3 text-xs font-medium text-fg-subtle hover:bg-surface-active hover:text-fg"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* MS Word-Style Ribbon Toolbar (relative z-30 with overflow-visible) */}
      {editor && (
        <div className="relative z-30 flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-4 py-2 text-fg shadow-xs select-none">
          {/* Font Family (Times New Roman at the very top) */}
          <div className="flex items-center">
            <select
              value={selectedFont}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFont(val);
                editor.chain().focus().setFontFamily(val).run();
              }}
              className="h-7 rounded border border-border bg-surface-hover px-2 text-xs font-medium text-fg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size Selector */}
          <div className="flex items-center">
            <select
              value={selectedSize}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSize(val);
                (editor.chain().focus() as any).setMark("textStyle", { fontSize: val }).run();
              }}
              className="h-7 rounded border border-border bg-surface-hover px-2 text-xs font-medium text-fg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {FONT_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          {/* Bold, Italic, Underline, Strikethrough */}
          <div className="flex items-center gap-0.5 rounded border border-border bg-surface-hover p-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`rounded p-1 transition-colors ${
                editor.isActive("bold") ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
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
                editor.isActive("italic") ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
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
                editor.isActive("underline") ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
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
                editor.isActive("strike") ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
              }`}
              title="Strikethrough"
            >
              <TextStrikethrough className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          {/* Color & Highlight pickers */}
          <div className="relative flex items-center gap-1.5">
            {/* Text Color Button */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowHighlightPicker(false);
                }}
                className={`flex h-7 items-center gap-1 rounded border px-2 text-xs font-semibold transition-colors ${
                  showColorPicker
                    ? "bg-surface-active border-primary text-primary shadow-xs"
                    : "border-border bg-surface-hover text-fg hover:bg-surface-active"
                }`}
                title="Text Color"
              >
                <span className="font-bold underline decoration-primary decoration-2 text-[13px]">A</span>
                <CaretDown className="h-2.5 w-2.5 text-fg-subtle" />
              </button>

              {showColorPicker && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute top-9 left-0 z-50 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-2xl min-w-[170px]"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-fg-subtle border-b border-border pb-1.5">
                    <span>Text Color</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().unsetColor().run();
                        setShowColorPicker(false);
                      }}
                      className="text-[10px] text-primary hover:underline font-medium"
                    >
                      Default
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-0.5">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          editor.chain().focus().setColor(c.color).run();
                          setShowColorPicker(false);
                        }}
                        className="h-6 w-6 rounded-md border border-black/25 transition-transform hover:scale-115 flex items-center justify-center shadow-xs cursor-pointer"
                        style={{ backgroundColor: c.color }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Text Highlight Button */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowHighlightPicker(!showHighlightPicker);
                  setShowColorPicker(false);
                }}
                className={`flex h-7 items-center gap-1 rounded border px-2 text-xs font-semibold transition-colors ${
                  showHighlightPicker
                    ? "bg-surface-active border-primary text-primary shadow-xs"
                    : "border-border bg-surface-hover text-fg hover:bg-surface-active"
                }`}
                title="Text Highlight"
              >
                <span className="rounded bg-yellow-300 px-1 py-0.2 text-[10px] text-black font-bold">Ab</span>
                <CaretDown className="h-2.5 w-2.5 text-fg-subtle" />
              </button>

              {showHighlightPicker && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute top-9 left-0 z-50 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-2xl min-w-[170px]"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-fg-subtle border-b border-border pb-1.5">
                    <span>Highlight Color</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().unsetHighlight().run();
                        setShowHighlightPicker(false);
                      }}
                      className="text-[10px] text-primary hover:underline font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    {HIGHLIGHT_PALETTE.map((h) => (
                      <button
                        key={h.color}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          editor.chain().focus().setHighlight({ color: h.color }).run();
                          setShowHighlightPicker(false);
                        }}
                        className="h-6 w-10 rounded-md border border-black/25 text-[10px] font-bold text-black flex items-center justify-center transition-transform hover:scale-110 shadow-xs cursor-pointer"
                        style={{ backgroundColor: h.color }}
                        title={h.label}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5 rounded border border-border bg-surface-hover p-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className={`rounded p-1 transition-colors ${
                editor.isActive({ textAlign: "left" }) ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
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
                editor.isActive({ textAlign: "center" }) ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
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
                editor.isActive({ textAlign: "right" }) ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
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
                editor.isActive({ textAlign: "justify" }) ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
              }`}
              title="Justify"
            >
              <TextAlignJustify className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Bulleted & Numbered Lists */}
          <div className="flex items-center gap-0.5 rounded border border-border bg-surface-hover p-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`rounded p-1 transition-colors ${
                editor.isActive("bulletList") ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
              }`}
              title="Bulleted List"
            >
              <ListBullets className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`rounded p-1 transition-colors ${
                editor.isActive("orderedList") ? "bg-primary text-primary-fg" : "hover:bg-surface-active text-fg"
              }`}
              title="Numbered List"
            >
              <ListNumbers className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 rounded border border-border bg-surface-hover p-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="rounded p-1 hover:bg-surface-active disabled:opacity-40"
              title="Undo (Ctrl+Z)"
            >
              <ArrowCounterClockwise className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="rounded p-1 hover:bg-surface-active disabled:opacity-40"
              title="Redo (Ctrl+Y)"
            >
              <ArrowClockwise className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Clear Formatting */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            className="flex h-7 items-center gap-1 rounded border border-border bg-surface-hover px-2 text-xs text-fg hover:bg-surface-active"
            title="Clear Formatting"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Document Canvas Viewport (MS Word Page Look) */}
      <div className="relative flex-1 overflow-y-auto overflow-x-auto p-6 sm:p-10 bg-zinc-900/90 dark:bg-black/90 flex justify-center">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/80 backdrop-blur-xs">
            <Spinner />
            <span className="text-xs text-fg-subtle">Preparing Word-like document editor…</span>
          </div>
        )}

        <div
          className="w-full max-w-[850px] transition-transform duration-150 origin-top"
          style={{ transform: `scale(${scale})` }}
        >
          {/* Authentic MS Word Document Page */}
          <div className="min-h-[1100px] rounded-xs bg-white p-12 sm:p-16 text-slate-900 shadow-2xl border border-black/10">
            <EditorContent
              editor={editor}
              className="tiptap prose prose-slate max-w-none focus:outline-none text-[14.5px] leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:border-b [&_h1]:border-slate-300 [&_h1]:pb-1 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-2 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ul_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_ol_li]:my-1"
              style={{ fontFamily: selectedFont }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
