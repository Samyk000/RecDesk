import { ClockCounterClockwise, CaretRight, Info, Check, XCircle } from "@phosphor-icons/react";
import { parseStatusHistory } from "../../lib/statusHistoryUtils";
import { submissionPalette } from "../../lib/constants";
import { titleCase, formatDateAbbr, cn } from "../../lib/utils";

interface Props {
  rawHistory?: string | null;
}

export function StatusHistoryTrail({ rawHistory }: Props) {
  const history = parseStatusHistory(rawHistory);

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          <ClockCounterClockwise className="h-3.5 w-3.5 text-primary" />
          Status History Trail
        </p>
        <span className="text-[10px] text-fg-subtle">
          {history.length} {history.length === 1 ? "milestone" : "milestones"}
        </span>
      </div>

      <div className="space-y-1.5 pt-1">
        {history.map((entry) => {
          const fromPalette = submissionPalette(entry.from_status);
          const toPalette = submissionPalette(entry.to_status);
          const dateStr = entry.changed_at ? formatDateAbbr(entry.changed_at) : "";

          return (
            <div
              key={entry.id}
              className="flex flex-col gap-1 rounded-md border border-border/40 bg-surface-hover/50 px-2.5 py-1.5 text-xs transition-colors hover:border-border/80"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      fromPalette.badge,
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: fromPalette.dot }}
                    />
                    {titleCase(entry.from_status)}
                  </span>

                  <CaretRight className="h-3 w-3 text-fg-subtle shrink-0" />

                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      toPalette.badge,
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: toPalette.dot }}
                    />
                    {titleCase(entry.to_status)}
                  </span>
                </div>

                <span className="tabular-nums text-[10.5px] text-fg-subtle">{dateStr}</span>
              </div>

              {/* Specific milestone metadata if present */}
              {entry.to_status === "submitted" && entry.submitted_at && (
                <div className="flex items-center gap-1 text-[11px] text-fg-muted pl-0.5">
                  <Info className="h-3 w-3 shrink-0 text-amber-500" />
                  <span>
                    Submitted record: <strong className="font-medium text-fg">{entry.submitted_at}</strong>
                  </span>
                </div>
              )}

              {entry.to_status === "interview" && entry.interview_at && (
                <div className="flex items-center gap-1 text-[11px] text-fg-muted pl-0.5">
                  <Info className="h-3 w-3 shrink-0 text-primary" />
                  <span>
                    Scheduled: <strong className="font-medium text-fg">{entry.interview_at}</strong>
                  </span>
                </div>
              )}

              {entry.to_status === "placed" && entry.placed_at && (
                <div className="flex items-center gap-1 text-[11px] text-fg-muted pl-0.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span>
                    Placed on: <strong className="font-medium text-fg">{entry.placed_at}</strong>
                  </span>
                </div>
              )}

              {entry.to_status === "rejected" && (
                <div className="flex items-start gap-1 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-600 dark:text-red-400">
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">
                      {entry.from_status === "submitted"
                        ? "Did not proceed to interview"
                        : "Rejected after interview"}
                      :
                    </span>{" "}
                    <span className="italic text-fg/90">
                      {entry.rejection_reason?.trim() || "No specific reason provided"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
