import { MessageSquareQuote } from "lucide-react";
import { JobFieldEditor } from "../JobFieldEditor";
import { CopyButton } from "../../common/CopyButton";
import { EmptyState } from "../../common/EmptyState";
import type { Job } from "../../../types";

export function PitchTab({ job }: { job: Job }) {
  const hasPitch = !!job.candidate_pitch?.trim();
  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fg">Candidate pitch</h3>
          <p className="text-xs text-fg-subtle">
            Use <span className="font-mono">{"{name}"}</span> as a placeholder for the candidate’s name.
          </p>
        </div>
        {hasPitch && <CopyButton text={job.candidate_pitch!} label="Copy pitch" />}
      </div>
      <JobFieldEditor
        job={job}
        field="candidate_pitch"
        placeholder="The concise explanation you send when presenting this opportunity to a candidate…"
        minRows={10}
      />
      {!hasPitch && (
        <div className="mt-4">
          <EmptyState
            icon={<MessageSquareQuote className="h-5 w-5" />}
            title="No pitch written yet"
            description="Write the message you use to introduce the role — it will auto-save as you type."
          />
        </div>
      )}
    </div>
  );
}