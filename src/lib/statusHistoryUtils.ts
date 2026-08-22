import type { Candidate, CandidateWithJob, StatusHistoryEntry } from "../types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PIPELINE_STAGE_ORDER: Record<string, number> = {
  in_touch: 10,
  submitted: 20,
  interview: 30,
  placed: 40,
  rejected: 50,
  not_interested: 60,
};

export function formatStageDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const monthIdx = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return `${MONTHS[monthIdx] || ""} ${day}`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function parseStatusHistory(
  raw?: string | null,
  candidate?: Candidate | CandidateWithJob,
): StatusHistoryEntry[] {
  return getStatusHistoryDetails(raw, candidate).visibleHistory;
}

export function getStatusHistoryDetails(
  raw?: string | null,
  candidate?: Candidate | CandidateWithJob,
): { visibleHistory: StatusHistoryEntry[]; totalStageCount: number } {
  if (candidate && candidate.submission_status === "sourced") {
    return { visibleHistory: [], totalStageCount: 0 };
  }

  const map = new Map<string, StatusHistoryEntry>();

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed as StatusHistoryEntry[]) {
          if (entry && entry.to_status && entry.to_status !== "sourced") {
            map.set(entry.to_status, entry);
          }
        }
      }
    } catch {
      // Ignore invalid JSON
    }
  }

  if (candidate && candidate.submission_status !== "sourced") {
    if (candidate.submitted_at && !map.has("submitted")) {
      map.set("submitted", {
        id: "m-submitted",
        from_status: "in_touch",
        to_status: "submitted",
        changed_at: candidate.submitted_at,
        submitted_at: candidate.submitted_at,
      });
    }
    if (candidate.interview_at && !map.has("interview")) {
      map.set("interview", {
        id: "m-interview",
        from_status: "submitted",
        to_status: "interview",
        changed_at: candidate.interview_at,
        interview_at: candidate.interview_at,
      });
    }
    if (candidate.placed_at && !map.has("placed")) {
      map.set("placed", {
        id: "m-placed",
        from_status: "interview",
        to_status: "placed",
        changed_at: candidate.placed_at,
        placed_at: candidate.placed_at,
      });
    }
    if (candidate.submission_status && !map.has(candidate.submission_status)) {
      map.set(candidate.submission_status, {
        id: `m-${candidate.submission_status}`,
        from_status: "in_touch",
        to_status: candidate.submission_status,
        changed_at: new Date().toISOString(),
        submitted_at: candidate.submitted_at ?? null,
        interview_at: candidate.interview_at ?? null,
        placed_at: candidate.placed_at ?? null,
        rejection_reason: candidate.rejection_reason ?? null,
      });
    }
  }

  const allProgressed = Array.from(map.values()).filter((e) => e.to_status !== "sourced");
  if (allProgressed.length === 0) {
    return { visibleHistory: [], totalStageCount: 0 };
  }

  // Calculate total stages reached (always counting in_touch if candidate reached in_touch or beyond)
  let totalStageCount = allProgressed.length;
  const hasInTouch = allProgressed.some((e) => e.to_status === "in_touch");
  const hasAdvanced = allProgressed.some(
    (e) => e.to_status === "submitted" || e.to_status === "interview" || e.to_status === "placed",
  );
  if (!hasInTouch && hasAdvanced) {
    totalStageCount += 1;
  }

  // Visible badges: once submitted or beyond, hide in_touch badge
  let visibleList = [...allProgressed];
  if (hasAdvanced) {
    visibleList = visibleList.filter((e) => e.to_status !== "in_touch");
  }

  visibleList.sort((a, b) => {
    const orderA = PIPELINE_STAGE_ORDER[a.to_status] ?? 99;
    const orderB = PIPELINE_STAGE_ORDER[b.to_status] ?? 99;
    return orderA - orderB;
  });

  return {
    visibleHistory: visibleList,
    totalStageCount,
  };
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
  if (nextStatus === "sourced") {
    return "[]";
  }

  const currentHistory = parseStatusHistory(candidate.status_history, candidate);
  const fromStatus = candidate.submission_status ?? "in_touch";

  const submittedAt = meta?.submitted_at !== undefined ? meta.submitted_at : candidate.submitted_at;
  const interviewAt = meta?.interview_at !== undefined ? meta.interview_at : candidate.interview_at;
  const placedAt = meta?.placed_at !== undefined ? meta.placed_at : candidate.placed_at;
  const rejectionReason = meta?.rejection_reason !== undefined ? meta.rejection_reason : candidate.rejection_reason;

  let milestoneDate = new Date().toISOString();
  if (nextStatus === "submitted" && submittedAt) milestoneDate = submittedAt;
  if (nextStatus === "interview" && interviewAt) milestoneDate = interviewAt;
  if (nextStatus === "placed" && placedAt) milestoneDate = placedAt;

  const newEntry: StatusHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from_status: fromStatus,
    to_status: nextStatus,
    changed_at: milestoneDate,
    submitted_at: submittedAt ?? null,
    interview_at: interviewAt ?? null,
    placed_at: placedAt ?? null,
    rejection_reason: rejectionReason ?? null,
  };

  const filtered = currentHistory.filter((e) => e.to_status !== nextStatus && e.to_status !== "sourced");

  if (nextStatus === "submitted" || nextStatus === "interview" || nextStatus === "placed") {
    filtered.push(newEntry);
  } else {
    filtered.push(newEntry);
  }

  if (submittedAt && !filtered.some((e) => e.to_status === "submitted")) {
    filtered.push({
      id: `${Date.now()}-sub`,
      from_status: "in_touch",
      to_status: "submitted",
      changed_at: submittedAt,
      submitted_at: submittedAt,
    });
  }
  if (interviewAt && !filtered.some((e) => e.to_status === "interview")) {
    filtered.push({
      id: `${Date.now()}-int`,
      from_status: "submitted",
      to_status: "interview",
      changed_at: interviewAt,
      interview_at: interviewAt,
    });
  }
  if (placedAt && !filtered.some((e) => e.to_status === "placed")) {
    filtered.push({
      id: `${Date.now()}-plc`,
      from_status: "interview",
      to_status: "placed",
      changed_at: placedAt,
      placed_at: placedAt,
    });
  }

  if (filtered.some((e) => e.to_status === "submitted" || e.to_status === "interview" || e.to_status === "placed")) {
    filtered.splice(0, filtered.length, ...filtered.filter((e) => e.to_status !== "in_touch"));
  }

  filtered.sort((a, b) => {
    const orderA = PIPELINE_STAGE_ORDER[a.to_status] ?? 99;
    const orderB = PIPELINE_STAGE_ORDER[b.to_status] ?? 99;
    return orderA - orderB;
  });

  return JSON.stringify(filtered);
}

export function syncMilestoneDatesInHistory(
  candidate: Candidate | CandidateWithJob,
  updates: {
    submitted_at?: string | null;
    interview_at?: string | null;
    placed_at?: string | null;
    rejection_reason?: string | null;
  },
): string {
  if (candidate.submission_status === "sourced") {
    return "[]";
  }

  const currentHistory = parseStatusHistory(candidate.status_history, candidate);
  let list = currentHistory.filter((e) => e.to_status !== "sourced");

  if (updates.submitted_at !== undefined) {
    const idx = list.findIndex((e) => e.to_status === "submitted");
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        submitted_at: updates.submitted_at,
        changed_at: updates.submitted_at || list[idx].changed_at,
      };
    } else if (updates.submitted_at) {
      list.push({
        id: `${Date.now()}-sub`,
        from_status: "in_touch",
        to_status: "submitted",
        changed_at: updates.submitted_at,
        submitted_at: updates.submitted_at,
      });
    }
  }

  if (updates.interview_at !== undefined) {
    const idx = list.findIndex((e) => e.to_status === "interview");
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        interview_at: updates.interview_at,
        changed_at: updates.interview_at || list[idx].changed_at,
      };
    } else if (updates.interview_at) {
      list.push({
        id: `${Date.now()}-int`,
        from_status: "submitted",
        to_status: "interview",
        changed_at: updates.interview_at,
        interview_at: updates.interview_at,
      });
    }
  }

  if (updates.placed_at !== undefined) {
    const idx = list.findIndex((e) => e.to_status === "placed");
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        placed_at: updates.placed_at,
        changed_at: updates.placed_at || list[idx].changed_at,
      };
    } else if (updates.placed_at) {
      list.push({
        id: `${Date.now()}-plc`,
        from_status: "interview",
        to_status: "placed",
        changed_at: updates.placed_at,
        placed_at: updates.placed_at,
      });
    }
  }

  const curr = candidate.submission_status;
  if (curr && curr !== "sourced" && !list.some((e) => e.to_status === curr)) {
    list.push({
      id: `${Date.now()}-curr`,
      from_status: "in_touch",
      to_status: curr,
      changed_at: new Date().toISOString(),
      submitted_at: candidate.submitted_at ?? null,
      interview_at: candidate.interview_at ?? null,
      placed_at: candidate.placed_at ?? null,
    });
  }

  if (list.some((e) => e.to_status === "submitted" || e.to_status === "interview" || e.to_status === "placed")) {
    list = list.filter((e) => e.to_status !== "in_touch");
  }

  list.sort((a, b) => {
    const orderA = PIPELINE_STAGE_ORDER[a.to_status] ?? 99;
    const orderB = PIPELINE_STAGE_ORDER[b.to_status] ?? 99;
    return orderA - orderB;
  });

  return JSON.stringify(list);
}
