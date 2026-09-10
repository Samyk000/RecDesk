import type { Editor } from "@tiptap/react";
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
  Eraser,
} from "@phosphor-icons/react";

export const FONT_FAMILIES = [
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, serif" },
];

export const FONT_SIZES = [
  { label: "10 pt", value: "10pt" },
  { label: "10.5 pt", value: "10.5pt" },
  { label: "11 pt", value: "11pt" },
  { label: "11.5 pt", value: "11.5pt" },
  { label: "12 pt", value: "12pt" },
  { label: "14 pt", value: "14pt" },
  { label: "16 pt", value: "16pt" },
];

interface Props {
  editor: Editor | null;
  selectedFont: string;
  setSelectedFont: (font: string) => void;
  selectedSize: string;
  setSelectedSize: (size: string) => void;
}

export function FormatterToolbar({
  editor,
  selectedFont,
  setSelectedFont,
  selectedSize,
  setSelectedSize,
}: Props) {
  if (!editor) return null;

  return (
    <div className="relative z-30 flex flex-wrap items-center gap-1 border-b border-border bg-surface-active/60 px-3 py-1.5 text-fg shadow-xs select-none">
      {/* Font Family Selector */}
      <select
        value={selectedFont}
        onChange={(e) => {
          const val = e.target.value;
          setSelectedFont(val);
          editor.chain().focus().setFontFamily(val).run();
        }}
        className="h-6.5 rounded border border-border bg-surface px-1.5 text-xs font-medium text-fg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all hover:bg-surface-hover"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Font Size Selector */}
      <select
        value={selectedSize}
        onChange={(e) => {
          const val = e.target.value;
          setSelectedSize(val);
          (editor.chain().focus() as any).setMark("textStyle", { fontSize: val }).run();
        }}
        className="h-6.5 rounded border border-border bg-surface px-1.5 text-xs font-medium text-fg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all hover:bg-surface-hover"
      >
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="h-3.5 w-px bg-border mx-0.5" />

      {/* Bold, Italic, Underline, Strike with Micro-animations */}
      <div className="flex items-center gap-0.5 rounded border border-border bg-surface p-0.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("bold") ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
          }`}
          title="Bold (Ctrl+B)"
        >
          <TextB className="h-3.5 w-3.5 font-bold" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("italic") ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
          }`}
          title="Italic (Ctrl+I)"
        >
          <TextItalic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("underline") ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
          }`}
          title="Underline (Ctrl+U)"
        >
          <TextUnderline className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("strike") ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
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
          className={`rounded px-1.5 py-0.5 text-xs font-bold transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("heading", { level: 1 })
              ? "bg-primary text-white shadow-2xs"
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
          className={`rounded px-1.5 py-0.5 text-xs font-bold transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("heading", { level: 2 })
              ? "bg-primary text-white shadow-2xs"
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
          className={`rounded px-1.5 py-0.5 text-xs transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("paragraph")
              ? "bg-primary text-white font-medium shadow-2xs"
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
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("bulletList") ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
          }`}
          title="Bullet List"
        >
          <ListBullets className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive("orderedList") ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
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
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive({ textAlign: "left" }) ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
          }`}
          title="Align Left"
        >
          <TextAlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive({ textAlign: "center" }) ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
          }`}
          title="Align Center"
        >
          <TextAlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive({ textAlign: "right" }) ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
          }`}
          title="Align Right"
        >
          <TextAlignRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`rounded p-1 transition-all duration-100 active:scale-90 cursor-pointer ${
            editor.isActive({ textAlign: "justify" }) ? "bg-primary text-white shadow-2xs" : "hover:bg-surface-hover text-fg"
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
          className="rounded p-1 text-fg hover:bg-surface-hover disabled:opacity-30 transition-all duration-100 active:scale-90 cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <ArrowCounterClockwise className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="rounded p-1 text-fg hover:bg-surface-hover disabled:opacity-30 transition-all duration-100 active:scale-90 cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <ArrowClockwise className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="rounded p-1 text-fg hover:bg-surface-hover transition-all duration-100 active:scale-90 cursor-pointer"
          title="Clear Formatting"
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
