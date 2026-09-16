import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, CaretDown, CalendarBlank } from "@phosphor-icons/react";
import { useCandidatesWithJob } from "../../hooks/useQueries";
import { cn } from "../../lib/utils";
import { parseInterviewRounds } from "../../lib/candidateUtils";
import type { CandidateWithJob } from "../../types";

function formatInterviewSchedule(iso: string | null | undefined): {
  dateLabel: string;
  timeLabel: string;
  tz: string;
  isToday: boolean;
  isTomorrow: boolean;
  isPast: boolean;
} {
  if (!iso) {
    return {
      dateLabel: "Date TBD",
      timeLabel: "",
      tz: "",
      isToday: false,
      isTomorrow: false,
      isPast: false,
    };
  }

  const parts = iso.trim().split(/\s+/);
  const dateTimePart = parts[0] || "";
  const tz = parts[1] || "";

  const d = new Date(dateTimePart);
  if (isNaN(d.getTime())) {
    return {
      dateLabel: iso,
      timeLabel: "",
      tz: "",
      isToday: false,
      isTomorrow: false,
      isPast: false,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const [h24, m24] = [d.getHours(), d.getMinutes()];
  const period = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const timeFormatted = `${hour12}:${String(m24).padStart(2, "0")} ${period}`;

  const hasTime =
    dateTimePart.includes("T") ||
    dateTimePart.includes(":") ||
    h24 !== 0 ||
    m24 !== 0;

  if (diffDays === 0) {
    return {
      dateLabel: "Today",
      timeLabel: hasTime ? timeFormatted : "",
      tz,
      isToday: true,
      isTomorrow: false,
      isPast: false,
    };
  }

  if (diffDays === 1) {
    return {
      dateLabel: "Tomorrow",
      timeLabel: hasTime ? timeFormatted : "",
      tz,
      isToday: false,
      isTomorrow: true,
      isPast: false,
    };
  }

  if (diffDays < 0) {
    const isYesterday = diffDays === -1;
    const dateStr = isYesterday
      ? "Yesterday"
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      dateLabel: dateStr,
      timeLabel: hasTime ? timeFormatted : "",
      tz,
      isToday: false,
      isTomorrow: false,
      isPast: true,
    };
  }

  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    dateLabel: dateStr,
    timeLabel: hasTime ? timeFormatted : "",
    tz,
    isToday: false,
    isTomorrow: false,
    isPast: false,
  };
}

export function SidebarInterviews() {
  const navigate = useNavigate();
  const { data: candidates } = useCandidatesWithJob();

  // Collapsible state (closed/collapsed by default, persisted in localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("recdesk_interviews_collapsed");
    return saved === null ? true : saved === "true";
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    localStorage.setItem("recdesk_interviews_collapsed", collapsed.toString());
  }, [collapsed]);

  const handleToggle = () => {
    setIsTransitioning(true);
    setCollapsed((prev) => !prev);
    setTimeout(() => setIsTransitioning(false), 320);
  };

  // Filter candidates in interview status
  const upcoming = useMemo(() => {
    if (!candidates) return [];

    const list = candidates.filter((c) => c.submission_status === "interview");

    // Sort chronologically (earliest/upcoming first, TBD last)
    return list.sort((a, b) => {
      if (!a.interview_at && !b.interview_at) return 0;
      if (!a.interview_at) return 1;
      if (!b.interview_at) return -1;
      return new Date(a.interview_at).getTime() - new Date(b.interview_at).getTime();
    });
  }, [candidates]);

  const handleOpenCandidate = (candidate: CandidateWithJob) => {
    navigate(`/candidates?candidate=${candidate.id}`);
  };

  return (
    <div className="flex flex-col px-2">
      {/* Header with Title, Count Badge and Smooth Collapse Arrow */}
      <button
        type="button"
        onClick={handleToggle}
        className="group flex w-full shrink-0 items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover cursor-pointer select-none"
        aria-expanded={!collapsed}
        title={collapsed ? "Expand candidate interviews" : "Collapse candidate interviews"}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted group-hover:text-fg transition-colors">
          <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Interviews</span>
          {upcoming.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
              {upcoming.length}
            </span>
          )}
        </div>

        <CaretDown
          className={cn(
            "h-3.5 w-3.5 text-fg-subtle transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:text-fg",
            collapsed ? "-rotate-90" : "rotate-0",
          )}
        />
      </button>

      {/* Butter-Smooth Collapsible Container with Max 3 Cards Height */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
          collapsed
            ? "grid-rows-[0fr] opacity-0 pointer-events-none"
            : "grid-rows-[1fr] opacity-100",
        )}
      >
        <div className="flex min-h-0 flex-col overflow-hidden">
          {/* High-contrast scrollable card container */}
          <div
            className={cn(
              "mt-1.5 max-h-[190px] space-y-1.5 px-0.5 pb-1 scroll-smooth overscroll-contain",
              isTransitioning || collapsed
                ? "overflow-hidden"
                : "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {upcoming.length === 0 ? (
              <div className="mx-0.5 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-3 text-center text-fg-subtle">
                <CalendarBlank className="h-4 w-4 text-fg-subtle" />
                <span className="mt-1 text-[11px] font-medium">No upcoming interviews</span>
              </div>
            ) : (
              upcoming.map((cand) => {
                const schedule = formatInterviewSchedule(cand.interview_at);
                const rounds = parseInterviewRounds(cand.interview_status, cand.interview_at);
                const roundNum = rounds.length || 1;

                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => handleOpenCandidate(cand)}
                    className="group relative flex w-full flex-col rounded-md border border-border/70 bg-surface/90 px-2.5 py-1.5 text-left transition-all duration-150 hover:border-primary/50 hover:bg-surface-hover active:scale-[0.99] cursor-pointer shadow-2xs overflow-hidden"
                  >
                    {/* Line 1: Candidate Name + Round Tag (Guaranteed no overflow) */}
                    <div className="flex w-full items-center justify-between gap-1.5 min-w-0 overflow-hidden">
                      <span className="truncate text-[11.5px] font-semibold text-fg group-hover:text-primary transition-colors min-w-0 flex-1">
                        {cand.name}
                      </span>
                      <span className="shrink-0 max-w-[50px] truncate rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 text-[9px] font-bold tabular-nums tracking-wide">
                        R{roundNum}
                      </span>
                    </div>

                    {/* Line 2: Client Company + Date / Time */}
                    <div className="mt-1 flex w-full items-center justify-between gap-1 text-[10px] min-w-0 overflow-hidden">
                      <span className="truncate text-fg-muted font-normal min-w-0 flex-1">
                        {cand.client_name || "Direct Client"}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums font-medium",
                          schedule.isToday
                            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                            : schedule.isTomorrow
                              ? "text-primary font-semibold"
                              : "text-fg-subtle",
                        )}
                      >
                        {schedule.dateLabel}
                        {schedule.timeLabel ? `, ${schedule.timeLabel}` : ""}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
