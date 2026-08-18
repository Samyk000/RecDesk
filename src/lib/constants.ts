export const SUBMISSION_STATUSES = [
  "sourced",
  "in_touch",
  "submitted",
  "interview",
  "rejected",
  "not_interested",
] as const;

export const BULK_STATUSES = ["sourced", "in_touch", "not_interested"] as const;

export const JOB_STATUSES = ["active", "on_hold", "closed"] as const;

export const WORK_MODELS = ["Remote", "Hybrid", "Onsite"] as const;

export const CONTRACT_TYPES = ["Contract", "Permanent", "Contract-to-Hire"] as const;

type Palette = {
  dot: string;
  badge: string;
  badgeText: string;
  chip: string;
  chipText: string;
  bar: string;
};

export const SUBMISSION_PALETTE: Record<string, Palette> = {
  sourced: {
    dot: "#64748b",
    badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    badgeText: "text-slate-700 dark:text-slate-300",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
    chipText: "text-slate-600 dark:text-slate-300",
    bar: "bg-slate-400",
  },
  in_touch: {
    dot: "#3b82f6",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    badgeText: "text-blue-700 dark:text-blue-300",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
    chipText: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-400",
  },
  submitted: {
    dot: "#f59e0b",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    badgeText: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    chipText: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-400",
  },
  interview: {
    dot: "#8b5cf6",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    badgeText: "text-violet-700 dark:text-violet-300",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    chipText: "text-violet-700 dark:text-violet-300",
    bar: "bg-violet-400",
  },
  rejected: {
    dot: "#ef4444",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
    badgeText: "text-red-700 dark:text-red-300",
    chip: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
    chipText: "text-red-700 dark:text-red-300",
    bar: "bg-red-400",
  },
  not_interested: {
    dot: "#a3a3ad",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    badgeText: "text-slate-600 dark:text-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
    chipText: "text-slate-500 dark:text-slate-400",
    bar: "bg-slate-400",
  },
};

export const JOB_PALETTE: Record<string, Palette> = {
  active: {
    dot: "#2563eb",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    badgeText: "text-blue-700 dark:text-blue-300",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
    chipText: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  on_hold: {
    dot: "#f59e0b",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    badgeText: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    chipText: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-400",
  },
  closed: {
    dot: "#64748b",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    badgeText: "text-slate-600 dark:text-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
    chipText: "text-slate-500 dark:text-slate-400",
    bar: "bg-slate-400",
  },
};

export const CANDIDATE_PALETTE: Record<string, Palette> = {
  active: {
    dot: "#22c55e",
    badge: "bg-green-500/15 text-green-700 dark:text-green-300",
    badgeText: "text-green-700 dark:text-green-300",
    chip: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200",
    chipText: "text-green-700 dark:text-green-300",
    bar: "bg-green-500",
  },
  inactive: {
    dot: "#a3a3ad",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    badgeText: "text-slate-600 dark:text-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
    chipText: "text-slate-500 dark:text-slate-400",
    bar: "bg-slate-400",
  },
  archived: {
    dot: "#a3a3ad",
    badge: "bg-slate-500/15 text-slate-500 dark:text-slate-500",
    badgeText: "text-slate-500 dark:text-slate-500",
    chip: "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400",
    chipText: "text-slate-500 dark:text-slate-400",
    bar: "bg-slate-400",
  },
};

export function submissionPalette(status: string): Palette {
  return SUBMISSION_PALETTE[status] ?? SUBMISSION_PALETTE.sourced;
}

import {
  CalendarCheck,
  ChatCircle,
  MagnifyingGlass,
  PaperPlaneTilt,
  Prohibit,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";

export const SUBMISSION_ICONS: Record<string, Icon> = {
  sourced: MagnifyingGlass,
  in_touch: ChatCircle,
  submitted: PaperPlaneTilt,
  interview: CalendarCheck,
  rejected: XCircle,
  not_interested: Prohibit,
};

export function submissionIcon(status: string): Icon {
  return SUBMISSION_ICONS[status] ?? MagnifyingGlass;
}

export function jobPalette(status: string): Palette {
  return JOB_PALETTE[status] ?? JOB_PALETTE.active;
}

export function candidatePalette(status: string): Palette {
  return CANDIDATE_PALETTE[status] ?? CANDIDATE_PALETTE.active;
}

export function matchColor(score: number | null | undefined): string {
  if (score == null) return "text-fg-subtle";
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}