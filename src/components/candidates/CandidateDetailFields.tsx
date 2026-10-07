import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowSquareOut,
  Check,
  Copy,
  LinkedinLogo,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

export function getPlainTextFromNotes(raw?: string | null): string {
  if (!raw) return "";
  if (!raw.includes("<") || !raw.includes(">")) return raw;
  try {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    return doc.body.textContent || "";
  } catch {
    return raw.replace(/<[^>]*>/g, "");
  }
}

export function getStatusSelectTriggerStyle(status: string): string {
  switch (status) {
    case "sourced":
      return "bg-slate-500/10 hover:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
    case "in_touch":
      return "bg-blue-500/10 hover:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "pipeline":
      return "bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
    case "submitted":
      return "bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "interview":
      return "bg-purple-500/10 hover:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    case "placed":
      return "bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "rejected":
      return "bg-red-500/10 hover:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "not_interested":
      return "bg-slate-500/10 hover:bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
    default:
      return "bg-slate-500/10 hover:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  }
}

export function getAdaptiveNameSize(name: string): string {
  const len = name.trim().length;
  if (len <= 20) return "text-[18px] font-bold tracking-tight text-fg";
  if (len <= 30) return "text-[16px] font-bold tracking-tight text-fg";
  return "text-[14px] font-semibold tracking-tight text-fg";
}

export function HeroNameField({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const fontClass = getAdaptiveNameSize(draft || value || "Candidate");

  return (
    <div className="min-w-0">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Candidate Name"
        title={draft || value}
        className={cn(
          "w-full bg-transparent text-fg leading-tight placeholder:text-fg-subtle outline-none transition-colors rounded px-1 -ml-1 hover:bg-surface-hover/80 focus:bg-surface focus:ring-1 focus:ring-primary/40 truncate",
          fontClass
        )}
        onBlur={() => {
          const t = draft.trim();
          if (!t || t === value) {
            setDraft(value);
            return;
          }
          onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function HeroTitleField({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="min-w-0 mt-0.5">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Role / Title…"
        title={draft || value}
        className="w-full bg-transparent text-[13px] text-fg-muted placeholder:text-fg-subtle/60 outline-none transition-colors rounded px-1 -ml-1 hover:bg-surface-hover/80 focus:bg-surface focus:ring-1 focus:ring-primary/40 truncate"
        onBlur={() => {
          const t = draft.trim();
          if (t === value) return;
          onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function HeroMetaField({
  icon,
  value,
  placeholder,
  onSave,
}: {
  icon: ReactNode;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="flex items-center gap-1.5 min-w-0 group">
      {icon}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        title={draft || value}
        className="w-full min-w-0 bg-transparent text-[12px] text-fg-muted font-medium placeholder:text-fg-subtle/50 outline-none transition-colors rounded px-1 hover:bg-surface-hover/80 focus:bg-surface focus:ring-1 focus:ring-primary/40 truncate"
        onBlur={() => {
          const t = draft.trim();
          if (t === value) return;
          onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function ContactField({
  icon,
  value,
  placeholder,
  onSave,
  onCopy,
}: {
  icon: ReactNode;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  onCopy: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const handleCopy = () => {
    if (!value) return;
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 transition-colors hover:border-border">
      {icon}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-subtle truncate"
        onBlur={() => {
          const t = draft.trim();
          if (t === value) return;
          onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy"}
          className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      ) : null}
    </div>
  );
}

export function LinkedInField({
  value,
  onSave,
  onOpen,
  onCopy,
}: {
  value: string;
  onSave: (v: string) => void;
  onOpen: () => void;
  onCopy: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const handleCopy = () => {
    if (!value) return;
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 transition-colors hover:border-border">
      <LinkedinLogo className="h-3.5 w-3.5 shrink-0 text-[#0077b5]" weight="fill" />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="LinkedIn URL…"
        className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-subtle truncate"
        onBlur={() => {
          const t = draft.trim();
          if (t === value) return;
          onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {value ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpen}
            title="Open in browser"
            className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
          >
            <ArrowSquareOut className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy link"}
            className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
