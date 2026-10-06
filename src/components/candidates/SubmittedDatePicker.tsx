import { useState, useRef, useEffect, useMemo } from "react";
import { CalendarBlank, CalendarDots, X } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface Props {
  value?: string | null;
  onChange: (val: string | null) => void;
  className?: string;
}

function parseSubmissionDate(val?: string | null): string {
  if (!val) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const parts = val.trim().split(/\s+/);
  return parts[0] || "";
}

function formatDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return "Select date…";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function SubmittedDatePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialDate = useMemo(() => parseSubmissionDate(value), [value]);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  useEffect(() => {
    setSelectedDate(parseSubmissionDate(value));
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
    if (!date) {
      onChange(null);
    } else {
      onChange(date);
    }
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const hasValue = Boolean(value?.trim());

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 text-xs text-fg transition-all hover:bg-surface-hover hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer shadow-2xs",
          open && "ring-1 ring-primary/50 border-primary/50",
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <CalendarBlank className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className={cn("truncate font-medium text-xs", !hasValue && "text-fg-muted font-normal")}>
            {hasValue ? formatDateDisplay(selectedDate) : "Select date…"}
          </span>
        </span>
        {hasValue && (
          <span
            role="button"
            title="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="shrink-0 rounded p-0.5 text-fg-subtle hover:text-red-500 hover:bg-surface-active transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Popover anchored right-0 left-auto to never overflow right screen edge */}
      {open && (
        <div className="absolute right-0 left-auto top-full z-50 mt-1.5 w-56 rounded-xl border border-border bg-surface p-2.5 shadow-xl animate-scale-in">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-1">
              <CalendarDots className="h-3 w-3 text-amber-500" />
              Submission Date
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

          {/* Date Picker row */}
          <div className="mb-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="h-7.5 w-full rounded-md border border-border bg-surface-hover/60 px-2 text-xs text-fg outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40 cursor-pointer"
            />
          </div>

          {/* Done button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-md bg-primary py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
