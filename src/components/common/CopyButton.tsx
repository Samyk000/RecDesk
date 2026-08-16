import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { copyToClipboard, cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface Props {
  text: string;
  className?: string;
  label?: string;
}

export function CopyButton({ text, className, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handle() {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="ghost" onClick={handle} className={cn("h-7 px-2", className)}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="text-xs">{copied ? "Copied" : label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : `Copy ${label.toLowerCase()} to clipboard`}</TooltipContent>
    </Tooltip>
  );
}