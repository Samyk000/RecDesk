import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, Briefcase, IdentificationCard, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { apiSearch } from "../../lib/api";
import { useDebounce } from "../../hooks/useDebounce";
import { cn, errorMessage, titleCase } from "../../lib/utils";
import { jobPalette, submissionPalette } from "../../lib/constants";
import { Spinner } from "./Spinner";

type Row =
  | { kind: "client"; id: string; name: string; sub: string }
  | { kind: "job"; id: string; name: string; sub: string; status: string }
  | { kind: "candidate"; id: string; name: string; sub: string; status: string };

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query, 150);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, isFetching, error } = useQuery({
    queryKey: ["globalSearch", debounced],
    queryFn: () => apiSearch.global(debounced),
    enabled: open && debounced.trim().length > 0,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [debounced, data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const rows: Row[] = [];
  for (const c of data?.clients ?? []) {
    rows.push({ kind: "client", id: c.id, name: c.name, sub: c.company ?? "" });
  }
  for (const j of data?.jobs ?? []) {
    rows.push({ kind: "job", id: j.id, name: j.title, sub: `${j.client_name} · ${j.job_id}`, status: j.status });
  }
  for (const c of data?.candidates ?? []) {
    rows.push({
      kind: "candidate",
      id: c.id,
      name: c.name,
      sub: `${c.current_title ?? ""} @ ${c.current_company ?? ""} · ${c.job_title}`,
      status: c.submission_status,
    });
  }

  function go(row: Row) {
    onClose();
    if (row.kind === "client") navigate(`/clients/${row.id}`);
    else if (row.kind === "job") navigate(`/jobs/${row.id}`);
    else navigate(`/candidates/${row.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && rows[active]) {
      e.preventDefault();
      go(rows[active]);
    }
  }

  const Icon = (k: string) =>
    k === "client" ? Building : k === "job" ? Briefcase : IdentificationCard;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[16vh]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-float animate-scale-in">
        <div className="flex items-center gap-3 px-4 py-3">
          <MagnifyingGlass className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, jobs, candidates…"
            className="h-10 w-full bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
          />
          {isFetching ? (
            <Spinner className="h-4 w-4" />
          ) : (
            query && (
              <button onClick={() => setQuery("")} className="text-fg-subtle hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto px-2 pb-2 scrollbar-thin">
          {debounced.trim() === "" ? (
            <p className="px-4 py-8 text-center text-[13px] text-fg-subtle">
              Type to search across clients, jobs, and candidates
            </p>
          ) : error ? (
            <p className="px-4 py-8 text-center text-[13px] text-red-500">{errorMessage(error)}</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-fg-subtle">
              No results for "{debounced}"
            </p>
          ) : (
            rows.map((row, i) => {
              const palette =
                row.kind === "job"
                  ? jobPalette(row.status)
                  : row.kind === "candidate"
                    ? submissionPalette(row.status)
                    : null;
              const RIcon = Icon(row.kind);
              return (
                <button
                  key={`${row.kind}-${row.id}`}
                  data-idx={i}
                  onClick={() => go(row)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-all duration-150",
                    active === i ? "bg-surface-hover" : "hover:bg-surface-hover/50 active:bg-surface-active",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-fg-muted">
                    <RIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{row.name}</span>
                    <span className="block truncate text-xs text-fg-subtle">{row.sub}</span>
                  </span>
                  {row.kind !== "client" && palette && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium"
                      style={{ color: palette.dot }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.dot }} />
                      {titleCase(row.status)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd> close
          </span>
          <span className="ml-auto">Cmd/⌘ + K</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
      {children}
    </kbd>
  );
}