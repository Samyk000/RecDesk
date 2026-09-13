import { useEffect, useRef } from "react";
import { CircleNotch } from "@phosphor-icons/react";

interface InfiniteScrollTriggerProps {
  onIntersect: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  rootMargin?: string;
  className?: string;
}

export function InfiniteScrollTrigger({
  onIntersect,
  hasNextPage = false,
  isFetchingNextPage = false,
  rootMargin = "250px",
  className = "",
}: InfiniteScrollTriggerProps) {
  const triggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [first] = entries;
        if (first?.isIntersecting) {
          onIntersect();
        }
      },
      {
        rootMargin,
        threshold: 0.05,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, hasNextPage, isFetchingNextPage, rootMargin]);

  if (!hasNextPage && !isFetchingNextPage) {
    return null;
  }

  return (
    <div
      ref={triggerRef}
      className={`flex items-center justify-center py-3 text-xs text-fg-muted ${className}`}
    >
      {isFetchingNextPage ? (
        <div className="flex items-center gap-2 text-fg-subtle">
          <CircleNotch className="h-4 w-4 animate-spin text-primary" />
          <span>Streaming more candidates...</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onIntersect()}
          className="text-xs text-fg-subtle hover:text-fg transition-colors cursor-pointer py-1 px-2.5 rounded hover:bg-surface-hover"
        >
          Load more
        </button>
      )}
    </div>
  );
}
