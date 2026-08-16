import { useEffect, useState } from "react";
import {
  Check,
  GripVertical,
  ListChecks,
  Loader2,
  MessageSquareQuote,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useUpdateJob } from "../../../hooks/useQueries";
import { useDebounce } from "../../../hooks/useDebounce";
import { toJobInput } from "../tabUtils";
import { JobFieldEditor } from "../JobFieldEditor";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { CopyButton } from "../../common/CopyButton";
import { EmptyState } from "../../common/EmptyState";
import { errorMessage } from "../../../lib/utils";
import type { Job } from "../../../types";

export function PitchScreeningTab({ job }: { job: Job }) {
  const hasPitch = !!job.candidate_pitch?.trim();

  return (
    <div className="grid grid-cols-2 items-stretch gap-6">
      <div className="flex min-h-[320px] flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold text-fg">Candidate pitch</h3>
          </div>
          {hasPitch && <CopyButton text={job.candidate_pitch!} label="Copy pitch" />}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-xs text-fg-subtle">
            Use <span className="font-mono">{"{name}"}</span> as a placeholder for the candidate’s name.
          </p>
          <div className="flex-1">
            <JobFieldEditor
              job={job}
              field="candidate_pitch"
              placeholder="The concise explanation you send when presenting this opportunity to a candidate…"
              minRows={10}
              fill
            />
          </div>
          {!hasPitch && (
            <EmptyState
              icon={<MessageSquareQuote className="h-5 w-5" />}
              title="No pitch written yet"
              description="Write the message you use to introduce the role — it will auto-save as you type."
            />
          )}
        </div>
      </div>

      <div className="flex min-h-[320px] flex-col">
        <ScreeningList job={job} />
      </div>
    </div>
  );
}

function ScreeningList({ job }: { job: Job }) {
  const update = useUpdateJob();
  const [questions, setQuestions] = useState<string[]>(job.screening_questions);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const debounced = useDebounce(questions, 600);

  useEffect(() => {
    setQuestions(job.screening_questions);
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (JSON.stringify(debounced) === JSON.stringify(job.screening_questions)) return;
    setState("saving");
    update.mutate(
      { id: job.id, input: toJobInput(job, { screening_questions: debounced }) },
      {
        onSuccess: () => {
          setState("saved");
          setTimeout(() => setState("idle"), 1500);
        },
        onError: (err) => {
          toast.error(errorMessage(err));
          setState("idle");
        },
      },
    );
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => setQuestions([...questions, ""]);
  const remove = (i: number) => setQuestions(questions.filter((_, idx) => idx !== i));
  const patch = (i: number, v: string) =>
    setQuestions(questions.map((q, idx) => (idx === i ? v : q)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
  };

  const copyAll = questions.filter((q) => q.trim()).map((q, i) => `${i + 1}. ${q.trim()}`).join("\n");

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-fg">Screening questions</h3>
        </div>
        <div className="flex items-center gap-2">
          {state === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {copyAll && <CopyButton text={copyAll} label="Copy all" />}
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            Add question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-1 flex-col">
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No screening questions yet"
            description="Add the questions you ask every candidate for this role."
            action={
              <Button variant="primary" size="sm" onClick={add}>
                <Plus className="h-4 w-4" />
                Add your first question
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {questions.map((q, i) => (
            <div
              key={i}
              className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 transition-colors focus-within:border-primary/50"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-fg-subtle opacity-60" />
              <span className="w-6 shrink-0 text-center font-mono text-xs text-fg-subtle">{i + 1}</span>
              <Input
                value={q}
                onChange={(e) => patch(i, e.target.value)}
                placeholder="Ask a screening question…"
                className="h-8 border-none bg-transparent px-1 text-[13px] shadow-none focus:ring-0"
              />
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} title="Move up">
                  ↑
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} title="Move down">
                  ↓
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-fg-subtle hover:text-red-500"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}