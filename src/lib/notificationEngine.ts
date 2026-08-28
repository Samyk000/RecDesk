import React, { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { toast } from "sonner";
import { apiReminders } from "./api";
import { playSoftChime, playCompletionChime } from "./notificationSound";
import type { ReminderWithContext } from "../types";
import { titleCase } from "./utils";
import { getTimezoneShort } from "./timezoneUtils";

const FIRED_REMINDERS_KEY = "recdesk_fired_reminders_v1";

function getFiredSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_REMINDERS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // Ignore storage parse error
  }
  return new Set();
}

function markFired(id: string): void {
  try {
    const set = getFiredSet();
    set.add(id);
    sessionStorage.setItem(FIRED_REMINDERS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage write error
  }
}

/**
 * Request OS / Tauri Notification permissions
 */
export async function requestAppNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  } catch {
    // Fallback to browser standard
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        const p = await Notification.requestPermission();
        return p === "granted";
      }
    }
    return false;
  }
}

/**
 * Dispatch native desktop notifications, in-app toasts, and soothing audio chime
 */
export async function fireReminderAlert(
  reminder: ReminderWithContext,
  queryClient?: ReturnType<typeof useQueryClient>,
): Promise<void> {
  markFired(reminder.id);

  // 1. Play soothing dual-tone 528Hz bell chime
  playSoftChime(0.28);

  const tzShort = getTimezoneShort(reminder.timezone);
  const timeLabel = reminder.due_time ? `${reminder.due_time} ${tzShort}` : reminder.due_date;
  const contextDetails = [
    reminder.candidate_name ? `Candidate: ${reminder.candidate_name}` : null,
    reminder.job_title ? `Job: ${reminder.job_title}` : null,
    reminder.client_name ? `Client: ${reminder.client_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const notifTitle = `RecDesk ${titleCase(reminder.category)}: ${reminder.title}`;
  const notifBody = `${timeLabel}${contextDetails ? `\n${contextDetails}` : ""}${reminder.description ? `\n${reminder.description}` : ""}`;

  // 2. Trigger native OS / Windows Action Center Toast via Tauri Plugin
  try {
    const granted = await isPermissionGranted();
    if (granted) {
      sendNotification({
        title: notifTitle,
        body: notifBody,
      });
    } else {
      const perm = await requestPermission();
      if (perm === "granted") {
        sendNotification({
          title: notifTitle,
          body: notifBody,
        });
      } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(notifTitle, { body: notifBody, icon: "/app-icon.png" });
      }
    }
  } catch {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(notifTitle, { body: notifBody, icon: "/app-icon.png" });
      }
    } catch {
      // Suppress
    }
  }

  // 3. Interactive In-App Sonner Toast rendered with createElement (100% valid in .ts file)
  toast.custom(
    (t) =>
      React.createElement(
        "div",
        {
          className:
            "flex w-full min-w-[340px] max-w-md flex-col gap-2 rounded-xl border border-primary/40 bg-surface p-3.5 shadow-xl transition-all",
        },
        [
          React.createElement(
            "div",
            { key: "header", className: "flex items-start justify-between gap-2" },
            [
              React.createElement("div", { key: "badges", className: "flex items-center gap-2" }, [
                React.createElement(
                  "span",
                  {
                    key: "cat",
                    className:
                      "flex h-6 items-center rounded-md bg-primary/15 px-2 text-[10.5px] font-bold uppercase tracking-wider text-primary",
                  },
                  reminder.category,
                ),
                reminder.priority === "high"
                  ? React.createElement(
                      "span",
                      {
                        key: "pri",
                        className:
                          "flex h-5 items-center rounded bg-red-500/15 px-1.5 text-[9.5px] font-bold uppercase text-red-600 dark:text-red-400",
                      },
                      "High",
                    )
                  : null,
                React.createElement(
                  "span",
                  { key: "time", className: "text-xs font-semibold text-fg-subtle" },
                  timeLabel,
                ),
              ]),
              React.createElement(
                "button",
                {
                  key: "close",
                  onClick: () => toast.dismiss(t),
                  className: "text-xs text-fg-subtle hover:text-fg cursor-pointer",
                },
                "✕",
              ),
            ],
          ),
          React.createElement("div", { key: "content" }, [
            React.createElement(
              "h4",
              { key: "title", className: "text-[13.5px] font-bold text-fg leading-snug" },
              reminder.title,
            ),
            reminder.description
              ? React.createElement(
                  "p",
                  { key: "desc", className: "mt-0.5 text-xs text-fg-muted line-clamp-2" },
                  reminder.description,
                )
              : null,
            contextDetails
              ? React.createElement(
                  "p",
                  { key: "ctx", className: "mt-1 text-[11px] font-medium text-fg-subtle truncate" },
                  contextDetails,
                )
              : null,
          ]),
          React.createElement(
            "div",
            {
              key: "actions",
              className: "mt-1 flex items-center justify-end gap-2 border-t border-border/50 pt-2",
            },
            [
              React.createElement(
                "button",
                {
                  key: "snooze",
                  type: "button",
                  onClick: async () => {
                    toast.dismiss(t);
                    try {
                      await apiReminders.snooze(reminder.id, 10);
                      toast.info(`Snoozed "${reminder.title}" for 10 minutes`);
                      queryClient?.invalidateQueries({ queryKey: ["reminders"] });
                    } catch {
                      toast.error("Failed to snooze");
                    }
                  },
                  className:
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors cursor-pointer",
                },
                "⏱ Snooze 10m",
              ),
              React.createElement(
                "button",
                {
                  key: "complete",
                  type: "button",
                  onClick: async () => {
                    toast.dismiss(t);
                    try {
                      await apiReminders.toggleCompleted(reminder.id);
                      playCompletionChime();
                      toast.success(`Completed: ${reminder.title}`);
                      queryClient?.invalidateQueries({ queryKey: ["reminders"] });
                    } catch {
                      toast.error("Failed to mark completed");
                    }
                  },
                  className:
                    "flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer",
                },
                "✓ Mark Done",
              ),
            ],
          ),
        ],
      ),
    {
      duration: 12000,
    },
  );
}

/**
 * Top-level background notification scheduler hook.
 * Checks for due reminders every 6 seconds and dispatches alerts.
 */
export function useNotificationScheduler(): void {
  const queryClient = useQueryClient();
  const checkingRef = useRef(false);

  useEffect(() => {
    // Request permission once on startup
    requestAppNotificationPermission();

    const checkReminders = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const activeReminders = await apiReminders.list();
        const pendingOrSnoozed = activeReminders.filter(
          (r) => r.status === "pending" || r.status === "snoozed",
        );

        const now = Date.now();
        const firedSet = getFiredSet();

        for (const rem of pendingOrSnoozed) {
          if (firedSet.has(rem.id)) continue;

          // Target trigger time in timestamp milliseconds
          const targetIso =
            rem.status === "snoozed" && rem.snoozed_until ? rem.snoozed_until : rem.remind_at;
          const targetTime =
            new Date(targetIso).getTime() - rem.notify_before_minutes * 60 * 1000;

          // If target time has arrived
          if (now >= targetTime) {
            // If overdue by more than 24 hours (e.g. while laptop was shut for days), silently mark as fired
            const ageHours = (now - targetTime) / (1000 * 60 * 60);
            if (ageHours > 24) {
              markFired(rem.id);
              continue;
            }

            await fireReminderAlert(rem, queryClient);
          }
        }
      } catch {
        // Silently catch query errors during background check
      } finally {
        checkingRef.current = false;
      }
    };

    // Immediate check on mount
    checkReminders();

    // Fast, responsive interval: every 6 seconds
    const interval = setInterval(checkReminders, 6000);

    return () => clearInterval(interval);
  }, [queryClient]);
}
