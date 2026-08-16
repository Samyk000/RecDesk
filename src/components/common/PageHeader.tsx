import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  back?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, className, back }: Props) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4 animate-fade-in", className)}>
      <div className="min-w-0">
        {back && <div className="mb-2">{back}</div>}
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}