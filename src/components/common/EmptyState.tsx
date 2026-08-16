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
        "flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-hover text-fg-subtle shadow-raise">
          {icon}
        </div>
      )}
      <p className="font-display text-[15px] font-semibold text-fg">{title}</p>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-fg-subtle">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}