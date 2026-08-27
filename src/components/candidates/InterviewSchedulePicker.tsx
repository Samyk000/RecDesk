import { useState, useRef, useEffect, useMemo } from "react";
import { CalendarDots, Clock } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

export const US_TIMEZONES = ["EST", "CST", "MST", "PST"] as const;
export type USTimezone = (typeof US_TIMEZONES)[number];

interface Props {
  value?: string | null;
  onChange: (val: string | null) => void;
  className?: string;
}

interface ParsedSchedule {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  timezone: USTimezone;
}

function parseScheduleString(val?: string | null): ParsedSchedule {
  const defaultTz = (localStorage.getItem("recdesk_default_tz") as USTimezone) || "EST";
  if (!val) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: "10:00",
      timezone: defaultTz,
    };
  }

  // Handle strings like "2026-08-25T14:30 EST", "2026-08-25T14:30:00 PST", or ISO "2026-08-25T14:30"
  const parts = val.trim().split(/\s+/);
  const dateTimePart = parts[0];
  const foundTz = parts[1] as USTimezone;
  const tz: USTimezone = US_TIMEZONES.includes(foundTz) ? foundTz : defaultTz;

  if (dateTimePart.includes("T")) {
    const [d, t] = dateTimePart.split("T");
    const cleanTime = t ? t.substring(0, 5) : "10:00";
    return { date: d || "", time: cleanTime, timezone: tz };
  }

  return { date: dateTimePart, time: "10:00", timezone: tz };
}

function formatDisplay(val?: string | null): { dateStr: string; timeStr: string; tz: string } {
  if (!val) return { dateStr: "Schedule interview", timeStr: "", tz: "" };
  const parsed = parseScheduleString(val);
  if (!parsed.date) return { dateStr: "Schedule interview", timeStr: "", tz: "" };

  const [y, m, d] = parsed.date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateFormatted = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const [h, min] = parsed.time.split(":").map(Number);
  const period = (h || 0) >= 12 ? "PM" : "AM";
  const hour12 = (h || 0) % 12 === 0 ? 12 : (h || 0) % 12;
  const timeFormatted = `${hour12}:${String(min || 0).padStart(2, "0")} ${period}`;

  return {
    dateStr: dateFormatted,
    timeStr: timeFormatted,
    tz: parsed.timezone,
  };
}

export function InterviewSchedulePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initial = useMemo(() => parseScheduleString(value), [value]);
  const [selectedDate, setSelectedDate] = useState(initial.date);
  const [selectedTime, setSelectedTime] = useState(initial.time);
  const [selectedTz, setSelectedTz] = useState<USTimezone>(initial.timezone);

  useEffect(() => {
    const p = parseScheduleString(value);
    setSelectedDate(p.date);
    setSelectedTime(p.time);
    setSelectedTz(p.timezone);
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

  const emitChange = (date: string, time: string, tz: USTimezone) => {
    if (!date) {
      onChange(null);
      return;
    }
    const cleanTime = time || "10:00";
    const full = `${date}T${cleanTime} ${tz}`;
    localStorage.setItem("recdesk_default_tz", tz);
    onChange(full);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    emitChange(date, selectedTime, selectedTz);
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    emitChange(selectedDate, time, selectedTz);
  };

  const handleTzChange = (tz: USTimezone) => {
    setSelectedTz(tz);
    emitChange(selectedDate, selectedTime, tz);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  // 12-hour breakdown for custom time picker
  const [h24, m24] = selectedTime.split(":").map(Number);
  const currentHour12 = (h24 || 0) % 12 === 0 ? 12 : (h24 || 0) % 12;
  const currentPeriod = (h24 || 0) >= 12 ? "PM" : "AM";
  const currentMinutes = m24 || 0;

  const handleCustomHourChange = (newHour12: number) => {
    const isPM = currentPeriod === "PM";
    const final24 = isPM
      ? newHour12 === 12 ? 12 : newHour12 + 12
      : newHour12 === 12 ? 0 : newHour12;
    const newTime = `${String(final24).padStart(2, "0")}:${String(currentMinutes).padStart(2, "0")}`;
    handleTimeChange(newTime);
  };

  const handleCustomMinChange = (newMin: number) => {
    const newTime = `${String(h24 || 0).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`;
    handleTimeChange(newTime);
  };

  const handlePeriodToggle = (newPeriod: "AM" | "PM") => {
    if (newPeriod === currentPeriod) return;
    const final24 = newPeriod === "PM"
      ? currentHour12 === 12 ? 12 : currentHour12 + 12
      : currentHour12 === 12 ? 0 : currentHour12;
    const newTime = `${String(final24).padStart(2, "0")}:${String(currentMinutes).padStart(2, "0")}`;
    handleTimeChange(newTime);
  };

  const display = formatDisplay(value);

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
          <Clock className="h-3 w-3 shrink-0 text-primary" />
          {value ? (
            <span className="truncate font-medium text-[11px] flex items-center gap-1">
              <span>{display.dateStr}</span>
              <span className="text-fg-subtle">·</span>
              <span>{display.timeStr}</span>
            </span>
          ) : (
            <span className="text-fg-muted font-normal text-[11px]">Schedule interview…</span>
          )}
        </span>

        {value && (
          <span className="shrink-0 rounded bg-primary/15 px-1 py-0.2 text-[9.5px] font-bold text-primary tracking-wide">
            {display.tz}
          </span>
        )}
      </button>

      {/* Popover anchored right-0 left-auto to strictly avoid overflowing screen right edge */}
      {open && (
        <div className="absolute right-0 left-auto top-full z-50 mt-1.5 w-full min-w-[225px] max-w-[250px] rounded-xl border border-border bg-surface p-2.5 shadow-xl animate-scale-in">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-1">
              <CalendarDots className="h-3 w-3 text-primary" />
              Date &amp; Time
            </span>
            {value && (
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

          {/* Time Picker row */}
          <div className="mb-2 flex items-center justify-between gap-1 rounded-lg border border-border/70 bg-surface-hover/40 p-1">
            <div className="flex items-center gap-1">
              {/* Hour Dropdown */}
              <select
                value={currentHour12}
                onChange={(e) => handleCustomHourChange(Number(e.target.value))}
                className="h-6.5 rounded border border-border/60 bg-surface px-1 text-xs font-semibold text-fg outline-none focus:border-primary cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((hr) => (
                  <option key={hr} value={hr}>
                    {String(hr).padStart(2, "0")}
                  </option>
                ))}
              </select>

              <span className="text-xs font-bold text-fg-subtle">:</span>

              {/* Minute Dropdown */}
              <select
                value={currentMinutes}
                onChange={(e) => handleCustomMinChange(Number(e.target.value))}
                className="h-6.5 rounded border border-border/60 bg-surface px-1 text-xs font-semibold text-fg outline-none focus:border-primary cursor-pointer"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((min) => (
                  <option key={min} value={min}>
                    {String(min).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>

            {/* AM / PM Toggle */}
            <div className="flex rounded border border-border/60 bg-surface p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => handlePeriodToggle("AM")}
                className={cn(
                  "rounded px-1.5 py-0.5 font-bold transition-colors cursor-pointer",
                  currentPeriod === "AM"
                    ? "bg-primary text-white"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handlePeriodToggle("PM")}
                className={cn(
                  "rounded px-1.5 py-0.5 font-bold transition-colors cursor-pointer",
                  currentPeriod === "PM"
                    ? "bg-primary text-white"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Timezone Row */}
          <div className="mb-2">
            <div className="grid grid-cols-4 gap-1">
              {US_TIMEZONES.map((tz) => (
                <button
                  key={tz}
                  type="button"
                  onClick={() => handleTzChange(tz)}
                  className={cn(
                    "rounded border py-0.5 text-center text-[10.5px] font-bold transition-all cursor-pointer",
                    selectedTz === tz
                      ? "border-primary bg-primary/15 text-primary shadow-2xs"
                      : "border-border/70 text-fg-subtle hover:bg-surface-hover hover:text-fg",
                  )}
                  title={
                    tz === "EST"
                      ? "Eastern Time"
                      : tz === "CST"
                      ? "Central Time"
                      : tz === "MST"
                      ? "Mountain Time"
                      : "Pacific Time"
                  }
                >
                  {tz}
                </button>
              ))}
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
