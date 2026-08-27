import type { CandidateWithJob } from "../types";
import { parseInterviewRounds, parseRejectionDetail } from "./candidateUtils";

export type CalendarEventType = "submission" | "interview" | "placement";

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
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Extracts external submissions, interview rounds, and placements for the calendar
 */
export function extractCalendarEvents(candidates: CandidateWithJob[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const cand of candidates) {
    const rejDetail = parseRejectionDetail(cand.rejection_reason);

    // ==========================================
    // 1. EXTERNAL SUBMISSION EVENTS ONLY
    // (Internal reviews are internal steps and excluded from client calendar)
    // ==========================================
    const isInternalOnly =
      cand.client_feedback === "internal" || rejDetail.origin === "internal";

    if (!isInternalOnly) {
      const isSubmittedStage = cand.submission_status === "submitted";
      const hasSubmissionDate = !!cand.submitted_at?.trim();
      const isClientFeedback = cand.client_feedback === "client";
      const isClientRejection =
        cand.submission_status === "rejected" && rejDetail.origin === "client_screening";

      if (isSubmittedStage || hasSubmissionDate || isClientFeedback || isClientRejection) {
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
            status: cand.submission_status,
            subStage: "External",
            outcome,
          });
        }
      }
    }

    // ==========================================
    // 2. INTERVIEW EVENTS
    // ==========================================
    const rounds = parseInterviewRounds(cand.interview_status, cand.interview_at);
    const isInterviewStage = cand.submission_status === "interview";
    const isInterviewRejection =
      cand.submission_status === "rejected" && rejDetail.origin === "interview";

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
            status: cand.submission_status,
            subStage: `Round ${round.round_number}`,
            outcome: isRejectedAfterThisRound
              ? "rejected"
              : cand.submission_status === "placed"
                ? "placed"
                : "pending",
          });
          createdInterviewEvent = true;
        }
      }
    });

    // Fallback if candidate is in interview status or was rejected in interview, but rounds don't have scheduled_at
    if (!createdInterviewEvent && (isInterviewStage || isInterviewRejection)) {
      const rawDate =
        cand.interview_at || rejDetail.rejected_at || cand.last_updated || cand.date_added;
      const dateKey = formatDateKey(rawDate);
      if (dateKey) {
        events.push({
          id: `int_${cand.id}_fallback_${dateKey}`,
          type: "interview",
          dateKey,
          rawDate: rawDate,
          formattedTime: formatTimeFromIso(rawDate),
          candidate: cand,
          roundNumber: rejDetail.round_number || 1,
          roundName: rejDetail.round_number ? `Round ${rejDetail.round_number}` : "Round 1: Screening",
          status: cand.submission_status,
          subStage: rejDetail.round_number ? `Round ${rejDetail.round_number}` : "Round 1",
          outcome: cand.submission_status === "rejected" ? "rejected" : "pending",
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
        });
      }
    }
  }

  // Sort events chronologically
  return events.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
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

/**
 * Calculates recruitment velocity metrics for the active month or week
 */
export function getCalendarAnalytics(
  events: CalendarEvent[],
  currentDate: Date,
  scope: "month" | "week" = "month",
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

  const filtered = events.filter((ev) => {
    const evDate = new Date(ev.rawDate);
    if (scope === "month") {
      return evDate.getFullYear() === targetYear && evDate.getMonth() === targetMonth;
    }
    return evDate >= startOfWeek && evDate <= endOfWeek;
  });

  const analytics: CalendarAnalytics = {
    totalSubmissions: 0,
    totalInterviews: 0,
    round1Interviews: 0,
    round2Interviews: 0,
    round3PlusInterviews: 0,
    totalPlaced: 0,
    totalRejected: 0,
  };

  filtered.forEach((ev) => {
    if (ev.type === "submission") {
      analytics.totalSubmissions++;
    } else if (ev.type === "interview") {
      analytics.totalInterviews++;
      if (ev.roundNumber === 1) {
        analytics.round1Interviews++;
      } else if (ev.roundNumber === 2) {
        analytics.round2Interviews++;
      } else if (ev.roundNumber && ev.roundNumber >= 3) {
        analytics.round3PlusInterviews++;
      }
    } else if (ev.type === "placement") {
      analytics.totalPlaced++;
    }

    if (ev.outcome === "rejected") {
      analytics.totalRejected++;
    }
  });

  return analytics;
}
