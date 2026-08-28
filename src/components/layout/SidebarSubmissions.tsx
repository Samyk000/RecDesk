import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PaperPlaneTilt, CaretDown, CalendarDots, CalendarBlank } from "@phosphor-icons/react";
import { useCandidatesWithJob } from "../../hooks/useQueries";
import { cn } from "../../lib/utils";
import type { CandidateWithJob } from "../../types";

function formatSubmissionDate(
  iso?: string | null,
  overrideType?: "internal" | "client" | "external",
): {
  dateLabel: string;
  type: "internal" | "client";
  isToday: boolean;
  isYesterday: boolean;
} {
  const finalType = overrideType === "internal" ? "internal" : "client";
  if (!iso || !iso.trim()) {
    return {
      dateLabel: "Date TBD",
      type: finalType,
      isToday: false,
      isYesterday: false,
    };
  }

  const trimmed = iso.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
      return {
        dateLabel: "Date TBD",
        type: finalType,
        isToday: false,
        isYesterday: false,
      };
    }
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      dateLabel: dateStr,
      type: finalType,
      isToday: false,
      isYesterday: false,
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const d = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return {
      dateLabel: "Today",
      type: finalType,
      isToday: true,
      isYesterday: false,
    };
  }

  if (diffDays === 1) {
    return {
      dateLabel: "Yesterday",
      type: finalType,
      isToday: false,
      isYesterday: true,
    };
  }

  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    dateLabel: dateStr,
    type: finalType,
    isToday: false,
    isYesterday: false,
  };
}

export function SidebarSubmissions() {
  const navigate = useNavigate();
  const { data: candidates } = useCandidatesWithJob();

  // Collapsible state (closed/collapsed by default, persisted in localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("recdesk_submissions_collapsed");
    return saved === null ? true : saved === "true";
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    localStorage.setItem("recdesk_submissions_collapsed", collapsed.toString());
  }, [collapsed]);

  const handleToggle = () => {
    setIsTransitioning(true);
    setCollapsed((prev) => !prev);
    setTimeout(() => setIsTransitioning(false), 320);
  };

  // Filter candidates strictly in submitted status
  const submittedList = useMemo(() => {
    if (!candidates) return [];

    const list = candidates.filter(
      (c) => c.submission_status === "submitted",
    );

    // Sort chronologically by submitted date descending (most recent first)
    return list.sort((a, b) => {
      const timeA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const timeB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return timeB - timeA;
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
        title={collapsed ? "Expand candidate submissions" : "Collapse candidate submissions"}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted group-hover:text-fg transition-colors">
          <PaperPlaneTilt className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>Submissions</span>
          {submittedList.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              {submittedList.length}
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
            {submittedList.length === 0 ? (
              <div className="mx-0.5 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-3 text-center text-fg-subtle">
                <CalendarBlank className="h-4 w-4 text-fg-subtle" />
                <span className="mt-1 text-[11px] font-medium">No recent submissions</span>
              </div>
            ) : (
              submittedList.map((cand) => {
                const sub = formatSubmissionDate(
                  cand.submitted_at,
                  cand.client_feedback === "internal" ? "internal" : "client",
                );

                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => handleOpenCandidate(cand)}
                    className="group relative flex w-full flex-col items-center justify-center rounded-lg border border-border bg-surface px-2.5 py-2 text-center transition-all duration-150 hover:border-amber-500/50 hover:bg-surface-hover hover:shadow-xs active:scale-[0.98] cursor-pointer shadow-2xs"
                  >
                    {/* Line 1: Candidate Name · Client Name */}
                    <div className="flex w-full items-center justify-center gap-1.5 text-center leading-snug">
                      <span className="truncate text-[12px] font-bold text-fg group-hover:text-primary transition-colors">
                        {cand.name}
                      </span>
                      {cand.client_name && (
                        <>
                          <span className="text-fg-subtle/70 font-semibold text-[11px]">·</span>
                          <span className="truncate text-[11px] font-semibold text-fg-muted">
                            {cand.client_name}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Line 2: Submitted Date & Internal/External Badge */}
                    <div className="mt-1.5 flex items-center justify-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold leading-tight",
                          sub.isToday
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            : sub.isYesterday
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              : "bg-surface-active text-fg border border-border/80",
                        )}
                      >
                        <CalendarDots className="h-3 w-3 shrink-0" />
                        <span className="truncate">{sub.dateLabel}</span>
                      </span>

                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider",
                          sub.type === "internal"
                            ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30",
                        )}
                      >
                        {sub.type}
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
