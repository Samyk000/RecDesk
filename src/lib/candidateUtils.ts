import type {
  Candidate,
  CandidateInput,
  CandidateWithJob,
  InterviewRound,
  RejectionDetail,
} from "../types";

/**
 * Sparse update payload: identity fields plus whatever the caller actually
 * changed. Anything omitted is left untouched by the backend, so a save from
 * one dialog can never revert a field a different dialog just wrote (the old
 * full-row payload made every save a last-write-wins race).
 */
export function toCandidateInput(
  candidate: Candidate | CandidateWithJob,
  patch?: Partial<CandidateInput>,
): CandidateInput {
  return {
    job_id: candidate.job_id,
    name: candidate.name,
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

export function isPayRateRow(key: string, label: string): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  return (
    k === "pay_rate" ||
    k === "salary" ||
    k === "rate" ||
    l.includes("pay rate") ||
    l.includes("salary")
  );
}

export function getPayRateFromSubmissionDetails(
  submissionDetailsJson: string | null | undefined,
): string {
  if (!submissionDetailsJson) return "";
  try {
    const parsed = JSON.parse(submissionDetailsJson);
    if (Array.isArray(parsed)) {
      const found = parsed.find((row: any) => isPayRateRow(row.key, row.label));
      return found?.value ?? "";
    }
  } catch {
    // ignore
  }
  return "";
}

export function setPayRateInSubmissionDetails(
  existingSubmissionDetailsJson: string | null | undefined,
  newPayRate: string,
): string {
  const defaultPayRow = {
    id: "pay_rate",
    key: "pay_rate",
    label: "Pay Rate/Salary:",
    value: newPayRate,
  };

  if (!existingSubmissionDetailsJson) {
    return JSON.stringify([defaultPayRow]);
  }

  try {
    const parsed = JSON.parse(existingSubmissionDetailsJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let found = false;
      const updated = parsed.map((row: any) => {
        if (isPayRateRow(row.key, row.label)) {
          found = true;
          return { ...row, value: newPayRate };
        }
        return row;
      });

      if (!found) {
        const locIdx = updated.findIndex((r: any) => isLocationRow(r.key, r.label));
        if (locIdx !== -1) {
          updated.splice(locIdx + 1, 0, defaultPayRow);
        } else {
          updated.push(defaultPayRow);
        }
      }
      return JSON.stringify(updated);
    }
  } catch {
    // fallback
  }

  return JSON.stringify([defaultPayRow]);
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

export interface SubStageBadgeInfo {
  shortLabel: string;
  fullLabel: string;
  colorClass: string;
}

/**
 * Returns a compact badge (e.g. R1, Sub) with full contextual tooltip and color
 * for positioning directly beside the status dropdown in dense table rows.
 */
export function getCandidateSubStageBadge(
  candidate: Candidate | CandidateWithJob,
): SubStageBadgeInfo | null {
  const status = candidate.submission_status;

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
    if (detail.origin === "client_screening") {
      return {
        shortLabel: "Sub",
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

  if (status === "pipeline") {
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
    return null;
  }

  if (status === "pipeline") {
    return "Pipeline";
  }

  if (status === "interview") {
    const rounds = parseInterviewRounds(candidate.interview_status, candidate.interview_at);
    return `Round ${rounds.length}`;
  }

  if (status === "rejected") {
    const detail = parseRejectionDetail(candidate.rejection_reason);
    if (detail.origin === "client_screening") return "Submission";
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

  if (status === "submitted" || status === "interview" || status === "placed") {
    return true;
  }

  if (status === "rejected") {
    const detail = parseRejectionDetail(candidate.rejection_reason);
    if (detail.origin === "client_screening" || detail.origin === "interview") {
      return true;
    }
    return Boolean(candidate.submitted_at?.trim());
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
    const tMatch = trimmed.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
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

/**
 * Safely extracts skill tags from candidate.submission_details.
 * Supports both JSON array of dossier rows and object format.
 */
export function getCandidateSkills(candidate: Candidate | CandidateWithJob): string[] {
  if (!candidate.submission_details) return [];
  try {
    const parsed = JSON.parse(candidate.submission_details);
    if (Array.isArray(parsed)) {
      const skillsRow = parsed.find(
        (r: any) => r.key === "skills" || r.id === "skills" || r.label?.toLowerCase() === "skills",
      );
      if (skillsRow && skillsRow.value) {
        try {
          const val = JSON.parse(skillsRow.value);
          if (Array.isArray(val)) return val.map((s: any) => String(s).trim()).filter(Boolean);
        } catch {
          return String(skillsRow.value)
            .split(/[,|]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed.skills)) {
        return parsed.skills.map((s: any) => String(s).trim()).filter(Boolean);
      }
    }
  } catch {
    // ignore json errors
  }
  return [];
}

/**
 * Updates or adds skills inside submission_details JSON string,
 * preserving all existing dossier rows or metadata.
 */
export function setCandidateSkills(
  existingSubmissionDetailsJson: string | null | undefined,
  skills: string[],
): string {
  const cleanSkills: string[] = [];
  for (const s of skills) {
    const trimmed = s.trim();
    if (trimmed && !cleanSkills.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      cleanSkills.push(trimmed);
    }
  }

  const defaultSkillsRow = {
    id: "skills",
    key: "skills",
    label: "Skills & Technologies",
    value: JSON.stringify(cleanSkills),
    type: "text",
  };

  if (!existingSubmissionDetailsJson) {
    return JSON.stringify([defaultSkillsRow]);
  }

  try {
    const parsed = JSON.parse(existingSubmissionDetailsJson);
    if (Array.isArray(parsed)) {
      let found = false;
      const updated = parsed.map((r: any) => {
        if (r.key === "skills" || r.id === "skills" || r.label?.toLowerCase() === "skills") {
          found = true;
          return { ...r, value: JSON.stringify(cleanSkills) };
        }
        return r;
      });
      if (!found) {
        updated.push(defaultSkillsRow);
      }
      return JSON.stringify(updated);
    } else if (typeof parsed === "object" && parsed !== null) {
      return JSON.stringify({
        ...parsed,
        skills: cleanSkills,
      });
    }
  } catch {
    // fallback
  }

  return JSON.stringify([defaultSkillsRow]);
}




