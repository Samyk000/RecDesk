import { useState, useRef, useEffect } from "react";
import { CheckCircle, CalendarDots } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface Props {
  value?: string | null;
  onChange: (val: string | null) => void;
  className?: string;
}

function formatDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return "Select placement date…";
  const parts = isoDate.trim().split(/\s+/)[0];
  const [year, month, day] = parts.split("-").map(Number);
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

export function PlacedDatePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    return value ? value.trim().split(/\s+/)[0] : getTodayString();
  });

  useEffect(() => {
    if (value) {
      setSelectedDate(value.trim().split(/\s+/)[0]);
    } else {
      setSelectedDate(getTodayString());
    }
  }, [value]);

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

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    onChange(date || null);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const hasValue = Boolean(value);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-7 w-full items-center justify-between gap-1.5 rounded-md border border-border bg-surface-hover/80 px-2 text-[11.5px] text-fg transition-all hover:bg-surface-hover hover:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 cursor-pointer",
          open && "ring-1 ring-emerald-500/50 border-emerald-500/50",
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500" />
          <span className={cn("truncate font-medium text-[11px]", !hasValue && "text-fg-muted font-normal")}>
            {hasValue ? formatDateDisplay(value) : "Select placement date…"}
          </span>
        </span>

        {hasValue && (
          <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.2 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Placed
          </span>
        )}
      </button>

      {/* Popover anchored right-0 left-auto to avoid overflowing screen right edge */}
      {open && (
        <div className="absolute right-0 left-auto top-full z-50 mt-1.5 w-56 rounded-xl border border-border bg-surface p-2.5 shadow-xl animate-scale-in">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-1">
              <CalendarDots className="h-3 w-3 text-emerald-500" />
              Placement Date
            </span>
            {hasValue && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[10.5px] text-fg-subtle transition-colors hover:text-red-500 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div className="mb-2 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => handleDateChange(getTodayString())}
              className={cn(
                "rounded py-1 text-center text-[11px] font-medium transition-all cursor-pointer",
                selectedDate === getTodayString()
                  ? "bg-emerald-500 text-white font-semibold shadow-2xs"
                  : "border border-border/60 bg-surface-hover/50 text-fg-muted hover:text-fg hover:bg-surface-hover",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDateChange(getYesterdayString())}
              className={cn(
                "rounded py-1 text-center text-[11px] font-medium transition-all cursor-pointer",
                selectedDate === getYesterdayString()
                  ? "bg-emerald-500 text-white font-semibold shadow-2xs"
                  : "border border-border/60 bg-surface-hover/50 text-fg-muted hover:text-fg hover:bg-surface-hover",
              )}
            >
              Yesterday
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="mb-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="h-7.5 w-full rounded-md border border-border bg-surface-hover/60 px-2 text-xs text-fg outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 cursor-pointer"
            />
          </div>

          {/* Done button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-md bg-emerald-600 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
