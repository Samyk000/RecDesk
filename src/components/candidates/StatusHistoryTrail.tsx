import { ClockCounterClockwise, CaretRight, XCircle, X } from "@phosphor-icons/react";
import { getStatusHistoryDetails, formatStageDate } from "../../lib/statusHistoryUtils";
import { submissionPalette } from "../../lib/constants";
import { titleCase, cn } from "../../lib/utils";
import type { Candidate, CandidateWithJob } from "../../types";

interface Props {
  rawHistory?: string | null;
  candidate?: Candidate | CandidateWithJob;
  onReset?: () => void;
}

const NO_DATE_STATUSES = new Set(["sourced", "not_interested", "rejected"]);

export function StatusHistoryTrail({ rawHistory, candidate, onReset }: Props) {
  const { visibleHistory, totalStageCount } = getStatusHistoryDetails(rawHistory, candidate);

  if (!visibleHistory || visibleHistory.length === 0) {
    return null;
  }

  const rejectedEntry = visibleHistory.find((e) => e.to_status === "rejected");

  return (
    <div className="rounded-lg border border-border/50 bg-surface-hover/30 p-2.5 space-y-2 transition-all">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-fg-subtle">
          <ClockCounterClockwise className="h-3 w-3 text-primary" />
          Status History Trail
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-fg-subtle">
            {totalStageCount} {totalStageCount === 1 ? "stage" : "stages"}
          </span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Reset status back to Sourced"
              className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-fg-subtle transition-colors hover:bg-surface-hover hover:text-red-500"
            >
              <X className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Single-line Pipeline Status Badges Chain */}
      <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-surface px-2 py-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
        {visibleHistory.map((entry, index) => {
          const palette = submissionPalette(entry.to_status);

          let dateStr = "";
          if (!NO_DATE_STATUSES.has(entry.to_status)) {
            let stageRawDate = entry.changed_at;
            if (entry.to_status === "submitted" && entry.submitted_at) {
              stageRawDate = entry.submitted_at;
            } else if (entry.to_status === "interview" && entry.interview_at) {
              stageRawDate = entry.interview_at;
            } else if (entry.to_status === "placed" && entry.placed_at) {
              stageRawDate = entry.placed_at;
            }
            dateStr = formatStageDate(stageRawDate);
          }

          return (
            <div key={entry.id || entry.to_status} className="inline-flex items-center gap-1.5 shrink-0">
              {index > 0 && (
                <CaretRight className="h-2.5 w-2.5 text-fg-subtle shrink-0" />
              )}

              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0",
                  palette.badge,
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: palette.dot }}
                />
                <span>{titleCase(entry.to_status)}</span>
                {dateStr && (
                  <span className="text-[9px] font-mono opacity-80 ml-0.5 tabular-nums">
                    ({dateStr})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rejection reason note if candidate was rejected */}
      {rejectedEntry && (
        <div className="pt-0.5">
          <div className="flex items-start gap-1 rounded bg-red-500/10 px-2 py-1 text-[10.5px] text-red-600 dark:text-red-400">
            <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-medium">Reason:</span>{" "}
              <span className="italic text-fg/90">
                {rejectedEntry.rejection_reason?.trim() || "No specific reason provided"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
