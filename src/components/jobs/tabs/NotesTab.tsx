import { JobFieldEditor } from "../JobFieldEditor";
import type { Job } from "../../../types";

export function NotesTab({ job }: { job: Job }) {
  return (
    <div className="max-w-3xl">
      <JobFieldEditor
        job={job}
        field="notes"
        placeholder="Free-form recruiting notes… (rates, timelines, client preferences, follow-ups)"
        minRows={12}
      />
    </div>
  );
}