import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-fg-subtle", className)} />;
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-fg-subtle">
      <Spinner className="h-6 w-6" />
      <p className="text-sm">{label}</p>
    </div>
  );
}