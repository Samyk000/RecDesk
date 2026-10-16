import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getDayOrdinal(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatDateOrdinal(iso: string | null | undefined): string {
  if (!iso) return "-";
  const trimmed = iso.trim();
  if (!trimmed) return "-";

  // Match YYYY-MM-DD from start, whether followed by T, space, or end of string
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const monthName = MONTHS[month - 1] || "Dec";
      const year2 = String(year).slice(-2);
      return `${getDayOrdinal(day)} ${monthName} ${year2}`;
    }
  }

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const monthName = MONTHS[d.getMonth()] || "Dec";
  const year2 = String(d.getFullYear()).slice(-2);
  return `${getDayOrdinal(day)} ${monthName} ${year2}`;
}

export function parseDateOnly(iso: string | null | undefined): string {
  if (!iso) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const trimmed = iso.trim();
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const yyyy = match[1];
    const mm = match[2].padStart(2, "0");
    const dd = match[3].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

export function formatDateAbbr(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const day = d.getDate().toString().padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${MONTHS[d.getMonth()]}-${year}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function titleCase(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function nameInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export function formatZoneTime(zone: string, includeTz = false, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    ...(includeTz ? { timeZoneName: "short" } : {}),
  }).format(now);
}

export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  doc
    .querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, tr")
    .forEach((el) => el.after("\n"));
  return (doc.body.textContent ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Safely parses date strings that might contain trailing timezone abbreviations
 * (e.g. "2026-10-04T14:30 EST", "2026-08-10 external", or plain "2026-08-10").
 * Strips non-standard suffixes before Date parsing so Chromium doesn't yield Invalid Date.
 */
export function parseSafeDate(val?: string | null): { date: Date | null; tz: string } {
  if (!val || !val.trim()) return { date: null, tz: "" };
  const trimmed = val.trim();
  const parts = trimmed.split(/\s+/);
  const dateTimePart = parts[0] || "";
  const tz = parts.slice(1).join(" ");

  const d = new Date(dateTimePart);
  if (!Number.isNaN(d.getTime())) {
    return { date: d, tz };
  }

  const match = dateTimePart.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const fallback = new Date(year, month - 1, day, 12, 0, 0);
    return { date: Number.isNaN(fallback.getTime()) ? null : fallback, tz };
  }

  return { date: null, tz };
}