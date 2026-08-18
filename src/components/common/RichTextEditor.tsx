import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import type { ReactNode } from "react";
import {
  CaretUp,
  Eraser,
  ListBullets,
  ListNumbers,
  TextB,
  TextHTwo,
  TextHThree,
  TextItalic,
  TextT,
  TextUnderline,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface Props {
  value: string;
  onChange?: (html: string) => void;
  onUpdate?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  collapsibleToolbar?: boolean;
  mono?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  onUpdate,
  placeholder,
  minHeight = 180,
  maxHeight,
  collapsibleToolbar,
  mono,
}: Props) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Underline, Placeholder.configure({ placeholder })],
    content: value,
    editorProps: {
      attributes: { class: cn("tiptap-content", mono && "font-mono") },
    },
    onBlur: ({ editor: ed }) => {
      if (!onChange || ed.isDestroyed) return;
      const html = ed.isEmpty ? "" : ed.getHTML();
      if (html === valueRef.current) return;
      onChange(html);
    },
    onUpdate: ({ editor: ed }) => {
      if (onUpdate) onUpdate(ed.isEmpty ? "" : ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const showToolbar = !collapsibleToolbar || toolbarOpen;

  return (
    <div className="relative rounded-lg border border-border bg-transparent focus-within:ring-1 focus-within:ring-primary">
      {showToolbar && (
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-border bg-surface px-2 py-1">
          <ToolbarButton
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <TextB className="h-3.5 w-3.5" weight="bold" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <TextItalic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <TextUnderline className="h-3.5 w-3.5" />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <TextHTwo className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <TextHThree className="h-3.5 w-3.5" />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <ListBullets className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListNumbers className="h-3.5 w-3.5" />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            title="Clear formatting"
            active={false}
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          >
            <Eraser className="h-3.5 w-3.5" />
          </ToolbarButton>
          {collapsibleToolbar && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              <ToolbarButton
                title="Collapse toolbar"
                active={false}
                onClick={() => setToolbarOpen(false)}
              >
                <CaretUp className="h-3.5 w-3.5" />
              </ToolbarButton>
            </>
          )}
        </div>
      )}
      <EditorContent
        editor={editor}
        style={maxHeight ? { minHeight, maxHeight } : { height: minHeight }}
        className={cn(
          "tiptap-scroll scrollbar-thin overflow-y-auto px-3 py-2",
          showToolbar && "pt-10",
          collapsibleToolbar && !toolbarOpen && "pr-8",
        )}
      />
      {!showToolbar && (
        <button
          type="button"
          title="Formatting tools"
          onClick={() => setToolbarOpen(true)}
          className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <TextT className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ToolbarButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-fg-subtle hover:bg-surface-hover hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}