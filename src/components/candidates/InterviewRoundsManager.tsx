import { useState } from "react";
import { Plus, Sparkle, X, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { InterviewSchedulePicker } from "./InterviewSchedulePicker";
import { cn } from "../../lib/utils";
import type { InterviewRound } from "../../types";

interface Props {
  rounds: InterviewRound[];
  onChange: (rounds: InterviewRound[]) => void;
  onSelectAndPlace?: () => void;
  onRejectRound?: (roundNumber: number, reason?: string) => void;
}

export function InterviewRoundsManager({
  rounds,
  onChange,
  onSelectAndPlace,
  onRejectRound,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [rejectingRound, setRejectingRound] = useState<number | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const currentIdx = activeIdx >= rounds.length ? Math.max(0, rounds.length - 1) : activeIdx;
  const activeRound = rounds[currentIdx] || {
    id: "round_1",
    round_number: 1,
    round_name: "Round 1: Screening Call",
    scheduled_at: null,
    status: "scheduled" as const,
  };

  const handleAddRound = () => {
    const nextNum = rounds.length + 1;
    const defaultName =
      nextNum === 2
        ? "Round 2: Technical Interview"
        : nextNum === 3
          ? "Round 3: Hiring Manager"
          : `Round ${nextNum}: Interview`;

    const newRound: InterviewRound = {
      id: `round_${Date.now()}`,
      round_number: nextNum,
      round_name: defaultName,
      scheduled_at: null,
      status: "scheduled",
    };

    const nextRounds = [...rounds, newRound];
    onChange(nextRounds);
    setActiveIdx(nextRounds.length - 1);
    toast.success(`Added Round ${nextNum}`);
  };

  const handleUpdateSchedule = (val: string | null) => {
    const nextRounds = rounds.map((r, i) =>
      i === currentIdx ? { ...r, scheduled_at: val } : r,
    );
    onChange(nextRounds);
  };

  const handleDeleteActiveRound = () => {
    if (rounds.length <= 1) return;
    const filtered = rounds.filter((_, i) => i !== currentIdx);
    const renumbered = filtered.map((r, idx) => ({ ...r, round_number: idx + 1 }));
    onChange(renumbered);
    setActiveIdx(Math.max(0, currentIdx - 1));
    toast.success("Interview round removed");
  };

  return (
    <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-1.5">
      {/* Equal-width round switcher & add action */}
      <div className="flex items-center gap-1.5 w-full">
        {rounds.map((r, idx) => {
          const isActive = idx === currentIdx;
          return (
            <div key={r.id || idx} className="flex-1 min-w-0 relative">
              <button
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={cn(
                  "flex h-7 w-full items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-all cursor-pointer truncate shadow-2xs",
                  isActive
                    ? "bg-primary text-primary-fg shadow-xs"
                    : "bg-surface text-fg-subtle hover:text-fg hover:bg-surface-hover border border-border/70",
                )}
                title={`Round ${r.round_number}${r.round_name ? `: ${r.round_name}` : ""}`}
              >
                <span className="truncate">Round {r.round_number}</span>
              </button>
              {rounds.length > 1 && isActive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteActiveRound();
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-primary-fg/70 hover:text-primary-fg hover:bg-black/20 transition-colors cursor-pointer"
                  title={`Remove Round ${r.round_number}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddRound}
          title="Add next interview round"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-primary/40 bg-surface/60 text-primary hover:bg-primary/10 transition-colors shrink-0 cursor-pointer shadow-2xs"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Schedule Picker & Inline Actions Row */}
      <div className="flex items-center gap-1.5 w-full">
        {/* Date & Time Picker */}
        <div className="flex-1 min-w-0">
          <InterviewSchedulePicker
            value={activeRound.scheduled_at}
            onChange={handleUpdateSchedule}
          />
        </div>

        {/* Place & Reject Action Buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onSelectAndPlace}
            title="Mark Candidate as Placed"
            className="flex h-8.5 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer shadow-2xs"
          >
            <Sparkle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span>Place</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRejectingRound(activeRound.round_number);
              setRejectionNotes("");
            }}
            title={`Reject Candidate after Round ${activeRound.round_number}`}
            className="flex h-8.5 items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2.5 text-[11px] font-semibold text-red-700 dark:text-red-300 transition-colors cursor-pointer shadow-2xs"
          >
            <XCircle className="h-3 w-3 text-red-500" />
            <span>Reject</span>
          </button>
        </div>
      </div>

      {/* Rejection Feedback Expansion Box */}
      {rejectingRound !== null && (
        <div className="mt-1 space-y-1.5 rounded-md border border-red-500/30 bg-red-500/5 p-2 animate-[fade-in_0.15s_ease-out]">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-red-700 dark:text-red-300 flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              Reject Round {rejectingRound}
            </span>
            <span className="text-[9.5px] text-fg-subtle">Rejection feedback / notes</span>
          </div>

          <textarea
            rows={2}
            value={rejectionNotes}
            onChange={(e) => setRejectionNotes(e.target.value)}
            placeholder="Type reason or interview feedback (shown on calendar hover)…"
            className="w-full rounded border border-border/80 bg-surface px-2 py-1 text-xs text-fg placeholder:text-fg-subtle/60 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 resize-none"
            autoFocus
          />

          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setRejectingRound(null);
                setRejectionNotes("");
              }}
              className="rounded px-2 py-0.5 text-[10.5px] font-medium text-fg-muted hover:bg-surface-hover cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onRejectRound?.(rejectingRound, rejectionNotes);
                setRejectingRound(null);
                setRejectionNotes("");
              }}
              className="rounded bg-red-600 hover:bg-red-700 px-2.5 py-0.5 text-[10.5px] font-semibold text-white shadow-xs transition-colors cursor-pointer"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
