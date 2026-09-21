import { ThinkingOrb, type OrbState, type OrbSize } from "thinking-orbs";
import { CircleNotch } from "@phosphor-icons/react";
import { useTheme } from "../../store/theme";
import { cn } from "../../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <CircleNotch className={cn("h-5 w-5 animate-spin text-fg-subtle", className)} />;
}

export function ThemedOrb({
  state = "solving",
  size = 64,
  className,
}: {
  state?: OrbState;
  size?: OrbSize;
  className?: string;
}) {
  const resolved = useTheme((s) => s.resolved);

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center justify-center select-none", className)}
    >
      <ThinkingOrb
        state={state}
        size={size}
        theme={resolved === "dark" ? "dark" : "light"}
      />
    </div>
  );
}

export function PageLoader({
  label = "Loading…",
  state = "solving",
}: {
  label?: string;
  state?: OrbState;
}) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3.5 text-fg-subtle select-none p-6 animate-fade-in">
      <ThemedOrb state={state} size={64} />
      {label && <p className="text-xs font-medium text-fg-muted tracking-wide">{label}</p>}
    </div>
  );
}