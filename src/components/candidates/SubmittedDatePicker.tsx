import { useState, useRef, useEffect, useMemo } from "react";
import { CalendarDots, Check } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

export type SubmissionType = "internal" | "external";

interface Props {
  value?: string | null;
  onChange: (val: string | null) => void;
  className?: string;
}

interface ParsedSubmission {
  date: string; // YYYY-MM-DD
  type: SubmissionType;
}

function parseSubmissionString(val?: string | null): ParsedSubmission {
  if (!val) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return {
      date: `${yyyy}-${mm}-${dd}`,
      type: "external",
    };
  }

  const parts = val.trim().split(/\s+/);
  const datePart = parts[0] || "";
  const typePart = (parts[1]?.toLowerCase() as SubmissionType) || "external";
  const finalType: SubmissionType = typePart === "internal" ? "internal" : "external";

  return {
    date: datePart,
    type: finalType,
  };
}

function formatDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return "Select date";
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

  const initial = useMemo(() => parseSubmissionString(value), [value]);
  const [selectedDate, setSelectedDate] = useState(initial.date);
  const [selectedType, setSelectedType] = useState<SubmissionType>(initial.type);

  useEffect(() => {
    const p = parseSubmissionString(value);
    setSelectedDate(p.date);
    setSelectedType(p.type);
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

  const emitChange = (date: string, type: SubmissionType) => {
    if (!date) {
      onChange(null);
      return;
    }
    const full = `${date} ${type}`;
    onChange(full);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    emitChange(date, selectedType);
  };

  const handleTypeChange = (type: SubmissionType) => {
    setSelectedType(type);
    emitChange(selectedDate, type);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const parsed = parseSubmissionString(value);
  const hasValue = Boolean(value);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-7 w-full items-center justify-between gap-1.5 rounded-md border border-border bg-surface-hover/80 px-2 text-[11.5px] text-fg transition-all hover:bg-surface-hover hover:border-border-hover focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer",
          open && "ring-1 ring-primary/50 border-primary/50",
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <CalendarDots className="h-3 w-3 shrink-0 text-primary" />
          <span className={cn("truncate font-medium text-[11px]", !hasValue && "text-fg-muted font-normal")}>
            {hasValue ? formatDateDisplay(parsed.date) : "Select date…"}
          </span>
        </span>

        {hasValue && (
          <span
            className={cn(
              "shrink-0 rounded px-1 py-0.2 text-[9.5px] font-bold uppercase tracking-wider",
              parsed.type === "internal"
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            )}
          >
            {parsed.type}
          </span>
        )}
      </button>

      {/* Popover anchored right-0 left-auto to never overflow the right screen edge */}
      {open && (
        <div className="absolute right-0 left-auto top-full z-50 mt-1.5 w-56 rounded-xl border border-border bg-surface p-2.5 shadow-xl animate-scale-in">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-1">
              <CalendarDots className="h-3 w-3 text-primary" />
              Submission Details
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

          {/* Internal vs External Toggle Row */}
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              Submission Type
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-surface-hover/40 p-0.5">
              <button
                type="button"
                onClick={() => handleTypeChange("internal")}
                className={cn(
                  "flex items-center justify-center gap-1 rounded py-1 text-[11px] font-bold transition-all cursor-pointer",
                  selectedType === "internal"
                    ? "bg-blue-500 text-white shadow-2xs"
                    : "text-fg-subtle hover:text-fg hover:bg-surface-hover",
                )}
              >
                {selectedType === "internal" && <Check className="h-3 w-3" />}
                Internal
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("external")}
                className={cn(
                  "flex items-center justify-center gap-1 rounded py-1 text-[11px] font-bold transition-all cursor-pointer",
                  selectedType === "external"
                    ? "bg-amber-500 text-white shadow-2xs"
                    : "text-fg-subtle hover:text-fg hover:bg-surface-hover",
                )}
              >
                {selectedType === "external" && <Check className="h-3 w-3" />}
                External
              </button>
            </div>
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
