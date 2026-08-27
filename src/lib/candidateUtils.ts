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

export function isLegalNameRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  return (
    k === "legal_name" ||
    k === "name" ||
    l.startsWith("legal name") ||
    l === "name:" ||
    l === "name" ||
    l === "candidate name:" ||
    l === "candidate name"
  );
}

export function isEmailRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  return (
    k === "email" ||
    l === "email:" ||
    l === "email" ||
    l === "e-mail:" ||
    l === "email address:" ||
    l === "email address"
  );
}

export function isPhoneRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  if (k.includes("interview") || l.includes("interview") || l.includes("notice")) return false;
  return (
    k === "phone" ||
    k === "mobile" ||
    k === "cell" ||
    k === "phone_number" ||
    l.startsWith("phone") ||
    l.startsWith("cell") ||
    l.startsWith("mobile") ||
    l === "contact number:" ||
    l === "phone number:"
  );
}

export function isLocationRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  return (
    k === "location" ||
    k === "city" ||
    k === "address" ||
    l === "location:" ||
    l === "location" ||
    l === "current location:" ||
    l === "current location" ||
    l === "city, state:" ||
    l === "city / state:" ||
    l === "address:"
  );
}

export function isLinkedinRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  return (
    k === "linkedin" ||
    k === "linkedin_url" ||
    l === "linkedin:" ||
    l === "linkedin" ||
    l === "linkedin profile:" ||
    l === "linkedin url:"
  );
}

export function isCurrentTitleRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  if (k.includes("permission") || l.includes("permission") || l.includes("resume") || l.includes("experience"))
    return false;
  return (
    k === "current_title" ||
    k === "title" ||
    k === "job_title" ||
    l === "current title:" ||
    l === "current title" ||
    l === "job title:" ||
    l === "job title" ||
    l === "title:" ||
    l === "title"
  );
}

export function isCurrentCompanyRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  if (l.includes("permission") || l.includes("resignation")) return false;
  return (
    k === "current_company" ||
    k === "company" ||
    k === "employer" ||
    l === "current company:" ||
    l === "current company" ||
    l === "company:" ||
    l === "company" ||
    l === "current employer:" ||
    l === "employer:"
  );
}

/**
 * Syncs top-level candidate core fields (name, email, phone, location, linkedin_url)
 * into the submission_details JSON row items.
 */
export function syncCandidateFieldsToSubmissionDetails(
  existingSubmissionDetailsJson: string | null | undefined,
  fields: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    linkedin_url?: string | null;
    current_title?: string | null;
    current_company?: string | null;
  }
): string | null {
  if (!existingSubmissionDetailsJson) return null;
  try {
    const parsed = JSON.parse(existingSubmissionDetailsJson);
    if (!Array.isArray(parsed) || parsed.length === 0) return existingSubmissionDetailsJson;

    const updated = parsed.map((row: any) => {
      const key = row.key || "";
      const label = row.label || "";

      if (fields.name !== undefined && isLegalNameRow(key, label)) {
        return { ...row, value: fields.name || "" };
      }
      if (fields.email !== undefined && isEmailRow(key, label)) {
        return { ...row, value: fields.email || "" };
      }
      if (fields.phone !== undefined && isPhoneRow(key, label)) {
        return { ...row, value: fields.phone || "" };
      }
      if (fields.location !== undefined && isLocationRow(key, label)) {
        return { ...row, value: fields.location || "" };
      }
      if (fields.linkedin_url !== undefined && isLinkedinRow(key, label)) {
        return { ...row, value: fields.linkedin_url || "" };
      }
      if (fields.current_title !== undefined && isCurrentTitleRow(key, label)) {
        return { ...row, value: fields.current_title || "" };
      }
      if (fields.current_company !== undefined && isCurrentCompanyRow(key, label)) {
        return { ...row, value: fields.current_company || "" };
      }
      return row;
    });

    return JSON.stringify(updated);
  } catch {
    return existingSubmissionDetailsJson;
  }
}


