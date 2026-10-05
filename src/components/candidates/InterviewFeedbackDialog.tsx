import { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowCounterClockwise,
  Check,
  CircleNotch,
  Copy,
  PencilSimple,
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
import { cn, errorMessage } from "../../lib/utils";
import { toCandidateInput } from "../../lib/candidateUtils";
import type { Candidate, InterviewFeedback } from "../../types";

interface Props {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DEFAULT_FEEDBACK_QUESTIONS: Record<string, string> = {
  q1: "How did the interview go & what was the duration of it?",
  q2: "Topics discussed during the interview:",
  q3: "Did they like the scope of work and the team/manager’s approach?",
  q4: "Did the manager check for availability to start?",
  q5: "Are you interviewing with other companies? If yes, how would you rate this role?",
  q6: "If the client hiring team calls us to make an offer, do we have your permission to accept and secure the offer on the call on your behalf, or should we call you again for approval?",
  q7: "Decision timeline:",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    custom_questions: initialFeedback.custom_questions,
  }));

  const [isEditingQuestions, setIsEditingQuestions] = useState(false);
  const [questions, setQuestions] = useState<Record<string, string>>(() => {
    let localSaved: Record<string, string> = {};
    try {
      const raw = localStorage.getItem("recdesk_feedback_questions");
      if (raw) localSaved = JSON.parse(raw);
    } catch {}
    return {
      ...DEFAULT_FEEDBACK_QUESTIONS,
      ...localSaved,
      ...(initialFeedback.custom_questions || {}),
    };
  });

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasCopied, setHasCopied] = useState(false);

  const debouncedFeedback = useDebounce(feedback, 450);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  // Sync state if candidate id changes
  useEffect(() => {
    const fresh = parseInterviewFeedback(candidate.interview_feedback);
    let localSaved: Record<string, string> = {};
    try {
      const raw = localStorage.getItem("recdesk_feedback_questions");
      if (raw) localSaved = JSON.parse(raw);
    } catch {}

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
      custom_questions: fresh.custom_questions,
    });

    setQuestions({
      ...DEFAULT_FEEDBACK_QUESTIONS,
      ...localSaved,
      ...(fresh.custom_questions || {}),
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

  // Question label editing handlers
  function handleQuestionChange(key: string, val: string) {
    setQuestions((prev) => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem("recdesk_feedback_questions", JSON.stringify(next));
      } catch {}
      setFeedback((fb) => ({
        ...fb,
        custom_questions: next,
      }));
      return next;
    });
  }

  function handleResetQuestions() {
    setQuestions({ ...DEFAULT_FEEDBACK_QUESTIONS });
    try {
      localStorage.removeItem("recdesk_feedback_questions");
    } catch {}
    setFeedback((fb) => ({
      ...fb,
      custom_questions: { ...DEFAULT_FEEDBACK_QUESTIONS },
    }));
    toast.success("Questions reset to default template");
  }

  // Format Copy: Questions styled in clean bold red (#dc2626) with minimal rich HTML & clean plain text
  async function handleCopyFormatted() {
    const f = feedbackRef.current;
    const q = questions;

    const validTopics = (f.q2_topics || []).filter((t) => t.trim().length > 0);
    const topicsHtml =
      validTopics.length > 0
        ? `<ul style="margin: 4px 0 12px 18px; padding: 0; color: #1f2937; font-size: 13.5px; line-height: 1.5;">${validTopics
            .map((t) => `<li style="margin-bottom: 2px;">${escapeHtml(t.trim())}</li>`)
            .join("")}</ul>`
        : `<div style="color: #4b5563; font-size: 13.5px; margin: 4px 0 12px 0;">- N/A</div>`;

    const topicsPlain =
      validTopics.length > 0
        ? validTopics.map((t) => `- ${t.trim()}`).join("\n")
        : "- N/A";

    const q1Title = q.q1?.trim() || DEFAULT_FEEDBACK_QUESTIONS.q1;
    const q2Title = q.q2?.trim() || DEFAULT_FEEDBACK_QUESTIONS.q2;
    const q3Title = q.q3?.trim() || DEFAULT_FEEDBACK_QUESTIONS.q3;
    const q4Title = q.q4?.trim() || DEFAULT_FEEDBACK_QUESTIONS.q4;
    const q5Title = q.q5?.trim() || DEFAULT_FEEDBACK_QUESTIONS.q5;
    const q6Title = q.q6?.trim() || DEFAULT_FEEDBACK_QUESTIONS.q6;
    const q7Title = q.q7?.trim() || DEFAULT_FEEDBACK_QUESTIONS.q7;

    const q1Ans = f.q1_duration_and_vibe?.trim() || "N/A";
    const q3Ans = f.q3_scope_and_team?.trim() || "N/A";
    const q4Ans = f.q4_availability_to_start?.trim() || "N/A";
    const q5Ans = f.q5_competing_interviews_and_rating?.trim() || "N/A";
    const q6Ans = f.q6_offer_acceptance_permission?.trim() || "N/A";
    const q7Ans =
      f.q7_decision_timeline?.trim() ||
      "He would be able to make a decision on the call or within the same day/a few hours.";

    // Plain text representation (clean and minimal)
    const plainLines: string[] = [
      "Feedback call with the candidate after interview:",
      `Candidate: ${candidate.name}`,
    ];
    if (jobTitle) {
      plainLines.push(`Role: ${jobTitle}${clientName ? ` (${clientName})` : ""}`);
    }
    if (candidate.interview_at) {
      plainLines.push(`Interview Date: ${candidate.interview_at}`);
    }
    plainLines.push("");
    plainLines.push(`1- ${q1Title}`);
    plainLines.push(q1Ans);
    plainLines.push("");
    plainLines.push(`2- ${q2Title}`);
    plainLines.push(topicsPlain);
    plainLines.push("");
    plainLines.push(`3- ${q3Title}`);
    plainLines.push(q3Ans);
    plainLines.push("");
    plainLines.push(`4- ${q4Title}`);
    plainLines.push(q4Ans);
    plainLines.push("");
    plainLines.push(`5- ${q5Title}`);
    plainLines.push(q5Ans);
    plainLines.push("");
    plainLines.push(`6- ${q6Title}`);
    plainLines.push(q6Ans);
    plainLines.push("");
    plainLines.push(`7- ${q7Title}`);
    plainLines.push(q7Ans);

    const plainText = plainLines.join("\n");

    // Rich HTML representation: Questions rendered in red color (#dc2626)
    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; line-height: 1.5; color: #1f2937;">
  <div style="margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
    <div style="font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px;">Feedback Call With Candidate</div>
    <div style="color: #374151; font-size: 13px;"><strong>Candidate:</strong> ${escapeHtml(candidate.name)}</div>
    ${jobTitle ? `<div style="color: #374151; font-size: 13px;"><strong>Role:</strong> ${escapeHtml(jobTitle)}${clientName ? ` (${escapeHtml(clientName)})` : ""}</div>` : ""}
    ${candidate.interview_at ? `<div style="color: #374151; font-size: 13px;"><strong>Interview Date:</strong> ${escapeHtml(candidate.interview_at)}</div>` : ""}
  </div>

  <div style="margin-bottom: 12px;">
    <div style="color: #dc2626; font-weight: 600; font-size: 13.5px; margin-bottom: 3px;">1- ${escapeHtml(q1Title)}</div>
    <div style="color: #1f2937; font-size: 13px; line-height: 1.5; margin-left: 2px;">${escapeHtml(q1Ans)}</div>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="color: #dc2626; font-weight: 600; font-size: 13.5px; margin-bottom: 3px;">2- ${escapeHtml(q2Title)}</div>
    ${topicsHtml}
  </div>

  <div style="margin-bottom: 12px;">
    <div style="color: #dc2626; font-weight: 600; font-size: 13.5px; margin-bottom: 3px;">3- ${escapeHtml(q3Title)}</div>
    <div style="color: #1f2937; font-size: 13px; line-height: 1.5; margin-left: 2px;">${escapeHtml(q3Ans)}</div>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="color: #dc2626; font-weight: 600; font-size: 13.5px; margin-bottom: 3px;">4- ${escapeHtml(q4Title)}</div>
    <div style="color: #1f2937; font-size: 13px; line-height: 1.5; margin-left: 2px;">${escapeHtml(q4Ans)}</div>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="color: #dc2626; font-weight: 600; font-size: 13.5px; margin-bottom: 3px;">5- ${escapeHtml(q5Title)}</div>
    <div style="color: #1f2937; font-size: 13px; line-height: 1.5; margin-left: 2px;">${escapeHtml(q5Ans)}</div>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="color: #dc2626; font-weight: 600; font-size: 13.5px; margin-bottom: 3px;">6- ${escapeHtml(q6Title)}</div>
    <div style="color: #1f2937; font-size: 13px; line-height: 1.5; margin-left: 2px;">${escapeHtml(q6Ans)}</div>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="color: #dc2626; font-weight: 600; font-size: 13.5px; margin-bottom: 3px;">7- ${escapeHtml(q7Title)}</div>
    <div style="color: #1f2937; font-size: 13px; line-height: 1.5; margin-left: 2px;">${escapeHtml(q7Ans)}</div>
  </div>
</div>`.trim();

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);
        setHasCopied(true);
        toast.success("Post-interview feedback copied to clipboard!");
        setTimeout(() => setHasCopied(false), 2500);
        return;
      }
    } catch {
      // Async Clipboard API fallback
    }

    try {
      const listener = (ev: ClipboardEvent) => {
        ev.preventDefault();
        ev.clipboardData?.setData("text/html", html);
        ev.clipboardData?.setData("text/plain", plainText);
      };
      document.addEventListener("copy", listener);
      document.execCommand("copy");
      document.removeEventListener("copy", listener);
      setHasCopied(true);
      toast.success("Post-interview feedback copied to clipboard!");
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      await navigator.clipboard.writeText(plainText);
      setHasCopied(true);
      toast.success("Post-interview feedback copied to clipboard!");
      setTimeout(() => setHasCopied(false), 2500);
    }
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

          {/* Minimal Edit Questions toggle */}
          <Button
            size="sm"
            variant={isEditingQuestions ? "secondary" : "outline"}
            className={cn(
              "h-8 gap-1.5 text-xs font-medium cursor-pointer transition-colors",
              isEditingQuestions && "border-primary/50 bg-primary/10 text-primary font-semibold",
            )}
            onClick={() => setIsEditingQuestions((prev) => !prev)}
            title="Edit question text labels"
          >
            <PencilSimple className="h-3.5 w-3.5" />
            <span>{isEditingQuestions ? "Done Editing" : "Edit Questions"}</span>
          </Button>

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

      {/* Questions Scrollable Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin">
        {/* Subtle helper banner when in editing mode */}
        {isEditingQuestions && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-fg-muted animate-[fade-in_0.15s_ease-out]">
            <div className="flex items-center gap-2">
              <PencilSimple className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Editing question labels. Changes are saved automatically.</span>
            </div>
            <button
              type="button"
              onClick={handleResetQuestions}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer shrink-0"
            >
              <ArrowCounterClockwise className="h-3 w-3" />
              <span>Reset to Default</span>
            </button>
          </div>
        )}

        {/* Question 1 */}
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface/40 p-3">
          {isEditingQuestions ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs font-bold text-red-500">1-</span>
              <input
                type="text"
                value={questions.q1 ?? ""}
                onChange={(e) => handleQuestionChange("q1", e.target.value)}
                placeholder="Question 1 wording..."
                className="h-7.5 w-full rounded border border-dashed border-primary/50 bg-surface px-2.5 text-xs font-semibold text-fg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <label className="block text-xs font-semibold text-fg">
              <span className="text-red-500 dark:text-red-400 font-bold mr-1">1-</span>
              {questions.q1 || DEFAULT_FEEDBACK_QUESTIONS.q1}
            </label>
          )}
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
            {isEditingQuestions ? (
              <div className="flex items-center gap-1.5 flex-1 mr-2">
                <span className="shrink-0 text-xs font-bold text-red-500">2-</span>
                <input
                  type="text"
                  value={questions.q2 ?? ""}
                  onChange={(e) => handleQuestionChange("q2", e.target.value)}
                  placeholder="Question 2 wording..."
                  className="h-7.5 w-full rounded border border-dashed border-primary/50 bg-surface px-2.5 text-xs font-semibold text-fg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            ) : (
              <label className="block text-xs font-semibold text-fg">
                <span className="text-red-500 dark:text-red-400 font-bold mr-1">2-</span>
                {questions.q2 || DEFAULT_FEEDBACK_QUESTIONS.q2}
              </label>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-primary hover:bg-primary/10 shrink-0"
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
          {isEditingQuestions ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs font-bold text-red-500">3-</span>
              <input
                type="text"
                value={questions.q3 ?? ""}
                onChange={(e) => handleQuestionChange("q3", e.target.value)}
                placeholder="Question 3 wording..."
                className="h-7.5 w-full rounded border border-dashed border-primary/50 bg-surface px-2.5 text-xs font-semibold text-fg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <label className="block text-xs font-semibold text-fg">
              <span className="text-red-500 dark:text-red-400 font-bold mr-1">3-</span>
              {questions.q3 || DEFAULT_FEEDBACK_QUESTIONS.q3}
            </label>
          )}
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
          {isEditingQuestions ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs font-bold text-red-500">4-</span>
              <input
                type="text"
                value={questions.q4 ?? ""}
                onChange={(e) => handleQuestionChange("q4", e.target.value)}
                placeholder="Question 4 wording..."
                className="h-7.5 w-full rounded border border-dashed border-primary/50 bg-surface px-2.5 text-xs font-semibold text-fg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <label className="block text-xs font-semibold text-fg">
              <span className="text-red-500 dark:text-red-400 font-bold mr-1">4-</span>
              {questions.q4 || DEFAULT_FEEDBACK_QUESTIONS.q4}
            </label>
          )}
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
          {isEditingQuestions ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs font-bold text-red-500">5-</span>
              <input
                type="text"
                value={questions.q5 ?? ""}
                onChange={(e) => handleQuestionChange("q5", e.target.value)}
                placeholder="Question 5 wording..."
                className="h-7.5 w-full rounded border border-dashed border-primary/50 bg-surface px-2.5 text-xs font-semibold text-fg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <label className="block text-xs font-semibold text-fg">
              <span className="text-red-500 dark:text-red-400 font-bold mr-1">5-</span>
              {questions.q5 || DEFAULT_FEEDBACK_QUESTIONS.q5}
            </label>
          )}
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
          {isEditingQuestions ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs font-bold text-red-500">6-</span>
              <input
                type="text"
                value={questions.q6 ?? ""}
                onChange={(e) => handleQuestionChange("q6", e.target.value)}
                placeholder="Question 6 wording..."
                className="h-7.5 w-full rounded border border-dashed border-primary/50 bg-surface px-2.5 text-xs font-semibold text-fg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <label className="block text-xs font-semibold text-fg leading-relaxed">
              <span className="text-red-500 dark:text-red-400 font-bold mr-1">6-</span>
              {questions.q6 || DEFAULT_FEEDBACK_QUESTIONS.q6}
            </label>
          )}
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
          {isEditingQuestions ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs font-bold text-red-500">7-</span>
              <input
                type="text"
                value={questions.q7 ?? ""}
                onChange={(e) => handleQuestionChange("q7", e.target.value)}
                placeholder="Question 7 wording..."
                className="h-7.5 w-full rounded border border-dashed border-primary/50 bg-surface px-2.5 text-xs font-semibold text-fg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <label className="block text-xs font-semibold text-fg">
              <span className="text-red-500 dark:text-red-400 font-bold mr-1">7-</span>
              {questions.q7 || DEFAULT_FEEDBACK_QUESTIONS.q7}
            </label>
          )}
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
        <span>All answers and customized questions are continuously saved as you type.</span>
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}
