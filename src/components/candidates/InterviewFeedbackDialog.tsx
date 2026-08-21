import { useEffect, useMemo, useState, useRef } from "react";
import {
  Check,
  CircleNotch,
  Copy,
  PhoneCall,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useCandidate, useJob, useUpdateCandidate } from "../../hooks/useQueries";
import { useDebounce } from "../../hooks/useDebounce";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Spinner } from "../common/Spinner";
import { errorMessage } from "../../lib/utils";
import { toCandidateInput } from "../../lib/candidateUtils";
import type { Candidate, InterviewFeedback } from "../../types";

interface Props {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function parseInterviewFeedback(raw?: string | null): InterviewFeedback {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as InterviewFeedback;
    }
  } catch {
    // Ignore invalid JSON
  }
  return {};
}

export function hasInterviewFeedback(candidate?: Candidate | null): boolean {
  if (!candidate?.interview_feedback) return false;
  const fb = parseInterviewFeedback(candidate.interview_feedback);
  return Boolean(
    fb.q1_duration_and_vibe?.trim() ||
    (fb.q2_topics && fb.q2_topics.some((t) => t.trim().length > 0)) ||
    fb.q3_scope_and_team?.trim() ||
    fb.q4_availability_to_start?.trim() ||
    fb.q5_competing_interviews_and_rating?.trim() ||
    fb.q6_offer_acceptance_permission?.trim() ||
    fb.q7_decision_timeline?.trim()
  );
}

export function InterviewFeedbackDialog({ candidateId, open, onOpenChange }: Props) {
  const { data: candidate, isLoading: candLoading } = useCandidate(open ? candidateId : undefined);
  const { data: job, isLoading: jobLoading } = useJob(candidate?.job_id);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-[680px] overflow-hidden p-0 flex flex-col">
        {candLoading || jobLoading || !candidate ? (
          <div className="flex h-72 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <InterviewFeedbackBody
            candidate={candidate}
            jobTitle={job?.title ?? "Job"}
            clientName={job?.client_name ?? ""}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InterviewFeedbackBody({
  candidate,
  jobTitle,
  clientName,
  onClose,
}: {
  candidate: Candidate;
  jobTitle: string;
  clientName: string;
  onClose: () => void;
}) {
  const updateCandidate = useUpdateCandidate();
  const initialFeedback = useMemo(
    () => parseInterviewFeedback(candidate.interview_feedback),
    [candidate.interview_feedback],
  );

  const [feedback, setFeedback] = useState<InterviewFeedback>(() => ({
    q1_duration_and_vibe: initialFeedback.q1_duration_and_vibe ?? "",
    q2_topics:
      initialFeedback.q2_topics && initialFeedback.q2_topics.length > 0
        ? initialFeedback.q2_topics
        : ["", "", ""],
    q3_scope_and_team: initialFeedback.q3_scope_and_team ?? "",
    q4_availability_to_start: initialFeedback.q4_availability_to_start ?? "",
    q5_competing_interviews_and_rating: initialFeedback.q5_competing_interviews_and_rating ?? "",
    q6_offer_acceptance_permission: initialFeedback.q6_offer_acceptance_permission ?? "",
    q7_decision_timeline: initialFeedback.q7_decision_timeline ?? "",
  }));

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasCopied, setHasCopied] = useState(false);

  const debouncedFeedback = useDebounce(feedback, 450);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  // Sync state if candidate id changes
  useEffect(() => {
    const fresh = parseInterviewFeedback(candidate.interview_feedback);
    setFeedback({
      q1_duration_and_vibe: fresh.q1_duration_and_vibe ?? "",
      q2_topics:
        fresh.q2_topics && fresh.q2_topics.length > 0
          ? fresh.q2_topics
          : ["", "", ""],
      q3_scope_and_team: fresh.q3_scope_and_team ?? "",
      q4_availability_to_start: fresh.q4_availability_to_start ?? "",
      q5_competing_interviews_and_rating: fresh.q5_competing_interviews_and_rating ?? "",
      q6_offer_acceptance_permission: fresh.q6_offer_acceptance_permission ?? "",
      q7_decision_timeline: fresh.q7_decision_timeline ?? "",
    });
  }, [candidate.id]);

  // Debounced Autosave
  useEffect(() => {
    const prevStr = candidate.interview_feedback ?? "{}";
    const nextStr = JSON.stringify(debouncedFeedback);
    if (prevStr === nextStr) return;

    setSaveState("saving");
    updateCandidate.mutate(
      {
        id: candidate.id,
        input: toCandidateInput(candidate, {
          interview_feedback: nextStr,
        }),
      },
      {
        onSuccess: () => {
          setSaveState("saved");
          setTimeout(() => {
            setSaveState((curr) => (curr === "saved" ? "idle" : curr));
          }, 2000);
        },
        onError: (err) => {
          setSaveState("idle");
          toast.error(`Autosave failed: ${errorMessage(err)}`);
        },
      },
    );
  }, [debouncedFeedback]);

  // Topic list handlers
  function handleTopicChange(index: number, val: string) {
    setFeedback((prev) => {
      const copy = [...(prev.q2_topics || [])];
      copy[index] = val;
      return { ...prev, q2_topics: copy };
    });
  }

  function handleAddTopic() {
    setFeedback((prev) => ({
      ...prev,
      q2_topics: [...(prev.q2_topics || []), ""],
    }));
  }

  function handleRemoveTopic(index: number) {
    setFeedback((prev) => {
      const copy = (prev.q2_topics || []).filter((_, i) => i !== index);
      return { ...prev, q2_topics: copy.length > 0 ? copy : [""] };
    });
  }

  // Format Copy
  function handleCopyFormatted() {
    const f = feedbackRef.current;
    const lines: string[] = [];

    lines.push("Feedback call with the candidate after interview:");
    lines.push(`Candidate: ${candidate.name}`);
    if (jobTitle) {
      lines.push(`Role: ${jobTitle}${clientName ? ` (${clientName})` : ""}`);
    }
    if (candidate.interview_at) {
      lines.push(`Interview Date: ${candidate.interview_at}`);
    }
    lines.push("");

    // Q1
    lines.push("1- How did the interview go & what was the duration of it?");
    lines.push(f.q1_duration_and_vibe?.trim() || "N/A");
    lines.push("");

    // Q2
    lines.push("2- Topics discussed during the interview:");
    const validTopics = (f.q2_topics || []).filter((t) => t.trim().length > 0);
    if (validTopics.length > 0) {
      validTopics.forEach((t) => lines.push(`- ${t.trim()}`));
    } else {
      lines.push("- N/A");
    }
    lines.push("");

    // Q3
    lines.push("3- Did they like the scope of work and the team/manager’s approach?");
    lines.push(f.q3_scope_and_team?.trim() || "N/A");
    lines.push("");

    // Q4
    lines.push("4- Did the manager check for availability to start?");
    lines.push(f.q4_availability_to_start?.trim() || "N/A");
    lines.push("");

    // Q5
    lines.push("5- Are you interviewing with other companies? If yes, how would you rate this role?");
    lines.push(f.q5_competing_interviews_and_rating?.trim() || "N/A");
    lines.push("");

    // Q6
    lines.push(
      "6- If the client hiring team calls us to make an offer, do we have your permission to accept and secure the offer on the call on your behalf, or should we call you again for approval?",
    );
    lines.push(f.q6_offer_acceptance_permission?.trim() || "N/A");
    lines.push("");

    // Q7
    lines.push("7- Decision timeline:");
    lines.push(
      f.q7_decision_timeline?.trim() ||
        "He would be able to make a decision on the call or within the same day/a few hours.",
    );

    const fullText = lines.join("\n");
    navigator.clipboard.writeText(fullText).then(() => {
      setHasCopied(true);
      toast.success("Post-interview feedback copied to clipboard!");
      setTimeout(() => setHasCopied(false), 2500);
    });
  }

  return (
    <>
      {/* Header - with right padding to clear built-in dialog close button */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-5 py-3.5 pr-12">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PhoneCall className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DialogTitle className="truncate text-[15px] font-semibold text-fg">
                Interview Feedback Call
              </DialogTitle>
              <span className="truncate text-xs font-normal text-fg-muted">
                — {candidate.name}
              </span>
            </div>
            <p className="truncate text-xs text-fg-subtle">
              {jobTitle} {clientName && `· ${clientName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Autosave status indicator */}
          <div className="flex items-center gap-1.5 text-xs text-fg-subtle mr-1">
            {saveState === "saving" && (
              <>
                <CircleNotch className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-[11.5px]">Saving…</span>
              </>
            )}
            {saveState === "saved" && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Saved
                </span>
              </>
            )}
            {saveState === "idle" && (
              <span className="text-[11.5px] text-fg-subtle/70">Autosaved</span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            onClick={handleCopyFormatted}
          >
            {hasCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Feedback
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Questions Scrollable Body - Compact single-line inputs */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin">
        {/* Question 1 */}
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-3">
          <label className="block text-xs font-semibold text-fg">
            1- How did the interview go & what was the duration of it?
          </label>
          <input
            type="text"
            value={feedback.q1_duration_and_vibe ?? ""}
            onChange={(e) =>
              setFeedback((prev) => ({ ...prev, q1_duration_and_vibe: e.target.value }))
            }
            placeholder="e.g. Went very well, lasted ~45 mins. Discussed system architecture..."
            className="h-8.5 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Question 2 */}
        <div className="space-y-2 rounded-lg border border-border/60 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-fg">
              2- Topics discussed during the interview:
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-primary hover:bg-primary/10"
              onClick={handleAddTopic}
            >
              <Plus className="h-3 w-3" />
              Add Topic
            </Button>
          </div>

          <div className="space-y-2">
            {(feedback.q2_topics || [""]).map((topic, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11.5px] font-medium text-fg-subtle">
                  Topic {String.fromCharCode(65 + idx)}:
                </span>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => handleTopicChange(idx, e.target.value)}
                  placeholder={`e.g. Topic ${String.fromCharCode(65 + idx)}…`}
                  className="h-8 flex-1 rounded-md border border-border bg-surface px-2.5 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {(feedback.q2_topics || []).length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-fg-subtle hover:text-red-500"
                    onClick={() => handleRemoveTopic(idx)}
                    title="Remove topic"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Question 3 */}
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-3">
          <label className="block text-xs font-semibold text-fg">
            3- Did they like the scope of work and the team/manager’s approach?
          </label>
          <input
            type="text"
            value={feedback.q3_scope_and_team ?? ""}
            onChange={(e) =>
              setFeedback((prev) => ({ ...prev, q3_scope_and_team: e.target.value }))
            }
            placeholder="e.g. Loved the scope of work and felt manager was very clear and welcoming..."
            className="h-8.5 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Question 4 */}
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-3">
          <label className="block text-xs font-semibold text-fg">
            4- Did the manager check for availability to start?
          </label>
          <input
            type="text"
            value={feedback.q4_availability_to_start ?? ""}
            onChange={(e) =>
              setFeedback((prev) => ({ ...prev, q4_availability_to_start: e.target.value }))
            }
            placeholder="e.g. Yes, manager asked if candidate can start within 2 weeks notice..."
            className="h-8.5 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Question 5 */}
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-3">
          <label className="block text-xs font-semibold text-fg">
            5- Are you interviewing with other companies? If yes, how would you rate this role?
          </label>
          <input
            type="text"
            value={feedback.q5_competing_interviews_and_rating ?? ""}
            onChange={(e) =>
              setFeedback((prev) => ({
                ...prev,
                q5_competing_interviews_and_rating: e.target.value,
              }))
            }
            placeholder="e.g. In final round with 1 other firm. Rated this position 9/10 as top priority..."
            className="h-8.5 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Question 6 */}
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-3">
          <label className="block text-xs font-semibold text-fg leading-relaxed">
            6- If the client hiring team calls us to make an offer, do we have your permission to accept and secure the offer on the call on your behalf, or should we call you again for approval?
          </label>
          <input
            type="text"
            value={feedback.q6_offer_acceptance_permission ?? ""}
            onChange={(e) =>
              setFeedback((prev) => ({
                ...prev,
                q6_offer_acceptance_permission: e.target.value,
              }))
            }
            placeholder="e.g. Permission granted to accept immediately if rate meets target, otherwise call first..."
            className="h-8.5 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Question 7 */}
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-3">
          <label className="block text-xs font-semibold text-fg">
            7- Decision timeline:
          </label>
          <input
            type="text"
            value={feedback.q7_decision_timeline ?? ""}
            onChange={(e) =>
              setFeedback((prev) => ({ ...prev, q7_decision_timeline: e.target.value }))
            }
            placeholder="e.g. He would be able to make a decision on the call or within the same day/a few hours."
            className="h-8.5 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-5 py-3 text-xs text-fg-subtle">
        <span>All answers are continuously saved as you type.</span>
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}
