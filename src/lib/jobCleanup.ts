import type { JobWithStats } from "../types";

export const STALE_JOB_THRESHOLD_DAYS = 10;
export const STALE_JOB_THRESHOLD_MS = STALE_JOB_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Returns true if a job has strictly 0 candidates and was created at least 10 days ago.
 */
export function isJobStaleZeroCandidate(job: JobWithStats, now = Date.now()): boolean {
  // Strict 0-candidate mandate: even 1 candidate excludes the job completely
  if ((job.candidate_count ?? 0) > 0) {
    return false;
  }

  if (!job.created_at) {
    return false;
  }

  const createdTime = new Date(job.created_at).getTime();
  if (Number.isNaN(createdTime)) {
    return false;
  }

  return now - createdTime >= STALE_JOB_THRESHOLD_MS;
}

/**
 * Filters a list of jobs down to only those meeting the stale 0-candidate criteria,
 * sorted with oldest created first.
 */
export function getStaleZeroCandidateJobs(jobs?: JobWithStats[] | null): JobWithStats[] {
  if (!jobs || jobs.length === 0) return [];
  const now = Date.now();
  return jobs
    .filter((j) => isJobStaleZeroCandidate(j, now))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
