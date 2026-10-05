import type { Job, JobInput } from "../../types";

// Sparse payload: only identity fields plus what the caller patched. The rest
// is left untouched by the backend, so two autosaves can't clobber each other.
export function toJobInput(job: Job, patch?: Partial<JobInput>): JobInput {
  return {
    client_id: job.client_id,
    job_id: job.job_id,
    title: job.title,
    ...patch,
  };
}