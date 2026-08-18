import type { ReactNode } from "react";

export function DetailDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/25 animate-fade-in" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface shadow-popover animate-slide-in-right">
        {children}
      </div>
    </div>
  );
}