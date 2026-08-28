/**
 * RecDesk Timezone & Date Conversion Utilities
 * Handles exact conversions between US recruitment timezones (EDT, CDT, MDT, PDT),
 * IST (user local laptop time), and UTC for reliable reminder scheduling.
 */

export interface TimezoneOption {
  value: string; // IANA timezone identifier
  label: string; // User-facing abbreviation and description
  shortName: string;
}

export const RECRUITER_TIMEZONES: TimezoneOption[] = [
  { value: "America/New_York", label: "EDT / EST (Eastern Time)", shortName: "EDT" },
  { value: "America/Chicago", label: "CDT / CST (Central Time)", shortName: "CDT" },
  { value: "America/Denver", label: "MDT / MST (Mountain Time)", shortName: "MDT" },
  { value: "America/Los_Angeles", label: "PDT / PST (Pacific Time)", shortName: "PDT" },
  { value: "Asia/Kolkata", label: "IST (India Standard Time)", shortName: "IST" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)", shortName: "UTC" },
];

/**
 * Converts a date and time string specified in a given timezone into an exact UTC ISO string.
 * Automatically accounts for Daylight Saving Time (EDT vs EST) using browser Intl API.
 */
export function toUtcIsoString(
  dateStr: string,
  timeStr: string | null | undefined,
  timeZone: string,
): string {
  // If time is omitted, default to 09:00 in the target timezone
  const time = timeStr && timeStr.trim() ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr) : "09:00:00";
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const [year, month, day] = dateStr.split("-").map(Number);

  // We find the UTC time that, when displayed in `timeZone`, matches year, month, day, hours, minutes.
  // Step 1: Create a provisional UTC date
  const provisionalUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds || 0));

  // Step 2: Format this provisional date in the target timezone to calculate the offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(provisionalUtc);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }

  // Handle 24-hour rollover edge case
  const formattedHour = map.hour === 24 ? 0 : map.hour;
  const formattedUtc = Date.UTC(map.year, map.month - 1, map.day, formattedHour, map.minute, map.second);

  // Difference in milliseconds gives the timezone offset
  const offsetMs = provisionalUtc.getTime() - formattedUtc;
  const exactUtcEpoch = provisionalUtc.getTime() + offsetMs;

  return new Date(exactUtcEpoch).toISOString();
}

/**
 * Format a UTC ISO string into a local laptop time preview string
 */
export function getLocalLaptopTimePreview(
  dateStr: string,
  timeStr: string | null | undefined,
  timeZone: string,
): string {
  if (!dateStr) return "";
  try {
    const utcIso = toUtcIsoString(dateStr, timeStr, timeZone);
    const dateObj = new Date(utcIso);

    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localTimeStr = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const isSameDay =
      new Date().toLocaleDateString() === dateObj.toLocaleDateString();

    const datePrefix = isSameDay ? "Today" : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const tzShort = localTz === "Asia/Kolkata" || localTz === "Asia/Calcutta" ? "IST" : "Local";

    return `${datePrefix} at ${localTimeStr} (${tzShort})`;
  } catch {
    return "";
  }
}

/**
 * Returns short abbreviation for an IANA timezone
 */
export function getTimezoneShort(tzValue: string): string {
  const match = RECRUITER_TIMEZONES.find((t) => t.value === tzValue);
  if (match) return match.shortName;
  if (tzValue === "Asia/Kolkata" || tzValue === "Asia/Calcutta") return "IST";
  if (tzValue === "America/New_York") return "EDT";
  if (tzValue === "America/Chicago") return "CDT";
  if (tzValue === "America/Denver") return "MDT";
  if (tzValue === "America/Los_Angeles") return "PDT";
  return tzValue;
}
