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
import { parseSafeDate } from "./utils";

const ROW_MATCHERS = {
  legalName: { keys: ["legal_name", "name"], prefixes: ["legal name", "name", "name:", "candidate name"] },
  email: { keys: ["email"], prefixes: ["email", "email:", "e-mail:", "email address"] },
  phone: { keys: ["phone", "mobile", "cell", "phone_number"], prefixes: ["phone", "cell", "mobile", "contact number"] },
  location: { keys: ["location", "city", "address"], prefixes: ["location", "current location", "city, state", "address"] },
  linkedin: { keys: ["linkedin", "linkedin_url"], prefixes: ["linkedin", "linkedin profile", "linkedin url"] },
  title: { keys: ["current_title", "title", "job_title"], prefixes: ["current title", "job title", "title"] },
  company: { keys: ["current_company", "company", "employer"], prefixes: ["current company", "company", "current employer", "employer"] },
};

function matchesPatterns(key: string, label: string, spec: { keys: string[]; prefixes: string[] }): boolean {
  const k = (key || "").toLowerCase().trim();
  const l = (label || "").toLowerCase().trim();
  return spec.keys.includes(k) || spec.prefixes.some((prefix) => l === prefix || l.startsWith(prefix));
}

export const isLegalNameRow = (k: string, l: string): boolean => matchesPatterns(k, l, ROW_MATCHERS.legalName);
export const isEmailRow = (k: string, l: string): boolean => matchesPatterns(k, l, ROW_MATCHERS.email);
export const isPhoneRow = (k: string, l: string): boolean => {
  const combined = `${k || ""} ${l || ""}`.toLowerCase();
  return !combined.includes("interview") && !combined.includes("notice") && matchesPatterns(k, l, ROW_MATCHERS.phone);
};
export const isLocationRow = (k: string, l: string): boolean => matchesPatterns(k, l, ROW_MATCHERS.location);
export const isLinkedinRow = (k: string, l: string): boolean => matchesPatterns(k, l, ROW_MATCHERS.linkedin);
export const isCurrentTitleRow = (k: string, l: string): boolean => {
  const combined = `${k || ""} ${l || ""}`.toLowerCase();
  return !combined.includes("permission") && !combined.includes("resume") && !combined.includes("experience") && matchesPatterns(k, l, ROW_MATCHERS.title);
};
export const isCurrentCompanyRow = (k: string, l: string): boolean => {
  const combined = (l || "").toLowerCase();
  return !combined.includes("permission") && !combined.includes("resignation") && matchesPatterns(k, l, ROW_MATCHERS.company);
};

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
        const rounds = parsed as InterviewRound[];
        if (rounds[0] && !rounds[0].scheduled_at && fallbackInterviewAt) {
          rounds[0].scheduled_at = fallbackInterviewAt;
        }
        return rounds;
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
    // Only count as external client submission if client reviewed and rejected
    return detail.origin === "client_screening" || detail.origin === "interview";
  }

  return false;
}

/**
 * Safely extracts a numeric unix timestamp from any candidate date string,
 * automatically handling timezone labels (e.g. "2026-08-21T11:00 EST" or "2026-08-10 external").
 */
export function parseTimestampSafe(val?: string | null): number {
  const { date } = parseSafeDate(val);
  return date ? date.getTime() : 0;
}

export const getSubmissionTimestamp = parseTimestampSafe;
export const getInterviewTimestamp = parseTimestampSafe;

export type CandidateSortKey =
  | "name"
  | "candidate_title"
  | "experience_years"
  | "job_title"
  | "client_name"
  | "location"
  | "date_added"
  | "last_updated";

export function compareCandidates(
  a: CandidateWithJob,
  b: CandidateWithJob,
  key: CandidateSortKey,
): number {
  if (key === "name") return a.name.localeCompare(b.name);
  if (key === "candidate_title") {
    const tA = (a.current_title ?? "").trim();
    const tB = (b.current_title ?? "").trim();
    if (!tA && !tB) return a.name.localeCompare(b.name);
    if (!tA) return 1;
    if (!tB) return -1;
    return tA.localeCompare(tB);
  }
  if (key === "experience_years") {
    const expA = a.experience_years ?? -1;
    const expB = b.experience_years ?? -1;
    return expA - expB;
  }
  if (key === "job_title") return a.job_title.localeCompare(b.job_title);
  if (key === "client_name") return a.client_name.localeCompare(b.client_name);
  if (key === "location") return (a.location ?? "").localeCompare(b.location ?? "");
  if (key === "date_added") return a.date_added.localeCompare(b.date_added);
  return a.last_updated.localeCompare(b.last_updated);
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




