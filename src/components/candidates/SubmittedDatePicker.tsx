import { useState, useRef, useEffect } from "react";
import { CalendarDots } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface Props {
  value?: string | null;
  onChange: (val: string | null) => void;
  className?: string;
}

function formatDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return "Select date";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function SubmittedDatePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const todayStr = getTodayString();
  const yesterdayStr = getYesterdayString();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelectPreset = (dateStr: string) => {
    onChange(dateStr);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-hover/80 px-2.5 text-[12.5px] text-fg transition-all hover:bg-surface-hover hover:border-border-hover focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer",
          open && "ring-1 ring-primary/50 border-primary/50",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarDots className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className={cn("truncate font-medium", !value && "text-fg-muted font-normal")}>
            {value ? formatDateDisplay(value) : "Select date"}
          </span>
        </span>
        {value === todayStr && (
          <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
            Today
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-surface p-3 shadow-xl animate-scale-in">
          <div className="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Submission Date
            </span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-[11px] text-fg-subtle transition-colors hover:text-red-500 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div className="mb-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectPreset(todayStr)}
              className={cn(
                "flex-1 rounded-md border border-border/70 py-1 text-center text-xs font-medium transition-colors hover:bg-surface-hover cursor-pointer",
                value === todayStr && "border-primary/50 bg-primary/10 text-primary font-semibold",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset(yesterdayStr)}
              className={cn(
                "flex-1 rounded-md border border-border/70 py-1 text-center text-xs font-medium transition-colors hover:bg-surface-hover cursor-pointer",
                value === yesterdayStr && "border-primary/50 bg-primary/10 text-primary font-semibold",
              )}
            >
              Yesterday
            </button>
          </div>

          {/* Native picker input styled neatly */}
          <div className="space-y-1">
            <label className="text-[10.5px] text-fg-subtle">Custom Date</label>
            <input
              ref={dateInputRef}
              type="date"
              value={value || ""}
              onChange={(e) => {
                onChange(e.target.value || null);
                if (e.target.value) setOpen(false);
              }}
              className="h-8 w-full rounded-md border border-border bg-surface-hover/60 px-2 text-xs text-fg outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
