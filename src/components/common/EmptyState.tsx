import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface/50 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-hover text-fg-subtle">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-fg-subtle">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}