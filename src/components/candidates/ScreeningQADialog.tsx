import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleNotch,
  Copy,
  ListChecks,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useCandidate, useJob, useUpdateCandidate } from "../../hooks/useQueries";
import { useDebounce } from "../../hooks/useDebounce";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Spinner } from "../common/Spinner";
import { errorMessage } from "../../lib/utils";
import type { Candidate } from "../../types";

interface Props {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreeningQADialog({ candidateId, open, onOpenChange }: Props) {
  const { data: candidate, isLoading: candLoading } = useCandidate(open ? candidateId : undefined);
  const { data: job, isLoading: jobLoading } = useJob(candidate?.job_id);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0 flex flex-col">
        {candLoading || jobLoading || !candidate ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ScreeningQABody
            candidate={candidate}
            questions={job?.screening_questions ?? []}
            jobTitle={job?.title ?? "Job"}
            clientName={job?.client_name ?? ""}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseAnswers(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Ignore invalid JSON
  }
  return {};
}

function ScreeningQABody({
  candidate,
  questions,
  jobTitle,
  clientName,
}: {
  candidate: Candidate;
  questions: string[];
  jobTitle: string;
  clientName: string;
  onClose: () => void;
}) {
  const updateCandidate = useUpdateCandidate();
  const initialAnswers = useMemo(() => parseAnswers(candidate.screening_answers), [candidate.screening_answers]);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasCopied, setHasCopied] = useState(false);

  const debouncedAnswers = useDebounce(answers, 600);

  // Sync state if candidate prop changes
  useEffect(() => {
    setAnswers(parseAnswers(candidate.screening_answers));
  }, [candidate.id]);

  // Autosave when answers change
  useEffect(() => {
    const prevStr = JSON.stringify(parseAnswers(candidate.screening_answers));
    const nextStr = JSON.stringify(debouncedAnswers);
    if (prevStr === nextStr) return;

    setSaveState("saving");
    updateCandidate.mutate(
      {
        id: candidate.id,
        input: {
          job_id: candidate.job_id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          location: candidate.location,
          current_title: candidate.current_title,
          current_company: candidate.current_company,
          experience_years: candidate.experience_years,
          resume_path: candidate.resume_path,
          linkedin_url: candidate.linkedin_url,
          recruiter_notes: candidate.recruiter_notes,
          match_score: candidate.match_score,
          submission_status: candidate.submission_status,
          interview_status: candidate.interview_status,
          client_feedback: candidate.client_feedback,
          candidate_status: candidate.candidate_status,
          submitted_at: candidate.submitted_at,
          interview_at: candidate.interview_at,
          rejection_reason: candidate.rejection_reason,
          screening_answers: nextStr,
        },
      },
      {
        onSuccess: () => {
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 1800);
        },
        onError: (err) => {
          setSaveState("idle");
          toast.error(errorMessage(err));
        },
      },
    );
  }, [debouncedAnswers]);

  const handleAnswerChange = (index: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [index.toString()]: text,
    }));
  };

  // Format all Q&A for clipboard copy
  const formattedQA = useMemo(() => {
    if (questions.length === 0) return "";
    return questions
      .map((q, i) => {
        const ans = (answers[i.toString()] || "").trim();
        return `${i + 1} - ${q}\n- ${ans || "(No answer recorded)"}`;
      })
      .join("\n\n");
  }, [questions, answers]);

  const handleCopyAll = async () => {
    if (!formattedQA) return;
    try {
      await navigator.clipboard.writeText(formattedQA);
      setHasCopied(true);
      toast.success("All screening Q&A copied to clipboard!");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const answeredCount = Object.values(answers).filter((a) => a && a.trim().length > 0).length;

  return (
    <>
      {/* Header bar - with pr-12 to reserve space for DialogPrimitive.Close */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-surface pr-12">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-[14px] font-semibold text-fg flex items-center gap-1.5 truncate">
              <span className="truncate">{candidate.name}</span>
              <span className="text-xs font-normal text-fg-subtle">·</span>
              <span className="text-xs font-normal text-fg-muted truncate">{jobTitle} {clientName ? `(${clientName})` : ""}</span>
            </DialogTitle>
            <p className="text-[11px] text-fg-subtle">
              Screening Q&A · {answeredCount}/{questions.length} answered
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveState === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <CircleNotch className="h-3 w-3 animate-spin text-primary" />
              Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}

          {questions.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleCopyAll}
              className="h-7 gap-1.5 px-3 text-xs shadow-sm font-medium"
            >
              {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {hasCopied ? "Copied!" : "Copy all in format"}
            </Button>
          )}
        </div>
      </div>

      {/* Questions list with compact, refined layout */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-background scrollbar-thin">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-2">
              <WarningCircle className="h-4.5 w-4.5" />
            </div>
            <h4 className="text-xs font-semibold text-fg">No screening questions configured</h4>
            <p className="mt-0.5 text-[11px] text-fg-subtle max-w-sm">
              Add screening questions in the job's <strong>Pitch & Screening</strong> tab to start asking and recording candidate answers here.
            </p>
          </div>
        ) : (
          questions.map((question, idx) => {
            const answer = answers[idx.toString()] || "";
            return (
              <div
                key={idx}
                className="rounded-lg border border-border bg-surface px-3 py-2 shadow-xs transition-all duration-150 focus-within:border-primary/60 focus-within:shadow-sm"
              >
                <div className="flex items-start gap-2 mb-1">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-active font-mono text-[10px] font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <p className="text-[12px] font-medium leading-snug text-fg pt-px">
                    {question}
                  </p>
                </div>

                <div className="pl-6">
                  <textarea
                    rows={1}
                    value={answer}
                    onChange={(e) => handleAnswerChange(idx, e.target.value)}
                    placeholder="Type answer…"
                    className="w-full min-h-[30px] resize-y rounded border border-border/70 bg-background/80 px-2 py-1 text-[12px] leading-tight text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
