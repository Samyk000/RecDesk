import { useEffect, useState } from "react";

export function useSelection(ids: string[], resetKey: string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [resetKey]);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return { selected, allSelected, toggle, toggleAll, clear };
}
