import type { Candidate, CandidateInput, CandidateWithJob } from "../types";

export function toCandidateInput(
  candidate: Candidate | CandidateWithJob,
  patch?: Partial<CandidateInput>,
): CandidateInput {
  return {
    job_id: candidate.job_id,
    name: candidate.name,
    email: candidate.email ?? null,
    phone: candidate.phone ?? null,
    location: candidate.location ?? null,
    current_title: candidate.current_title ?? null,
    current_company: candidate.current_company ?? null,
    experience_years: candidate.experience_years ?? null,
    resume_path: candidate.resume_path ?? null,
    linkedin_url: candidate.linkedin_url ?? null,
    recruiter_notes: candidate.recruiter_notes ?? null,
    match_score: candidate.match_score ?? null,
    submission_status: candidate.submission_status ?? "sourced",
    interview_status: candidate.interview_status ?? null,
    client_feedback: candidate.client_feedback ?? null,
    candidate_status: candidate.candidate_status ?? "active",
    submitted_at: candidate.submitted_at ?? null,
    interview_at: candidate.interview_at ?? null,
    placed_at: candidate.placed_at ?? null,
    rejection_reason: candidate.rejection_reason ?? null,
    screening_answers: candidate.screening_answers ?? null,
    submission_details: candidate.submission_details ?? null,
    status_history: candidate.status_history ?? null,
    interview_feedback: candidate.interview_feedback ?? null,
    ...patch,
  };
}
