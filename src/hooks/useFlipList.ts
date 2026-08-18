import { useLayoutEffect, useRef } from "react";

export function useFlipList() {
  const prev = useRef<Map<string, number>>(new Map());
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const els = Array.from(
      container.querySelectorAll<HTMLElement>("[data-flip-id]"),
    );
    const current = new Map<string, number>();
    let moved: HTMLElement[] = [];
    for (const el of els) {
      const id = el.dataset.flipId;
      if (!id) continue;
      const top = el.getBoundingClientRect().top;
      current.set(id, top);
      const prevTop = prev.current.get(id);
      if (prevTop !== undefined && prevTop !== top) {
        el.style.transform = `translateY(${prevTop - top}px)`;
        moved.push(el);
      }
    }
    prev.current = current;
    if (moved.length === 0) return;
    requestAnimationFrame(() => {
      for (const el of moved) {
        el.style.transition = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      }
      window.setTimeout(() => {
        for (const el of moved) el.style.transition = "";
      }, 380);
    });
  });

  return ref;
}