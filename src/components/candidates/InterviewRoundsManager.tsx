import { useState } from "react";
import { Plus, Sparkle, Trash, XCircle } from "@phosphor-icons/react";
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
      {/* Sleek single-line round switcher & delete action */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 flex-1">
          {rounds.map((r, idx) => {
            const isActive = idx === currentIdx;
            return (
              <button
                key={r.id || idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={cn(
                  "flex h-5.5 items-center gap-1 rounded px-2 text-[10.5px] font-semibold transition-all shrink-0 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-fg shadow-2xs"
                    : "bg-surface text-fg-subtle hover:text-fg hover:bg-surface-hover border border-border/70",
                )}
              >
                <span>Round {r.round_number}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleAddRound}
            title="Add next interview round"
            className="flex h-5.5 w-5.5 items-center justify-center rounded border border-dashed border-primary/40 bg-surface/60 text-primary hover:bg-primary/10 transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </div>

        {rounds.length > 1 && (
          <button
            type="button"
            onClick={handleDeleteActiveRound}
            className="rounded p-0.5 text-fg-subtle hover:bg-surface-hover hover:text-red-500 transition-colors shrink-0"
            title={`Delete Round ${activeRound.round_number}`}
          >
            <Trash className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Date & Time Picker for the active round */}
      <InterviewSchedulePicker
        value={activeRound.scheduled_at}
        onChange={handleUpdateSchedule}
      />

      {/* Minimal Rejection Input Box or Actions */}
      {rejectingRound !== null ? (
        <div className="mt-1 space-y-1.5 rounded-md border border-red-500/30 bg-red-500/5 p-2 animate-[fade-in_0.15s_ease-out]">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Reject Round {rejectingRound}
            </span>
            <span className="text-[9.5px] text-fg-subtle">Rejection feedback / notes</span>
          </div>

          <textarea
            rows={2}
            value={rejectionNotes}
            onChange={(e) => setRejectionNotes(e.target.value)}
            placeholder="Type reason or interview feedback (shown on calendar hover)…"
            className="w-full rounded border border-border/80 bg-surface px-2 py-1 text-xs text-fg placeholder:text-fg-subtle/60 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 resize-none"
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
      ) : (
        /* Minimal Place & Reject Round Actions */
        <div className="flex items-center justify-between pt-0.5 border-t border-primary/10">
          <button
            type="button"
            onClick={onSelectAndPlace}
            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            <Sparkle className="h-2.5 w-2.5" />
            <span>Place</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRejectingRound(activeRound.round_number);
              setRejectionNotes("");
            }}
            className="flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:underline cursor-pointer"
          >
            <XCircle className="h-2.5 w-2.5" />
            <span>Reject Round {activeRound.round_number}</span>
          </button>
        </div>
      )}
    </div>
  );
}
