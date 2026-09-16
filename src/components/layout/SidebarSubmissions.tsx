import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PaperPlaneTilt, CaretDown, CalendarBlank } from "@phosphor-icons/react";
import { useCandidatesWithJob } from "../../hooks/useQueries";
import { isExternalSubmission, getSubmissionTimestamp } from "../../lib/candidateUtils";
import { cn } from "../../lib/utils";
import type { CandidateWithJob } from "../../types";

function formatSubmissionDate(iso?: string | null): {
  dateLabel: string;
  isToday: boolean;
  isYesterday: boolean;
} {
  if (!iso || !iso.trim()) {
    return { dateLabel: "Date TBD", isToday: false, isYesterday: false };
  }

  const trimmed = iso.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
      return { dateLabel: "Date TBD", isToday: false, isYesterday: false };
    }
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { dateLabel: dateStr, isToday: false, isYesterday: false };
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
    return { dateLabel: "Today", isToday: true, isYesterday: false };
  }

  if (diffDays === 1) {
    return { dateLabel: "Yesterday", isToday: false, isYesterday: true };
  }

  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { dateLabel: dateStr, isToday: false, isYesterday: false };
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

  // Strictly filter external submissions across the lifecycle:
  // Active external submissions, interview, placed, and client rejections.
  // Internal reviews / internal rejections are completely excluded.
  const submittedList = useMemo(() => {
    if (!candidates) return [];

    const list = candidates.filter((c) => isExternalSubmission(c));

    return list.sort((a, b) => {
      const timeA = getSubmissionTimestamp(a.submitted_at);
      const timeB = getSubmissionTimestamp(b.submitted_at);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      const updatedA = a.last_updated ? new Date(a.last_updated).getTime() : 0;
      const updatedB = b.last_updated ? new Date(b.last_updated).getTime() : 0;
      return updatedB - updatedA;
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
          {/* Scrollable clean card container */}
          <div
            className={cn(
              "mt-1.5 max-h-[190px] space-y-1 px-0.5 pb-1 scroll-smooth overscroll-contain",
              isTransitioning || collapsed
                ? "overflow-hidden"
                : "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {submittedList.length === 0 ? (
              <div className="mx-0.5 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-3 text-center text-fg-subtle">
                <CalendarBlank className="h-4 w-4 text-fg-subtle" />
                <span className="mt-1 text-[11px] font-medium">No external submissions</span>
              </div>
            ) : (
              submittedList.map((cand) => {
                const sub = formatSubmissionDate(cand.submitted_at);

                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => handleOpenCandidate(cand)}
                    className="group relative flex w-full flex-col rounded-md border border-border/70 bg-surface/90 px-2.5 py-1.5 text-left transition-all duration-150 hover:border-amber-500/50 hover:bg-surface-hover active:scale-[0.99] cursor-pointer shadow-2xs overflow-hidden"
                  >
                    {/* Line 1: Candidate Name + Status Tag (Guaranteed no overflow) */}
                    <div className="flex w-full items-center justify-between gap-1.5 min-w-0 overflow-hidden">
                      <span className="truncate text-[11.5px] font-semibold text-fg group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors min-w-0 flex-1">
                        {cand.name}
                      </span>
                      {cand.submission_status === "rejected" ? (
                        <span className="shrink-0 max-w-[65px] truncate rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          Rejected
                        </span>
                      ) : (
                        <span className="shrink-0 max-w-[65px] truncate rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          External
                        </span>
                      )}
                    </div>

                    {/* Line 2: Client Company + Date */}
                    <div className="mt-1 flex w-full items-center justify-between gap-1 text-[10px] min-w-0 overflow-hidden">
                      <span className="truncate text-fg-muted font-normal min-w-0 flex-1">
                        {cand.client_name || "Direct Client"}
                      </span>
                      <span className="shrink-0 tabular-nums text-fg-subtle">
                        {sub.dateLabel}
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
