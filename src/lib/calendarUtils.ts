import type { CandidateWithJob } from "../types";
import { parseInterviewRounds, parseRejectionDetail, isExternalSubmission, getSubmissionTimestamp } from "./candidateUtils";
import { formatDate } from "./utils";

export type CalendarEventType = "submission" | "interview" | "placement";

export type CalendarOutcomeDotColor = "red" | "emerald" | "violet" | "amber" | "gray";

export interface CalendarEventOutcome {
  status: string;
  dotColor: CalendarOutcomeDotColor;
  title: string;
  remarks: string | null;
  date: string | null;
}

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  dateKey: string; // YYYY-MM-DD
  rawDate: string; // ISO string or plain date
  formattedTime: string;
  candidate: CandidateWithJob;
  roundNumber?: number;
  roundName?: string;
  status: string;
  subStage: string | null;
  outcome?: "pending" | "passed" | "rejected" | "placed";
  eventOutcome: CalendarEventOutcome;
}

export interface DayCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export interface CalendarAnalytics {
  totalSubmissions: number;
  totalInterviews: number;
  round1Interviews: number;
  round2Interviews: number;
  round3PlusInterviews: number;
  totalPlaced: number;
  totalRejected: number;
}

/**
 * Safely normalizes any date representation (ISO, YYYY-MM-DD, Timestamp) to a local YYYY-MM-DD key.
 * Prevents UTC midnight timezone shifting (e.g. 2026-08-19 shifting to 2026-08-18).
 */
export function formatDateKey(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") {
    const trimmed = d.trim();
    if (!trimmed) return null;

    // Check if starts with YYYY-MM-DD (e.g. "2026-08-19" or "2026-08-19 14:30:00")
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      // If it's a plain date without timezone offset 'Z' or '+', preserve the literal YYYY-MM-DD
      if (!trimmed.includes("T") && !trimmed.includes("Z")) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
      // If it's an ISO timestamp with explicit time, parse in local timezone
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
      return `${match[1]}-${match[2]}-${match[3]}`;
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return null;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTimeFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const trimmed = iso.trim();
  if (!trimmed.includes("T") && !trimmed.includes(":") && !trimmed.includes(" ")) {
    return "";
  }
  // Offset-aware stamps convert; tz-tagged strings ("2026-10-04T14:30 EST") and
  // naive local stamps read their literal clock time instead of going through
  // Date(), which rejects any abbreviation or IANA name.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const m = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return new Date(2000, 0, 1, Number(m[1]), Number(m[2])).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Determines the live outcome indicator for a calendar event based on candidate's current pipeline state
 */
export function getEventOutcome(
  candidate: CandidateWithJob,
  eventType: CalendarEventType,
  roundNumber?: number,
): CalendarEventOutcome {
  const currentStatus = candidate.submission_status;

  if (currentStatus === "rejected") {
    const rejDetail = parseRejectionDetail(candidate.rejection_reason);
    let title = "Rejected";
    if (rejDetail.origin === "client_screening") {
      title = "Rejected · Client Screening";
    } else if (rejDetail.origin === "interview") {
      title = rejDetail.round_number
        ? `Rejected · Post Round ${rejDetail.round_number}`
        : "Rejected · Post Interview";
    } else if (rejDetail.origin === "internal") {
      title = "Rejected · Internal Review";
    } else {
      title = "Rejected · General";
    }

    const remarks = rejDetail.reason?.trim() || null;
    const dateRaw = rejDetail.rejected_at || candidate.last_updated;
    const date = dateRaw ? formatDate(dateRaw) : null;

    return {
      status: "rejected",
      dotColor: "red",
      title,
      remarks,
      date,
    };
  }

  if (currentStatus === "placed") {
    const dateRaw = candidate.placed_at || candidate.last_updated;
    return {
      status: "placed",
      dotColor: "emerald",
      title: "Placed with Client",
      remarks: "Candidate placed successfully",
      date: dateRaw ? formatDate(dateRaw) : null,
    };
  }

  if (currentStatus === "interview") {
    const dateRaw = candidate.interview_at || candidate.last_updated;
    const remarks =
      eventType === "interview" && roundNumber
        ? `Round ${roundNumber} in progress`
        : candidate.interview_at
          ? `Interview scheduled (${formatDate(candidate.interview_at)})`
          : "Candidate in interview stage";

    return {
      status: "interview",
      dotColor: "violet",
      title: "In Interview Process",
      remarks,
      date: dateRaw ? formatDate(dateRaw) : null,
    };
  }

  if (currentStatus === "not_interested") {
    return {
      status: "not_interested",
      dotColor: "gray",
      title: "Not Interested / Withdrawn",
      remarks: candidate.rejection_reason?.trim() || "Candidate withdrawn",
      date: formatDate(candidate.last_updated),
    };
  }

  // Active submittal awaiting client feedback
  const dateRaw = candidate.submitted_at || candidate.last_updated;
  return {
    status: currentStatus,
    dotColor: "amber",
    title: "In Review · Client Feedback Pending",
    remarks: "Submitted to client, awaiting screening feedback",
    date: dateRaw ? formatDate(dateRaw) : null,
  };
}

/**
 * Extracts external submissions, interview rounds, and placements for the calendar
 */
export function extractCalendarEvents(candidates: CandidateWithJob[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const cand of candidates) {
    const rejDetail = parseRejectionDetail(cand.rejection_reason);

    // ==========================================
    // 1. EXTERNAL SUBMISSION EVENTS
    // ==========================================
    const isSubmittedStage = cand.submission_status === "submitted";
    const hasSubmissionDate = !!cand.submitted_at?.trim();
    const isExt = isExternalSubmission(cand);

    if (isExt || isSubmittedStage || hasSubmissionDate) {
      const rawDate = cand.submitted_at || cand.date_added || cand.last_updated;
      const dateKey = formatDateKey(rawDate);

        if (dateKey) {
          const outcome =
            cand.submission_status === "rejected"
              ? "rejected"
              : cand.submission_status === "placed"
                ? "placed"
                : cand.submission_status === "interview"
                  ? "passed"
                  : "pending";

          events.push({
            id: `sub_${cand.id}_${dateKey}`,
            type: "submission",
            dateKey,
            rawDate: rawDate,
            formattedTime: formatTimeFromIso(rawDate),
            candidate: cand,
            status: "submitted",
            subStage: null,
            outcome,
            eventOutcome: getEventOutcome(cand, "submission"),
          });
        }
      }

    // ==========================================
    // 2. INTERVIEW EVENTS
    // ==========================================
    const rounds = parseInterviewRounds(cand.interview_status, cand.interview_at);
    const isInterviewStage = cand.submission_status === "interview";

    let createdInterviewEvent = false;

    rounds.forEach((round) => {
      if (round.scheduled_at?.trim()) {
        const dateKey = formatDateKey(round.scheduled_at);
        if (dateKey) {
          const isRejectedAfterThisRound =
            cand.submission_status === "rejected" &&
            rejDetail.origin === "interview" &&
            rejDetail.round_number === round.round_number;

          events.push({
            id: `int_${cand.id}_r${round.round_number}_${dateKey}`,
            type: "interview",
            dateKey,
            rawDate: round.scheduled_at,
            formattedTime: formatTimeFromIso(round.scheduled_at),
            candidate: cand,
            roundNumber: round.round_number,
            roundName: round.round_name,
            status: "interview",
            subStage: `Round ${round.round_number}`,
            outcome: isRejectedAfterThisRound
              ? "rejected"
              : cand.submission_status === "placed"
                ? "placed"
                : "pending",
            eventOutcome: getEventOutcome(cand, "interview", round.round_number),
          });
          createdInterviewEvent = true;
        }
      }
    });

    // Fallback ONLY if candidate is currently in interview status and has an interview_at date
    if (!createdInterviewEvent && isInterviewStage && cand.interview_at?.trim()) {
      const rawDate = cand.interview_at;
      const dateKey = formatDateKey(rawDate);
      if (dateKey) {
        events.push({
          id: `int_${cand.id}_fallback_${dateKey}`,
          type: "interview",
          dateKey,
          rawDate: rawDate,
          formattedTime: formatTimeFromIso(rawDate),
          candidate: cand,
          roundNumber: 1,
          roundName: "Round 1: Screening",
          status: "interview",
          subStage: "Round 1",
          outcome: "pending",
          eventOutcome: getEventOutcome(cand, "interview", 1),
        });
      }
    }

    // ==========================================
    // 3. PLACEMENT EVENTS
    // ==========================================
    if (cand.placed_at?.trim() && cand.submission_status === "placed") {
      const dateKey = formatDateKey(cand.placed_at);
      if (dateKey) {
        events.push({
          id: `plc_${cand.id}_${dateKey}`,
          type: "placement",
          dateKey,
          rawDate: cand.placed_at,
          formattedTime: formatTimeFromIso(cand.placed_at),
          candidate: cand,
          status: "placed",
          subStage: "Placed",
          outcome: "placed",
          eventOutcome: getEventOutcome(cand, "placement"),
        });
      }
    }
  }

  // Sort events chronologically
  return events.sort((a, b) => {
    const timeA = getSubmissionTimestamp(a.rawDate);
    const timeB = getSubmissionTimestamp(b.rawDate);
    return timeA - timeB;
  });
}

/**
 * Builds a full 35 or 42 cell matrix for a given month and year
 */
export function getMonthMatrix(currentDate: Date, events: CalendarEvent[]): DayCell[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Index events by dateKey for fast lookup
  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.forEach((ev) => {
    const list = eventsByDate.get(ev.dateKey) || [];
    list.push(ev);
    eventsByDate.set(ev.dateKey, list);
  });

  const todayKey = formatDateKey(new Date());
  const matrix: DayCell[] = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const d = new Date(year, month - 1, day);
    const key = formatDateKey(d)!;
    matrix.push({
      date: d,
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: key === todayKey,
      events: eventsByDate.get(key) || [],
    });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = formatDateKey(d)!;
    matrix.push({
      date: d,
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: key === todayKey,
      events: eventsByDate.get(key) || [],
    });
  }

  // Next month leading days to complete grid (up to multiple of 7)
  const remainingCells = (7 - (matrix.length % 7)) % 7;
  for (let day = 1; day <= remainingCells; day++) {
    const d = new Date(year, month + 1, day);
    const key = formatDateKey(d)!;
    matrix.push({
      date: d,
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: key === todayKey,
      events: eventsByDate.get(key) || [],
    });
  }

  return matrix;
}

export type CalendarAnalyticsScope = "all" | "month" | "week";

/**
 * Calculates recruitment velocity metrics across All Time, active month, or active week.
 * De-duplicates unique candidates per metric category so counts are accurate and clean.
 * Defaults to active month view so calendar cards show month-wise activity.
 */
export function getCalendarAnalytics(
  events: CalendarEvent[],
  currentDate: Date,
  scope: CalendarAnalyticsScope = "month",
  candidates?: CandidateWithJob[],
): CalendarAnalytics {
  const targetYear = currentDate.getFullYear();
  const targetMonth = currentDate.getMonth();

  // For weekly scope: compute start and end of week
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const isDateInScope = (dateKey: string | null | undefined): boolean => {
    if (!dateKey) return false;
    if (scope === "all") return true;
    const [ey, em, ed] = dateKey.split("-").map(Number);
    if (!ey || !em || !ed) return false;
    if (scope === "month") {
      return ey === targetYear && (em - 1) === targetMonth;
    }
    const evDate = new Date(ey, em - 1, ed);
    return evDate >= startOfWeek && evDate <= endOfWeek;
  };

  const filtered = events.filter((ev) => isDateInScope(ev.dateKey));

  const submissionCandidateIds = new Set<string>();
  const interviewCandidateIds = new Set<string>();
  const placedCandidateIds = new Set<string>();
  const rejectedCandidateIds = new Set<string>();

  let r1Count = 0;
  let r2Count = 0;
  let r3PlusCount = 0;

  filtered.forEach((ev) => {
    const candId = ev.candidate.id;

    if (ev.type === "submission") {
      submissionCandidateIds.add(candId);
    } else if (ev.type === "interview") {
      interviewCandidateIds.add(candId);
      if (ev.roundNumber === 1) {
        r1Count++;
      } else if (ev.roundNumber === 2) {
        r2Count++;
      } else if (ev.roundNumber && ev.roundNumber >= 3) {
        r3PlusCount++;
      }
    } else if (ev.type === "placement") {
      placedCandidateIds.add(candId);
    }

    if (ev.outcome === "rejected") {
      rejectedCandidateIds.add(candId);
    }
  });

  // If candidate list provided, ensure placements and rejections are accurately accounted by their action date
  if (candidates) {
    candidates.forEach((cand) => {
      if (cand.submission_status === "placed") {
        const pKey = formatDateKey(cand.placed_at || cand.last_updated);
        if (isDateInScope(pKey)) {
          placedCandidateIds.add(cand.id);
        }
      } else if (cand.submission_status === "rejected") {
        const rejDetail = parseRejectionDetail(cand.rejection_reason);
        const rKey = formatDateKey(rejDetail.rejected_at || cand.last_updated);
        if (isDateInScope(rKey)) {
          rejectedCandidateIds.add(cand.id);
        }
      }
    });
  }

  return {
    totalSubmissions: submissionCandidateIds.size,
    totalInterviews: interviewCandidateIds.size,
    round1Interviews: r1Count,
    round2Interviews: r2Count,
    round3PlusInterviews: r3PlusCount,
    totalPlaced: placedCandidateIds.size,
    totalRejected: rejectedCandidateIds.size,
  };
}
