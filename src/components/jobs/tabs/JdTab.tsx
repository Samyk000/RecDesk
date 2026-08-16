import { JobFieldEditor } from "../JobFieldEditor";
import type { Job } from "../../../types";

export function JdTab({ job }: { job: Job }) {
  return (
    <div className="max-w-3xl">
      <JobFieldEditor
        job={job}
        field="refined_jd"
        placeholder="Paste or write the refined job description used for recruiting…"
        minRows={16}
        hint="Auto-saves as you type. This is the JD you send to candidates and use for sourcing."
      />
    </div>
  );
}