import { useMemo, useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

export function useTableSort<K extends string>(defaultKey: K) {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: K) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return { sortKey, sortDir, toggleSort };
}

export function useSortedRows<T, K extends string>(
  rows: T[] | undefined,
  sortKey: K,
  sortDir: "asc" | "desc",
  compare: (a: T, b: T, key: K) => number,
) {
  return useMemo(() => {
    if (!rows) return [];
    const arr = [...rows];
    arr.sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir, compare]);
}

export function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <CaretDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />;
  return dir === "asc" ? <CaretUp className="h-3 w-3" /> : <CaretDown className="h-3 w-3" />;
}