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

export interface SubStageBadgeInfo {
  shortLabel: string;
  fullLabel: string;
  colorClass: string;
}

/**
 * Returns a compact badge (e.g. R1, Ext, Int) with full contextual tooltip and vibrant color
 * for positioning directly beside the status dropdown in dense table rows.
 */
export function getCandidateSubStageBadge(
  candidate: Candidate | CandidateWithJob,
): SubStageBadgeInfo | null {
  const status = candidate.submission_status;

  if (status === "submitted") {
    const isInt = candidate.client_feedback === "internal";
    return isInt
      ? {
        shortLabel: "Int",
        fullLabel: "Internal Review",
        colorClass:
          "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
      }
      : {
        shortLabel: "Ext",
        fullLabel: "External Client Submission",
        colorClass:
          "border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300",
      };
  }

  if (status === "interview") {
    const rounds = parseInterviewRounds(candidate.interview_status, candidate.interview_at);
    const roundNum = rounds.length > 0 ? rounds.length : 1;
    const activeRound = rounds[roundNum - 1];
    const roundName = activeRound?.round_name || `Round ${roundNum}`;
    return {
      shortLabel: `R${roundNum}`,
      fullLabel: `Interview · ${roundName}`,
      colorClass:
        "border-violet-500/35 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    };
  }

  if (status === "rejected") {
    const detail = parseRejectionDetail(candidate.rejection_reason);
    if (detail.origin === "internal") {
      return {
        shortLabel: "Int",
        fullLabel: "Rejected at Internal Review",
        colorClass:
          "border-slate-500/30 bg-slate-500/15 text-slate-700 dark:text-slate-300",
      };
    }
    if (detail.origin === "client_screening") {
      return {
        shortLabel: "Ext",
        fullLabel: "Rejected at Client Screening",
        colorClass:
          "border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-300",
      };
    }
    if (detail.origin === "interview") {
      const rNum = detail.round_number || 1;
      return {
        shortLabel: `R${rNum}`,
        fullLabel: `Rejected after Round ${rNum} Interview`,
        colorClass:
          "border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-300",
      };
    }
    return null;
  }

  return null;
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

/**
 * Returns true if a candidate reached the external client submission milestone.
 * This holds true across the entire lifecycle:
 * - Currently submitted to external client
 * - Currently interviewing
 * - Currently placed
 * - Rejected by client on resume screening
 * - Rejected during or after interview rounds
 * Strictly excludes internal reviews/draft pre-screens.
 */
export function isExternalSubmission(candidate: Candidate | CandidateWithJob): boolean {
  const status = candidate.submission_status;
  const isInternal = candidate.client_feedback === "internal";

  if (status === "submitted") {
    return !isInternal;
  }

  if (status === "interview" || status === "placed") {
    return true;
  }

  if (status === "rejected") {
    const detail = parseRejectionDetail(candidate.rejection_reason);
    if (detail.origin === "internal") {
      return false;
    }
    if (detail.origin === "client_screening" || detail.origin === "interview") {
      return true;
    }
    // If general rejection but was previously marked client feedback or has submitted_at and not internal
    return !isInternal && Boolean(candidate.submitted_at?.trim());
  }

  return false;
}

/**
 * Safely extracts a numeric timestamp from a submission date string (e.g. "2026-08-10 external").
 */
export function getSubmissionTimestamp(val?: string | null): number {
  if (!val || !val.trim()) return 0;
  const trimmed = val.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const tMatch = trimmed.match(/T(\d{2}):(\d{2}):(\d{2})/);
    if (tMatch) {
      const d = new Date(trimmed.split(/\s+/)[0]);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return new Date(year, month - 1, day, 12, 0, 0).getTime();
  }
  const parts = trimmed.split(/\s+/);
  const d = new Date(parts[0]);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Safely extracts a numeric timestamp from an interview date string (e.g. "2026-08-21T11:00 EST").
 */
export function getInterviewTimestamp(val?: string | null): number {
  if (!val || !val.trim()) return 0;
  const parts = val.trim().split(/\s+/);
  const dateTimePart = parts[0] || "";
  const d = new Date(dateTimePart);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Returns true if a candidate reached the interview stage (active, placed, or interview-rejected).
 */
export function hasHadInterview(candidate: Candidate | CandidateWithJob): boolean {
  const status = candidate.submission_status;
  if (status === "interview" || status === "placed") {
    return true;
  }
  if (status === "rejected") {
    const detail = parseRejectionDetail(candidate.rejection_reason);
    if (detail.origin === "interview") {
      return true;
    }
  }
  if (candidate.interview_at && candidate.interview_at.trim()) {
    return true;
  }
  if (candidate.interview_status) {
    try {
      const parsed = JSON.parse(candidate.interview_status);
      if (Array.isArray(parsed) && parsed.some((r: any) => r.scheduled_at && r.scheduled_at.trim())) {
        return true;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }
  return false;
}

/**
 * Pipeline hierarchy levels:
 * 0: sourced
 * 1: in_touch
 * 2: submitted
 * 3: interview
 * 4: placed
 * (rejected and not_interested are outcome states: -1)
 */
export function getPipelineStageLevel(status: string): number {
  switch (status) {
    case "sourced":
      return 0;
    case "in_touch":
      return 1;
    case "submitted":
      return 2;
    case "interview":
      return 3;
    case "placed":
      return 4;
    default:
      return -1;
  }
}

/**
 * Returns true if moving from fromStatus to toStatus is a backward step in the pipeline.
 * Only triggers when moving from an advanced stage (Level >= 2: submitted, interview, placed)
 * back to an earlier stage (e.g. in_touch or sourced).
 */
export function isBackwardTransition(fromStatus: string, toStatus: string): boolean {
  const fromLevel = getPipelineStageLevel(fromStatus);
  const toLevel = getPipelineStageLevel(toStatus);

  if (fromLevel >= 2 && toLevel >= 0 && toLevel < fromLevel) {
    return true;
  }
  return false;
}




