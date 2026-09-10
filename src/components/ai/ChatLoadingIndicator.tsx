import { CircleNotch, Database, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import type { ChatLoadingStep } from "../../types";

interface Props {
  step: ChatLoadingStep;
  message: string;
}

export function ChatLoadingIndicator({ step, message }: Props) {
  if (step === "idle") return null;

  return (
    <div className="flex items-start gap-3 my-2 animate-in fade-in-50 duration-200">
      {/* Bot Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
        <Sparkle className="h-3.5 w-3.5 animate-pulse" weight="fill" />
      </div>

      {/* Step Progress Bubble */}
      <div className="flex flex-col gap-1.5 rounded-2xl rounded-tl-sm border border-border/80 bg-surface/90 px-4 py-2.5 text-xs shadow-xs backdrop-blur max-w-[85%]">
        <div className="flex items-center gap-2">
          {step === "analyzing" && (
            <div className="flex items-center gap-1.5 text-primary font-medium">
              <MagnifyingGlass className="h-3.5 w-3.5 animate-bounce" />
              <span>Database Query</span>
            </div>
          )}

          {step === "retrieving" && (
            <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
              <Database className="h-3.5 w-3.5 animate-pulse" />
              <span>Context Assembled</span>
            </div>
          )}

          {step === "generating" && (
            <div className="flex items-center gap-1.5 text-primary font-medium">
              <CircleNotch className="h-3.5 w-3.5 animate-spin" />
              <span>Synthesizing Response</span>
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_200ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_400ms]" />
          </div>
        </div>

        <p className="text-[11.5px] text-fg-subtle leading-tight">{message}</p>
      </div>
    </div>
  );
}
