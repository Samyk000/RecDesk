import { useMemo, useState } from "react";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
  Briefcase,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { useCandidatesWithJob, useUpdateCandidate } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { DetailDrawer } from "../components/common/DetailDrawer";
import { CandidateDetailPanel } from "../components/candidates/CandidateDetailPanel";
import {
  extractCalendarEvents,
  getMonthMatrix,
  getCalendarAnalytics,
  formatDateKey,
  type CalendarEvent,
} from "../lib/calendarUtils";
import {
  toCandidateInput,
  parseInterviewRounds,
  serializeInterviewRounds,
  getActiveInterviewSchedule,
} from "../lib/candidateUtils";
import { cn, nameInitials } from "../lib/utils";
import { toast } from "sonner";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar() {
  const { data: candidates, isLoading } = useCandidatesWithJob();
  const updateCandidate = useUpdateCandidate();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    () => formatDateKey(new Date()) || "",
  );
  const [filterType, setFilterType] = useState<"all" | "submission" | "interview">("all");
  const [analyticsScope, setAnalyticsScope] = useState<"month" | "week">("month");
  const [viewScope, setViewScope] = useState<"day" | "month">("day");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);

  // Extract all historical and scheduled events (external submissions & interviews)
  const allEvents = useMemo(() => {
    if (!candidates) return [];
    return extractCalendarEvents(candidates);
  }, [candidates]);

  // Compute month matrix
  const dayCells = useMemo(() => {
    return getMonthMatrix(currentDate, allEvents);
  }, [currentDate, allEvents]);

  // Compute analytics
  const analytics = useMemo(() => {
    return getCalendarAnalytics(allEvents, currentDate, analyticsScope);
  }, [allEvents, currentDate, analyticsScope]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate((d) => {
      const nextD = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      setSelectedDateKey(formatDateKey(nextD) || "");
      return nextD;
    });
  };
  const nextMonth = () => {
    setCurrentDate((d) => {
      const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      setSelectedDateKey(formatDateKey(nextD) || "");
      return nextD;
    });
  };
  const jumpToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateKey(formatDateKey(today) || "");
    setViewScope("day");
  };

  // Events in active month
  const currentMonthEvents = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    return allEvents.filter((ev) => {
      const [ey, em] = ev.dateKey.split("-").map(Number);
      const inMonth = ey === y && em === m + 1;
      const matchesFilter = filterType === "all" || ev.type === filterType;
      return inMonth && matchesFilter;
    });
  }, [allEvents, currentDate, filterType]);

  // Events for selected date
  const selectedDayEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      const matchesDate = ev.dateKey === selectedDateKey;
      const matchesFilter = filterType === "all" || ev.type === filterType;
      return matchesDate && matchesFilter;
    });
  }, [allEvents, selectedDateKey, filterType]);

  // Active list filtered by search query
  const displayedEvents = useMemo(() => {
    const base = viewScope === "day" ? selectedDayEvents : currentMonthEvents;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter((ev) => {
      const nameMatch = ev.candidate.name.toLowerCase().includes(q);
      const jobMatch = ev.candidate.job_title?.toLowerCase().includes(q);
      const clientMatch = ev.candidate.client_name?.toLowerCase().includes(q);
      return nameMatch || jobMatch || clientMatch;
    });
  }, [viewScope, selectedDayEvents, currentMonthEvents, searchQuery]);

  // Selected date formatted title
  const selectedDateTitle = useMemo(() => {
    if (viewScope === "month") {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (!selectedDateKey) return "Select a date";
    const [y, m, d] = selectedDateKey.split("-").map(Number);
    if (!y || !m || !d) return selectedDateKey;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDateKey, viewScope, currentDate]);

  // Handler to remove submission or interview entry added by mistake
  const handleRemoveEntry = async (e: React.MouseEvent, ev: CalendarEvent) => {
    e.stopPropagation();

    try {
      if (ev.type === "submission") {
        await updateCandidate.mutateAsync({
          id: ev.candidate.id,
          input: {
            ...toCandidateInput(ev.candidate),
            submitted_at: null,
            client_feedback: null,
            submission_status:
              ev.candidate.submission_status === "submitted"
                ? "in_touch"
                : ev.candidate.submission_status,
          },
        });
        toast.success(`Removed submission entry for ${ev.candidate.name}`);
      } else if (ev.type === "interview") {
        const rounds = parseInterviewRounds(
          ev.candidate.interview_status,
          ev.candidate.interview_at,
        );
        const remainingRounds = rounds.filter((r) => r.round_number !== ev.roundNumber);

        await updateCandidate.mutateAsync({
          id: ev.candidate.id,
          input: {
            ...toCandidateInput(ev.candidate),
            interview_status:
              remainingRounds.length > 0 ? serializeInterviewRounds(remainingRounds) : null,
            interview_at: getActiveInterviewSchedule(remainingRounds),
            submission_status:
              remainingRounds.length === 0 && ev.candidate.submission_status === "interview"
                ? "submitted"
                : ev.candidate.submission_status,
          },
        });
        toast.success(`Removed interview entry for ${ev.candidate.name}`);
      } else if (ev.type === "placement") {
        await updateCandidate.mutateAsync({
          id: ev.candidate.id,
          input: {
            ...toCandidateInput(ev.candidate),
            placed_at: null,
            submission_status: "interview",
          },
        });
        toast.success(`Cleared placement date for ${ev.candidate.name}`);
      }
    } catch {
      toast.error("Failed to remove calendar entry");
    }
  };

  if (isLoading) return <PageLoader label="Loading calendar events…" />;

  return (
    <div className="flex h-full flex-col px-6 pt-3 pb-4 overflow-hidden">
      {/* Top Header & Analytics Ribbon */}
      <div className="shrink-0 mb-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-surface p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
                title="Previous Month"
              >
                <CaretLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={jumpToday}
                className="px-2.5 py-1 text-xs font-semibold text-fg transition-colors hover:bg-surface-hover rounded-md cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
                title="Next Month"
              >
                <CaretRight className="h-4 w-4" />
              </button>
            </div>

            <h1 className="font-display text-lg font-bold tracking-tight text-fg">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h1>
          </div>

          {/* Filter & Scope Controls */}
          <div className="flex items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center rounded-lg border border-border/80 bg-surface p-0.5 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={cn(
                  "px-2 py-0.5 rounded font-medium transition-all cursor-pointer",
                  filterType === "all" ? "bg-primary text-white" : "text-fg-muted hover:text-fg",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("submission")}
                className={cn(
                  "px-2 py-0.5 rounded font-medium transition-all cursor-pointer",
                  filterType === "submission"
                    ? "bg-amber-500 text-white"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                Submissions
              </button>
              <button
                type="button"
                onClick={() => setFilterType("interview")}
                className={cn(
                  "px-2 py-0.5 rounded font-medium transition-all cursor-pointer",
                  filterType === "interview"
                    ? "bg-violet-500 text-white"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                Interviews
              </button>
            </div>

            {/* Scope Toggle */}
            <div className="flex items-center rounded-lg border border-border/80 bg-surface p-0.5 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setAnalyticsScope("month")}
                className={cn(
                  "px-2 py-0.5 rounded font-medium transition-all cursor-pointer",
                  analyticsScope === "month"
                    ? "bg-surface-active font-semibold text-fg"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsScope("week")}
                className={cn(
                  "px-2 py-0.5 rounded font-medium transition-all cursor-pointer",
                  analyticsScope === "week"
                    ? "bg-surface-active font-semibold text-fg"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                Week
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Velocity Ribbon */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {/* 1. Submissions metric */}
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 shadow-2xs">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs">
              {analytics.totalSubmissions}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-fg">Submissions</p>
              <p className="text-[10px] text-fg-muted truncate">
                External client submissions
              </p>
            </div>
          </div>

          {/* 2. Interviews metric */}
          <div className="flex items-center gap-2.5 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-1.5 shadow-2xs">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold text-xs">
              {analytics.totalInterviews}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-fg">Interviews</p>
              <p className="text-[10px] text-fg-muted truncate">
                R1: <strong>{analytics.round1Interviews}</strong> · R2:{" "}
                <strong>{analytics.round2Interviews}</strong>
                {analytics.round3PlusInterviews > 0 && ` · R3+: ${analytics.round3PlusInterviews}`}
              </p>
            </div>
          </div>

          {/* 3. Placed metric */}
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 shadow-2xs">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              {analytics.totalPlaced}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-fg">Placed</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                Successful placements
              </p>
            </div>
          </div>

          {/* 4. Rejected metric */}
          <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 shadow-2xs">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-600 dark:text-red-400 font-bold text-xs">
              {analytics.totalRejected}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-fg">Rejections</p>
              <p className="text-[10px] text-fg-muted truncate">
                Screening & interview dropoffs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body: Calendar Grid (Left) + Selected Day Event Details (Right) */}
      <div className="flex flex-1 gap-3.5 overflow-hidden min-h-0">
        {/* Left: 7-Column Month Calendar Grid */}
        <div className="flex flex-[1.4] flex-col rounded-xl border border-border bg-surface overflow-hidden shadow-2xs">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-active/40 text-center text-[11px] font-semibold text-fg-subtle py-1.5">
            {WEEKDAY_NAMES.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid flex-1 grid-cols-7 grid-rows-5 md:grid-rows-6 gap-px bg-border/40 overflow-hidden">
            {dayCells.map((cell) => {
              const isSelected = cell.dateKey === selectedDateKey && viewScope === "day";
              const subCount = cell.events.filter((e) => e.type === "submission").length;
              const intCount = cell.events.filter((e) => e.type === "interview").length;
              const plcCount = cell.events.filter((e) => e.type === "placement").length;

              return (
                <button
                  type="button"
                  key={cell.dateKey}
                  onClick={() => {
                    setSelectedDateKey(cell.dateKey);
                    if (!cell.isCurrentMonth) {
                      setCurrentDate(cell.date);
                    }
                    setViewScope("day");
                  }}
                  className={cn(
                    "group relative flex flex-col items-start p-1.5 text-left transition-all duration-150 cursor-pointer overflow-hidden bg-surface",
                    !cell.isCurrentMonth && "bg-surface-active/20 opacity-40",
                    cell.isToday && "bg-primary/5",
                    isSelected
                      ? "ring-2 ring-primary ring-inset bg-primary/10 z-10"
                      : "hover:bg-surface-hover/70",
                  )}
                >
                  {/* Day Number Header */}
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11.5px] font-medium transition-colors",
                        cell.isToday
                          ? "bg-primary text-white font-bold"
                          : isSelected
                            ? "font-bold text-primary"
                            : cell.isCurrentMonth
                              ? "text-fg"
                              : "text-fg-subtle",
                      )}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Total Event Pill for the day */}
                    {cell.events.length > 0 && (
                      <span className="text-[9.5px] font-semibold tabular-nums text-fg-muted">
                        {cell.events.length}
                      </span>
                    )}
                  </div>

                  {/* Event Indicator Dots / Pills */}
                  <div className="mt-1 flex w-full flex-col gap-0.5 min-h-0 overflow-hidden">
                    {subCount > 0 && (
                      <div className="flex items-center gap-1 rounded bg-amber-500/10 px-1 py-0.5 text-[9.5px] font-medium text-amber-700 dark:text-amber-300 truncate">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">
                          {subCount} Sub{subCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                    {intCount > 0 && (
                      <div className="flex items-center gap-1 rounded bg-violet-500/10 px-1 py-0.5 text-[9.5px] font-medium text-violet-700 dark:text-violet-300 truncate">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                        <span className="truncate">
                          {intCount} Interview{intCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                    {plcCount > 0 && (
                      <div className="flex items-center gap-1 rounded bg-emerald-500/10 px-1 py-0.5 text-[9.5px] font-medium text-emerald-700 dark:text-emerald-300 truncate">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="truncate">Placed</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Events Table / Drawer */}
        <div className="flex flex-1 flex-col rounded-xl border border-border bg-surface overflow-hidden shadow-2xs">
          {/* Right Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3.5 py-2 bg-surface-active/30">
            <div>
              <h2 className="font-display text-[13px] font-bold text-fg">
                {selectedDateTitle}
              </h2>
              <p className="text-[10.5px] text-fg-muted">
                {displayedEvents.length} event{displayedEvents.length !== 1 ? "s" : ""}{" "}
                recorded
              </p>
            </div>

            {/* Day vs Month View Toggle */}
            <div className="flex items-center rounded-md border border-border/80 bg-surface p-0.5 text-[10.5px]">
              <button
                type="button"
                onClick={() => setViewScope("day")}
                className={cn(
                  "px-2 py-0.5 rounded font-medium transition-all cursor-pointer",
                  viewScope === "day"
                    ? "bg-primary text-white font-semibold"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                Day ({selectedDayEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setViewScope("month")}
                className={cn(
                  "px-2 py-0.5 rounded font-medium transition-all cursor-pointer",
                  viewScope === "month"
                    ? "bg-primary text-white font-semibold"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                Month ({currentMonthEvents.length})
              </button>
            </div>
          </div>

          {/* Quick Filter Search Bar */}
          <div className="px-2.5 pt-2 pb-1 border-b border-border/50">
            <div className="relative flex items-center">
              <MagnifyingGlass className="absolute left-2.5 h-3.5 w-3.5 text-fg-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter events by candidate or job…"
                className="w-full rounded-md border border-border bg-surface-hover/30 pl-8 pr-2.5 py-1 text-xs text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-fg-subtle hover:text-fg p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Events List / Table */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 [scrollbar-width:thin]">
            {displayedEvents.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center text-fg-subtle">
                <CalendarBlank className="h-8 w-8 mb-2 opacity-30 text-fg-subtle" />
                <p className="text-xs font-medium text-fg-muted">No events found</p>
                <p className="text-[11px] text-fg-subtle mt-0.5">
                  {searchQuery
                    ? `No matching records for "${searchQuery}".`
                    : "Click on any highlighted date or switch to Month view."}
                </p>
                {currentMonthEvents.length > 0 && viewScope === "day" && (
                  <button
                    type="button"
                    onClick={() => setViewScope("month")}
                    className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    View all {currentMonthEvents.length} events in this month →
                  </button>
                )}
              </div>
            ) : (
              displayedEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setActiveCandidateId(ev.candidate.id)}
                  className="group relative flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface p-2.5 transition-all duration-150 hover:border-border-strong hover:bg-surface-hover/80 hover:shadow-2xs cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        ev.type === "submission"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : ev.type === "interview"
                            ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {nameInitials(ev.candidate.name)}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-fg group-hover:text-primary transition-colors">
                          {ev.candidate.name}
                        </span>
                      </div>

                      <p className="text-[11px] text-fg-subtle truncate flex items-center gap-1 mt-0.5">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        <span className="truncate">{ev.candidate.job_title}</span>
                        {ev.candidate.client_name && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-fg-muted truncate">
                              {ev.candidate.client_name}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge
                        status={ev.candidate.submission_status}
                        subStage={ev.subStage}
                        className="scale-90 origin-right"
                      />
                      <div className="flex items-center gap-1 text-[10px] font-medium tabular-nums text-fg-subtle">
                        {viewScope === "month" && (
                          <span>{ev.dateKey} · </span>
                        )}
                        {ev.formattedTime ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-primary" />
                            {ev.formattedTime}
                          </span>
                        ) : (
                          <span>Recorded</span>
                        )}
                      </div>
                    </div>

                    {/* Small X button to clear/remove accidental entry */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveEntry(e, ev)}
                      className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle opacity-40 hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Remove this calendar entry"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Candidate Detail Overlay Drawer */}
      {activeCandidateId && (
        <DetailDrawer onClose={() => setActiveCandidateId(null)}>
          <CandidateDetailPanel
            candidateId={activeCandidateId}
            onClose={() => setActiveCandidateId(null)}
          />
        </DetailDrawer>
      )}
    </div>
  );
}
