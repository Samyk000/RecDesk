import { useState } from "react";
import {
  Briefcase,
  Building,
  CalendarBlank,
  Check,
  Copy,
  IdentificationCard,
  Sparkle,
  User,
  ArrowRight,
  ArrowSquareOut,
  CaretDown,
} from "@phosphor-icons/react";
import type { AiChatMessage, AiChatSource } from "../../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { AiActionCard } from "./AiActionCard";
import { cn } from "../../lib/utils";

interface Props {
  message: AiChatMessage;
  onFollowupClick: (prompt: string) => void;
  onEntityClick?: (source: AiChatSource) => void;
}

export function ChatMessageItem({ message, onFollowupClick, onEntityClick }: Props) {
  const [copied, setCopied] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const isUser = message.role === "user";

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div
      className={cn(
        "group flex gap-2.5 my-3 text-sm animate-in fade-in-50 duration-200",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105 shadow-2xs",
          isUser
            ? "bg-primary text-white"
            : "bg-primary/10 text-primary border border-primary/20 ring-2 ring-primary/5"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" weight="bold" />
        ) : (
          <Sparkle className="h-3.5 w-3.5" weight="fill" />
        )}
      </div>

      {/* Message Bubble & Content */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[88%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div className="flex items-center gap-1.5 px-1 text-[10.5px] text-fg-muted">
          <span className="font-semibold text-fg-subtle">
            {isUser ? "You" : "RecDesk AI"}
          </span>
          <span>•</span>
          <span>{formatTime(message.timestamp)}</span>

          {!isUser && message.content && (
            <button
              onClick={handleCopy}
              title="Copy response"
              className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-fg-muted hover:text-fg p-0.5 rounded cursor-pointer"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-xs transition-all",
            isUser
              ? "bg-primary text-white rounded-tr-xs shadow-primary/10"
              : "bg-surface/90 border border-border/80 text-fg rounded-tl-xs backdrop-blur-xs"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed text-[13px] font-medium">
              {message.content}
            </p>
          ) : (
            <>
              <MarkdownRenderer
                content={message.content}
                onEntityClick={(_type, name) => {
                  const matched = message.sources?.find(
                    (s) =>
                      s.title.toLowerCase() === name.toLowerCase() ||
                      name.toLowerCase().includes(s.title.toLowerCase())
                  );
                  if (matched) {
                    onEntityClick?.(matched);
                  }
                }}
              />
              {message.proposedAction && (
                <AiActionCard action={message.proposedAction} messageId={message.id} />
              )}
            </>
          )}

          {/* Collapsible Retrieved Context Accordion (Default Closed) */}
          {!isUser && message.sources && message.sources.length > 0 && !message.proposedAction && (
            <div className="mt-3 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-surface/80 px-2.5 py-1.5 text-[11px] font-semibold text-fg-subtle hover:bg-surface-hover hover:text-fg transition-all cursor-pointer shadow-2xs group/accordion"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkle className="h-3 w-3 text-primary" weight="fill" />
                  <span>Retrieved Context ({message.sources.length})</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-fg-muted font-normal">
                  <span>{isSourcesOpen ? "Hide" : "Click to view"}</span>
                  <CaretDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isSourcesOpen ? "rotate-180 text-primary" : "text-fg-muted"
                    )}
                  />
                </div>
              </button>

              {/* Collapsible Chips List */}
              {isSourcesOpen && (
                <div className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                  {message.sources.map((src, i) => (
                    <button
                      key={`${src.id}-${i}`}
                      onClick={() => onEntityClick?.(src)}
                      title={`Open full ${src.entity_type} detail panel`}
                      className="group/chip inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-fg-subtle hover:border-primary hover:bg-primary/10 hover:text-primary transition-all duration-150 cursor-pointer shadow-2xs active:scale-98"
                    >
                      {src.entity_type === "candidate" && (
                        <IdentificationCard className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                      {src.entity_type === "job" && (
                        <Briefcase className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      {src.entity_type === "client" && (
                        <Building className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      {src.entity_type === "reminder" && (
                        <CalendarBlank className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      )}
                      <span>{src.title}</span>
                      <ArrowSquareOut className="h-2.5 w-2.5 opacity-50 group-hover/chip:opacity-100 group-hover/chip:translate-x-0.5 transition-all text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Suggested Followups */}
        {!isUser &&
          message.suggestedFollowups &&
          message.suggestedFollowups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1 px-0.5">
              {message.suggestedFollowups.map((followup, idx) => (
                <button
                  key={idx}
                  onClick={() => onFollowupClick(followup)}
                  className="group/pill inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-3 py-1 text-[11px] font-medium text-fg-subtle hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-xs transition-all duration-150 cursor-pointer active:scale-98"
                >
                  <span>{followup}</span>
                  <ArrowRight className="h-2.5 w-2.5 opacity-50 group-hover/pill:opacity-100 group-hover/pill:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
