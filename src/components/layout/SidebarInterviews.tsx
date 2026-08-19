import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, CaretDown, Clock, CalendarBlank } from "@phosphor-icons/react";
import { useCandidatesWithJob } from "../../hooks/useQueries";
import { cn } from "../../lib/utils";
import type { CandidateWithJob } from "../../types";

function formatInterviewSchedule(iso: string | null | undefined): {
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  isPast: boolean;
} {
  if (!iso) {
    return { label: "Date TBD", isToday: false, isTomorrow: false, isPast: false };
  }

  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return { label: iso, isToday: false, isTomorrow: false, isPast: false };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const hasTime = iso.includes("T") || iso.includes(":") || d.getHours() !== 0 || d.getMinutes() !== 0;

  if (diffDays === 0) {
    return {
      label: hasTime ? `Today · ${timeStr}` : "Today",
      isToday: true,
      isTomorrow: false,
      isPast: false,
    };
  }

  if (diffDays === 1) {
    return {
      label: hasTime ? `Tomorrow · ${timeStr}` : "Tomorrow",
      isToday: false,
      isTomorrow: true,
      isPast: false,
    };
  }

  const isPast = target.getTime() < today.getTime();
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return {
    label: hasTime ? `${dateStr} · ${timeStr}` : dateStr,
    isToday: false,
    isTomorrow: false,
    isPast,
  };
}

export function SidebarInterviews() {
  const navigate = useNavigate();
  const { data: candidates } = useCandidatesWithJob();

  // Collapsible state (persisted in localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("recdesk_interviews_collapsed") === "true";
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

  // Filter candidates in interview stage or having an interview date
  const upcoming = useMemo(() => {
    if (!candidates) return [];

    const list = candidates.filter(
      (c) => c.submission_status === "interview" || Boolean(c.interview_at),
    );

    // Sort chronologically by interview_at ascending
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
    <div className="flex flex-1 flex-col overflow-hidden px-2">
      {/* Header with Title, Count Badge and Smooth Collapse Arrow */}
      <button
        type="button"
        onClick={handleToggle}
        className="group flex w-full shrink-0 items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover/70 cursor-pointer select-none"
        aria-expanded={!collapsed}
        title={collapsed ? "Expand upcoming interviews" : "Collapse upcoming interviews"}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle group-hover:text-fg transition-colors">
          <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Interviews</span>
          {upcoming.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
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

      {/* Butter-Smooth Collapsible Container with Room for 3+ Cards */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
          collapsed
            ? "grid-rows-[0fr] opacity-0 pointer-events-none"
            : "grid-rows-[1fr] opacity-100 flex-1 min-h-[175px]",
        )}
      >
        <div className="flex min-h-0 flex-col overflow-hidden">
          {/* Invisible smooth scrollbar container */}
          <div
            className={cn(
              "mt-1 flex-1 space-y-1.5 px-0.5 pb-1 scroll-smooth overscroll-contain",
              isTransitioning || collapsed
                ? "overflow-hidden"
                : "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {upcoming.length === 0 ? (
              <div className="mx-0.5 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-4 text-center text-fg-subtle">
                <CalendarBlank className="h-4 w-4 text-fg-subtle/60" />
                <span className="mt-1 text-[11px] font-medium">No upcoming interviews</span>
              </div>
            ) : (
              upcoming.map((cand) => {
                const schedule = formatInterviewSchedule(cand.interview_at);

                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => handleOpenCandidate(cand)}
                    className="group relative flex w-full flex-col items-center justify-center rounded-lg border border-border/50 bg-surface/50 px-2.5 py-2 text-center transition-all duration-150 hover:border-primary/40 hover:bg-surface-hover active:scale-[0.98] cursor-pointer shadow-2xs"
                  >
                    {/* Line 1: Candidate Name · Client Name */}
                    <div className="flex w-full items-center justify-center gap-1.5 text-center leading-snug">
                      <span className="truncate text-[12px] font-semibold text-fg group-hover:text-primary transition-colors">
                        {cand.name}
                      </span>
                      {cand.client_name && (
                        <>
                          <span className="text-fg-subtle/50 font-normal">·</span>
                          <span className="truncate text-[11px] font-medium text-fg-muted">
                            {cand.client_name}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Line 2: Date & Time */}
                    <div className="mt-1 flex items-center justify-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-none tracking-tight",
                          schedule.isToday
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : schedule.isTomorrow
                              ? "bg-primary/15 text-primary font-semibold"
                              : schedule.isPast
                                ? "bg-surface-active text-fg-subtle"
                                : "bg-surface-active/80 text-fg-muted",
                        )}
                      >
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{schedule.label}</span>
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
