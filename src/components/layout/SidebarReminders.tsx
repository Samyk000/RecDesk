import { useMemo, useState, useEffect } from "react";
import { Bell, CaretDown, Plus, Clock, CheckCircle } from "@phosphor-icons/react";
import { useReminders, useToggleReminderCompleted } from "../../hooks/useQueries";
import { ReminderModal } from "../reminders/ReminderModal";
import { playCompletionChime } from "../../lib/notificationSound";
import { cn } from "../../lib/utils";
import { getTimezoneShort } from "../../lib/timezoneUtils";
import type { ReminderCategory, ReminderWithContext } from "../../types";
import { toast } from "sonner";

function formatReminderSchedule(rem: ReminderWithContext): {
  dateLabel: string;
  isToday: boolean;
  isTomorrow: boolean;
  isPast: boolean;
} {
  const dateStr = rem.due_date;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return { dateLabel: dateStr, isToday: false, isTomorrow: false, isPast: false };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const d = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const tzShort = getTimezoneShort(rem.timezone);
  const timePart = rem.due_time ? ` ${rem.due_time} ${tzShort}` : "";

  if (diffDays === 0) {
    return {
      dateLabel: `Today${timePart}`,
      isToday: true,
      isTomorrow: false,
      isPast: false,
    };
  }

  if (diffDays === 1) {
    return {
      dateLabel: `Tomorrow${timePart}`,
      isToday: false,
      isTomorrow: true,
      isPast: false,
    };
  }

  if (diffDays < 0) {
    return {
      dateLabel: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${timePart}`,
      isToday: false,
      isTomorrow: false,
      isPast: true,
    };
  }

  return {
    dateLabel: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${timePart}`,
    isToday: false,
    isTomorrow: false,
    isPast: false,
  };
}

export function SidebarReminders() {
  const { data: reminders } = useReminders();
  const toggleCompleted = useToggleReminderCompleted();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<ReminderCategory>("reminder");

  // Collapsible state (open by default, persisted in localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("recdesk_reminders_collapsed");
    return saved === null ? false : saved === "true";
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    localStorage.setItem("recdesk_reminders_collapsed", collapsed.toString());
  }, [collapsed]);

  const handleToggle = () => {
    setIsTransitioning(true);
    setCollapsed((prev) => !prev);
    setTimeout(() => setIsTransitioning(false), 320);
  };

  const pendingList = useMemo(() => {
    if (!reminders) return [];
    return reminders.filter((r) => r.status === "pending" || r.status === "snoozed");
  }, [reminders]);

  const handleOpenModal = (category: ReminderCategory = "reminder") => {
    setModalCategory(category);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col px-2">
      {/* Header with Title, Count Badge, Quick Add (+) and Collapse Arrow */}
      <div className="group flex w-full shrink-0 items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover select-none">
        <button
          type="button"
          onClick={handleToggle}
          className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted group-hover:text-fg transition-colors cursor-pointer"
          aria-expanded={!collapsed}
          title={collapsed ? "Expand reminders" : "Collapse reminders"}
        >
          <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>Reminders</span>
          {pendingList.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              {pendingList.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal("reminder");
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:bg-surface-active hover:text-fg transition-colors cursor-pointer"
            title="Add reminder or task"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleToggle}
            className="flex h-5 w-5 items-center justify-center text-fg-subtle hover:text-fg cursor-pointer"
          >
            <CaretDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                collapsed ? "-rotate-90" : "rotate-0",
              )}
            />
          </button>
        </div>
      </div>

      {/* Butter-Smooth Collapsible Container with Scrollable Cards */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
          collapsed
            ? "grid-rows-[0fr] opacity-0 pointer-events-none"
            : "grid-rows-[1fr] opacity-100",
        )}
      >
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div
            className={cn(
              "mt-1.5 max-h-[190px] space-y-1.5 px-0.5 pb-1 scroll-smooth overscroll-contain",
              isTransitioning || collapsed
                ? "overflow-hidden"
                : "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {pendingList.length === 0 ? (
              <div
                onClick={() => handleOpenModal("reminder")}
                className="mx-0.5 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-3 text-center text-fg-subtle hover:border-primary/40 hover:text-fg transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4 text-fg-subtle" />
                <span className="mt-1 text-[11px] font-medium">+ Add reminder or task</span>
              </div>
            ) : (
              pendingList.map((rem) => {
                const sched = formatReminderSchedule(rem);

                return (
                  <div
                    key={rem.id}
                    onClick={() => handleOpenModal(rem.category)}
                    className="group relative flex w-full flex-col justify-center rounded-lg border border-border bg-surface px-2.5 py-2 text-left transition-all duration-150 hover:border-primary/50 hover:bg-surface-hover hover:shadow-xs cursor-pointer shadow-2xs"
                  >
                    {/* Line 1: Title & Check button */}
                    <div className="flex w-full items-center justify-between gap-1.5">
                      <span className="truncate text-[12px] font-bold text-fg group-hover:text-primary transition-colors">
                        {rem.title}
                      </span>

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await toggleCompleted.mutateAsync(rem.id);
                          playCompletionChime();
                          toast.success(`Completed: ${rem.title}`);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-fg-subtle hover:text-emerald-500 p-0.5 cursor-pointer shrink-0"
                        title="Mark as completed"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Line 2: Category Badge, Due Date/Time, Priority */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider",
                          rem.category === "meeting"
                            ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                            : rem.category === "task"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30",
                        )}
                      >
                        {rem.category}
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[10px] font-semibold leading-tight",
                          sched.isToday
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            : sched.isTomorrow
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : sched.isPast
                                ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 font-bold"
                                : "bg-surface-active text-fg border border-border/80",
                        )}
                      >
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{sched.dateLabel}</span>
                      </span>

                      {rem.priority === "high" && (
                        <span className="ml-auto flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-500/20" title="High Priority" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ReminderModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialCategory={modalCategory}
      />
    </div>
  );
}
