import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ListChecks,
  CircleNotch,
  ChatCircleText,
} from "@phosphor-icons/react";
import { useJobAutosave } from "../../../hooks/useJobAutosave";
import { toJobInput } from "../tabUtils";
import { JobFieldEditor } from "../JobFieldEditor";
import { CopyButton } from "../../common/CopyButton";
import { EmptyState } from "../../common/EmptyState";
import { htmlToPlainText } from "../../../lib/utils";
import type { Job } from "../../../types";

export function PitchScreeningTab({ job }: { job: Job }) {
  const pitchText = htmlToPlainText(job.candidate_pitch ?? "");
  const hasPitch = !!pitchText;

  return (
    <div className="grid grid-cols-2 items-stretch gap-6">
      <div className="flex min-h-[320px] flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChatCircleText className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold text-fg">Candidate pitch</h3>
          </div>
          {hasPitch && <CopyButton text={pitchText} label="Copy pitch" />}
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
              maxHeight={480}
            />
          </div>
          {!hasPitch && (
            <EmptyState
              icon={<ChatCircleText className="h-5 w-5" />}
              title="No pitch written yet"
              description="Write the message you use to introduce the role. It auto-saves as you type."
            />
          )}
        </div>
      </div>

      <div className="flex min-h-[320px] flex-col">
        <ScreeningQuestionsEditor job={job} />
      </div>
    </div>
  );
}

function parseQuestionsText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(\d+[\.\-\)]\s*|[\-\*•]\s*)/, "").trim())
    .filter(Boolean);
}

function formatQuestionsText(questions: string[]): string {
  return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

function ScreeningQuestionsEditor({ job }: { job: Job }) {
  const [rawText, setRawText] = useState(() => formatQuestionsText(job.screening_questions ?? []));

  const { setValue: saveQuestions, state } = useJobAutosave(
    job,
    "screening_questions",
    (value: string[]) => toJobInput(job, { screening_questions: value }),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
    600,
  );

  // Sync if job id or questions from server change externally
  useEffect(() => {
    setRawText(formatQuestionsText(job.screening_questions ?? []));
  }, [job.id]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    const parsed = parseQuestionsText(text);
    saveQuestions(parsed);
  };

  const parsedQuestions = useMemo(() => parseQuestionsText(rawText), [rawText]);
  const copyAllText = parsedQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n");

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-fg">Screening questions</h3>
          {parsedQuestions.length > 0 && (
            <span className="rounded-full bg-surface-active px-2 py-0.5 text-[11px] font-medium text-fg-muted">
              {parsedQuestions.length} {parsedQuestions.length === 1 ? "question" : "questions"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {state === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <CircleNotch className="h-3 w-3 animate-spin text-primary" /> Saving…
            </span>
          )}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {copyAllText && <CopyButton text={copyAllText} label="Copy all" />}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <p className="text-xs text-fg-subtle">
          Paste or type all questions at once (one per line). Numbers will be formatted automatically.
        </p>

        <div className="relative flex-1">
          <textarea
            value={rawText}
            onChange={handleTextChange}
            placeholder={`1. Can you walk me through a recent project you led?\n2. How many years of experience do you have in this stack?\n3. Are you open to a hybrid schedule?\n4. What is your notice period and expected rate?`}
            className="h-full min-h-[220px] w-full resize-none rounded-xl border border-border bg-surface p-3.5 text-[13px] leading-relaxed text-fg placeholder:text-fg-subtle outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary scrollbar-thin"
          />
        </div>

        {parsedQuestions.length === 0 && (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No screening questions yet"
            description="Paste 5–10 questions you ask candidates for this role. It auto-saves as you type."
          />
        )}
      </div>
    </div>
  );
}