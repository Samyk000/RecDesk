import React, { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface Props {
  content: string;
  className?: string;
  onEntityClick?: (type: string, name: string) => void;
}

export function MarkdownRenderer({ content, className, onEntityClick }: Props) {
  if (!content) return null;

  // Split content by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={cn("space-y-2 text-[13px] leading-relaxed text-fg break-words", className)}>
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          return <CodeBlock key={index} rawBlock={part} />;
        }
        return <FormattedParagraphs key={index} text={part} onEntityClick={onEntityClick} />;
      })}
    </div>
  );
}

function CodeBlock({ rawBlock }: { rawBlock: string }) {
  const [copied, setCopied] = useState(false);
  const firstLineEnd = rawBlock.indexOf("\n");
  let lang = "";
  let code = "";

  if (firstLineEnd !== -1) {
    lang = rawBlock.slice(3, firstLineEnd).trim();
    code = rawBlock.slice(firstLineEnd + 1, -3);
  } else {
    code = rawBlock.slice(3, -3);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative my-2.5 overflow-hidden rounded-xl border border-border bg-bg-sidebar/90 text-xs font-mono shadow-xs">
      <div className="flex items-center justify-between border-b border-border/60 bg-surface/80 px-3 py-1.5 text-fg-subtle">
        <span className="uppercase text-[10px] font-bold tracking-wider text-fg-muted">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-medium hover:text-fg transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[11.5px] leading-relaxed text-fg [scrollbar-width:thin]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedParagraphs({
  text,
  onEntityClick,
}: {
  text: string;
  onEntityClick?: (type: string, name: string) => void;
}) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inUnorderedList = false;
  let unorderedItems: { text: string; indent: number }[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  function flushUnorderedList() {
    if (inUnorderedList && unorderedItems.length > 0) {
      elements.push(
        <div key={`ul-${elements.length}`} className="my-1.5 space-y-1.5">
          {unorderedItems.map((item, idx) => {
            const hasIcon = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(item.text.trim());
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start text-[12.5px] leading-relaxed",
                  item.indent > 0 ? "ml-5 text-fg-subtle" : "text-fg"
                )}
              >
                {!hasIcon && (
                  <span className="mr-2 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                )}
                <div className="flex-1">
                  <InlineText text={item.text} onEntityClick={onEntityClick} />
                </div>
              </div>
            );
          })}
        </div>
      );
      unorderedItems = [];
      inUnorderedList = false;
    }
  }

  function flushTable() {
    if (inTable && tableLines.length > 0) {
      const parsedRows = tableLines
        .filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"))
        .map((l) =>
          l
            .trim()
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim())
        );

      if (parsedRows.length >= 2) {
        const headerRow = parsedRows[0];
        const isSeparator = parsedRows[1].every((c) => c.replace(/[:-]/g, "").trim() === "");
        const bodyRows = isSeparator ? parsedRows.slice(2) : parsedRows.slice(1);

        elements.push(
          <div
            key={`table-${elements.length}`}
            className="my-2.5 overflow-x-auto rounded-xl border border-border bg-surface/70 text-xs shadow-xs"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-hover/70">
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3 py-2 font-semibold text-fg text-[11.5px]">
                      <InlineText text={cell} onEntityClick={onEntityClick} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-surface-hover/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-fg-subtle text-[12px]">
                        <InlineText text={cell} onEntityClick={onEntityClick} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableLines = [];
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Table Detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushUnorderedList();
      inTable = true;
      tableLines.push(trimmed);
      continue;
    } else {
      flushTable();
    }

    // 2. Unordered List Items: "- " or "* "
    const isUnordered = trimmed.startsWith("- ") || trimmed.startsWith("* ");
    if (isUnordered) {
      inUnorderedList = true;
      const indent = rawLine.search(/\S|$/);
      unorderedItems.push({ text: trimmed.slice(2), indent });
      continue;
    } else {
      flushUnorderedList();
    }

    // 3. Empty line
    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-1" />);
      continue;
    }

    // 4. Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      elements.push(<hr key={i} className="my-2.5 border-border/70" />);
      continue;
    }

    // 5. Numbered List Item: "1. ", "2. ", etc.
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <div
          key={i}
          className="mt-3 mb-1.5 flex items-start gap-2.5 rounded-lg border border-border/40 bg-surface/50 p-2.5 text-fg font-medium shadow-2xs hover:border-primary/30 transition-colors"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[11px] font-bold">
            {numberedMatch[1]}
          </span>
          <div className="flex-1 text-[13px] leading-snug">
            <InlineText text={numberedMatch[2]} onEntityClick={onEntityClick} />
          </div>
        </div>
      );
      continue;
    }

    // 6. Headers
    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h5 key={i} className="font-display font-semibold text-xs text-fg mt-2.5 mb-1">
          <InlineText text={trimmed.slice(5)} onEntityClick={onEntityClick} />
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <div
          key={i}
          className="font-display font-bold text-[13.5px] text-primary mt-2 mb-1 flex items-center gap-1.5"
        >
          <InlineText text={trimmed.slice(4)} onEntityClick={onEntityClick} />
        </div>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="font-display font-bold text-sm text-fg mt-2.5 mb-1">
          <InlineText text={trimmed.slice(3)} onEntityClick={onEntityClick} />
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="font-display font-bold text-base text-fg mt-3 mb-1">
          <InlineText text={trimmed.slice(2)} onEntityClick={onEntityClick} />
        </h2>
      );
      continue;
    }

    // 7. Blockquote
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-2 border-primary/70 bg-primary/5 px-3 py-2 rounded-r-lg text-fg-subtle my-2 text-[12px] italic leading-relaxed"
        >
          <InlineText text={trimmed.slice(2)} onEntityClick={onEntityClick} />
        </blockquote>
      );
      continue;
    }

    // 8. Regular paragraph
    elements.push(
      <p key={i} className="my-1 leading-relaxed">
        <InlineText text={rawLine} onEntityClick={onEntityClick} />
      </p>
    );
  }

  flushUnorderedList();
  flushTable();

  return <>{elements}</>;
}

function InlineText({
  text,
  onEntityClick: _onEntityClick,
}: {
  text: string;
  onEntityClick?: (type: string, name: string) => void;
}) {
  // Parse inline markdown tokens: bold **text**, italic *text*, inline code `code`
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return (
    <>
      {tokens.map((token, idx) => {
        if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
          return (
            <strong key={idx} className="font-semibold text-fg">
              {token.slice(2, -2)}
            </strong>
          );
        }
        if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
          return (
            <em key={idx} className="italic text-fg-muted">
              {token.slice(1, -1)}
            </em>
          );
        }
        if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
          const innerCode = token.slice(1, -1);
          return (
            <span
              key={idx}
              className="inline-flex items-center rounded-md bg-surface-hover/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary border border-border/50 mx-0.5 align-baseline"
            >
              {innerCode}
            </span>
          );
        }
        return <span key={idx}>{token}</span>;
      })}
    </>
  );
}
