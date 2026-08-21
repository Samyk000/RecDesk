import { useEffect, useMemo, useState } from "react";
import {
  ChatCircleText,
  Check,
  CircleNotch,
  Copy,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useCandidate, useJob, useUpdateCandidate } from "../../hooks/useQueries";
import { useDebounce } from "../../hooks/useDebounce";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Spinner } from "../common/Spinner";
import { errorMessage } from "../../lib/utils";
import { toCandidateInput } from "../../lib/candidateUtils";
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
      <DialogContent className="max-h-[90vh] w-full max-w-[620px] overflow-hidden p-0 flex flex-col">
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
        input: toCandidateInput(candidate, {
          screening_answers: nextStr,
        }),
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
      toast.success("Screening Q&A copied to clipboard!");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const answeredCount = Object.values(answers).filter((a) => a && a.trim().length > 0).length;

  return (
    <>
      {/* Header bar - with Copy button positioned left of close icon */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3 pr-11">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ChatCircleText className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-[13.5px] font-semibold text-fg flex items-center gap-1.5 truncate">
              <span className="truncate">{candidate.name}</span>
              <span className="text-xs font-normal text-fg-subtle">·</span>
              <span className="text-xs font-normal text-fg-muted truncate">
                {jobTitle} {clientName ? `(${clientName})` : ""}
              </span>
            </DialogTitle>
            <p className="text-[11px] text-fg-subtle">
              Screening Q&A · {answeredCount}/{questions.length} answered
            </p>
          </div>
        </div>

        {/* Action Controls: Autosave Badge + Copy Button */}
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
              className="h-7 gap-1.5 px-3 text-xs shadow-sm font-medium cursor-pointer"
            >
              {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {hasCopied ? "Copied!" : "Copy Q&A"}
            </Button>
          )}
        </div>
      </div>

      {/* Clean Q&A List with minimal divider lines (no outer card boxes) */}
      <div className="flex-1 overflow-y-auto bg-background scrollbar-thin">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-2">
              <WarningCircle className="h-4.5 w-4.5" />
            </div>
            <h4 className="text-xs font-semibold text-fg">No screening questions configured</h4>
            <p className="mt-1 text-[11.5px] text-fg-subtle max-w-sm">
              Add screening questions in the job's <strong>Pitch &amp; Screening</strong> tab to record answers here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {questions.map((question, idx) => {
              const answer = answers[idx.toString()] || "";
              return (
                <div
                  key={idx}
                  className="px-5 py-3 transition-colors hover:bg-surface-hover/20"
                >
                  {/* Clean Question Text with minimal prefix */}
                  <div className="flex items-start gap-1.5 mb-1.5">
                    <span className="text-[11.5px] font-bold text-primary font-mono tracking-tight shrink-0 pt-px select-none">
                      Q{idx + 1}.
                    </span>
                    <p className="text-[12.5px] font-medium leading-snug text-fg select-text">
                      {question}
                    </p>
                  </div>

                  {/* Clean Resizable Answer Input Box */}
                  <div className="pl-4">
                    <textarea
                      rows={2}
                      value={answer}
                      onChange={(e) => handleAnswerChange(idx, e.target.value)}
                      placeholder="Type candidate's answer…"
                      className="w-full min-h-[34px] resize-y rounded-md border border-border/80 bg-surface px-2.5 py-1.5 text-[12px] leading-relaxed text-fg placeholder:text-fg-subtle/70 outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/40 scrollbar-thin"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
