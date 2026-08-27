import type {
  Candidate,
  CandidateInput,
  CandidateWithJob,
  InterviewRound,
  RejectionDetail,
  SubmissionType,
} from "../types";

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

/**
 * Parses interview rounds from candidate.interview_status or builds initial round
 */
export function parseInterviewRounds(
  raw?: string | null,
  fallbackInterviewAt?: string | null,
): InterviewRound[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as InterviewRound[];
      }
      if (typeof raw === "string" && !raw.startsWith("{") && !raw.startsWith("[")) {
        return [
          {
            id: "round_1",
            round_number: 1,
            round_name: raw.trim() || "Round 1: Screening Call",
            scheduled_at: fallbackInterviewAt ?? null,
            status: "scheduled",
          },
        ];
      }
    } catch {
      return [
        {
          id: "round_1",
          round_number: 1,
          round_name: raw.trim() || "Round 1: Screening Call",
          scheduled_at: fallbackInterviewAt ?? null,
          status: "scheduled",
        },
      ];
    }
  }

  return [
    {
      id: "round_1",
      round_number: 1,
      round_name: "Round 1: Screening Call",
      scheduled_at: fallbackInterviewAt ?? null,
      status: "scheduled",
    },
  ];
}

/**
 * Serializes interview rounds array to JSON string for interview_status column
 */
export function serializeInterviewRounds(rounds: InterviewRound[]): string {
  return JSON.stringify(rounds);
}

/**
 * Returns the most relevant active/upcoming interview date from rounds
 */
export function getActiveInterviewSchedule(rounds: InterviewRound[]): string | null {
  if (!rounds || rounds.length === 0) return null;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i]?.scheduled_at) {
      return rounds[i].scheduled_at ?? null;
    }
  }
  return null;
}

/**
 * Parses rejection details from candidate.rejection_reason JSON string
 */
export function parseRejectionDetail(raw?: string | null): RejectionDetail {
  if (!raw) {
    return {
      origin: "general",
      category: null,
      reason: null,
      rejected_at: null,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && parsed.origin) {
      return parsed as RejectionDetail;
    }
  } catch {
    // If raw was a plain string reason
  }

  return {
    origin: "general",
    category: null,
    reason: raw,
    rejected_at: null,
  };
}

/**
 * Serializes rejection detail object to JSON string for rejection_reason column
 */
export function serializeRejectionDetail(detail: RejectionDetail): string {
  return JSON.stringify(detail);
}

/**
 * Extracts submission type (internal vs client) from candidate
 */
export function getSubmissionType(candidate: Candidate | CandidateWithJob): SubmissionType {
  if (candidate.client_feedback === "internal") return "internal";
  return "client"; // default to client submission
}

/**
 * Returns a human-readable sub-stage badge label for table rows and status badges
 */
export function getCandidateSubStageLabel(
  candidate: Candidate | CandidateWithJob,
): string | null {
  const status = candidate.submission_status;

  if (status === "submitted") {
    return candidate.client_feedback === "internal" ? "Internal" : "External";
  }

  if (status === "interview") {
    const rounds = parseInterviewRounds(candidate.interview_status, candidate.interview_at);
    return `Round ${rounds.length}`;
  }

  if (status === "rejected") {
    const detail = parseRejectionDetail(candidate.rejection_reason);
    if (detail.origin === "internal") return "Internal";
    if (detail.origin === "client_screening") return "External";
    if (detail.origin === "interview") {
      return detail.round_number ? `Round ${detail.round_number}` : "Interview";
    }
    return null;
  }

  return null;
}




