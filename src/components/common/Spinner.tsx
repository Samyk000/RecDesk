import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <CircleNotch className={cn("h-5 w-5 animate-spin text-fg-subtle", className)} />;
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-fg-subtle">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
        <Spinner className="relative h-6 w-6 text-primary" />
      </div>
      <p className="text-sm">{label}</p>
    </div>
  );
}