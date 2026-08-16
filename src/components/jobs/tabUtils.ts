import type { Job, JobInput } from "../../types";

export function toJobInput(job: Job, patch?: Partial<JobInput>): JobInput {
  return {
    client_id: job.client_id,
    job_id: job.job_id,
    title: job.title,
    location: job.location,
    work_model: job.work_model,
    contract_type: job.contract_type,
    status: job.status,
    refined_jd: job.refined_jd,
    boolean_strings: job.boolean_strings,
    candidate_pitch: job.candidate_pitch,
    screening_questions: job.screening_questions,
    notes: job.notes,
    closed_at: job.closed_at,
    ...patch,
  };
}

export function trimNullable(value: string): string | null {
  const v = value.trim();
  return v.length === 0 ? null : v;
}