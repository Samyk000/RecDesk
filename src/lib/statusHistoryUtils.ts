import type { Candidate, CandidateWithJob, StatusHistoryEntry } from "../types";

export function parseStatusHistory(raw?: string | null): StatusHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Deduplicate: preserve only the latest entry for each to_status ("One status one time")
      const map = new Map<string, StatusHistoryEntry>();
      for (const entry of parsed as StatusHistoryEntry[]) {
        if (entry && entry.to_status) {
          map.set(entry.to_status, entry);
        }
      }
      return Array.from(map.values());
    }
  } catch {
    // Ignore invalid JSON
  }
  return [];
}

export function shouldTrackStatusTransition(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return false;

  // Track: in_touch -> submitted
  if (fromStatus === "in_touch" && toStatus === "submitted") return true;

  // Track: submitted -> interview
  if (fromStatus === "submitted" && toStatus === "interview") return true;

  // Track: submitted -> rejected
  if (fromStatus === "submitted" && toStatus === "rejected") return true;

  // Track: interview -> rejected
  if (fromStatus === "interview" && toStatus === "rejected") return true;

  // Track: interview -> placed
  if (fromStatus === "interview" && toStatus === "placed") return true;

  // Track: submitted -> placed
  if (fromStatus === "submitted" && toStatus === "placed") return true;

  return false;
}

export function getUpdatedStatusHistory(
  candidate: Candidate | CandidateWithJob,
  nextStatus: string,
  meta?: {
    submitted_at?: string | null;
    interview_at?: string | null;
    placed_at?: string | null;
    rejection_reason?: string | null;
  },
): string {
  const currentHistory = parseStatusHistory(candidate.status_history);
  const fromStatus = candidate.submission_status ?? "sourced";

  if (!shouldTrackStatusTransition(fromStatus, nextStatus)) {
    return JSON.stringify(currentHistory);
  }

  const newEntry: StatusHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from_status: fromStatus,
    to_status: nextStatus,
    changed_at: new Date().toISOString(),
    submitted_at: meta?.submitted_at ?? candidate.submitted_at ?? null,
    interview_at: meta?.interview_at ?? candidate.interview_at ?? null,
    placed_at: meta?.placed_at ?? candidate.placed_at ?? null,
    rejection_reason: meta?.rejection_reason ?? candidate.rejection_reason ?? null,
  };

  // Remove any existing entry for this target status to prevent duplicate milestones ("One status one time")
  const filtered = currentHistory.filter((entry) => entry.to_status !== nextStatus);
  const updated = [...filtered, newEntry];

  return JSON.stringify(updated);
}
