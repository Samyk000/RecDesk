
interface Props {
  showOriginal: boolean;
  originalRawText: string;
}

export function RawDocumentPreview({ showOriginal, originalRawText }: Props) {
  if (!showOriginal) return null;

  return (
    <div className="flex w-1/2 flex-col border-r border-border bg-surface overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200">
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
  );
}
