import { useState, useMemo, useEffect } from "react";
import {
  Bell,
  CheckSquare,
  UsersThree,
  Plus,
  Trash,
  Clock,
  CalendarDots,
  Link,
  CheckCircle,
  Circle,
  Tag,
  VideoCamera,
  CaretDown,
  Globe,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  useReminders,
  useCreateReminder,
  useDeleteReminder,
  useToggleReminderCompleted,
  useCandidatesWithJob,
  useJobs,
} from "../../hooks/useQueries";
import { playCompletionChime } from "../../lib/notificationSound";
import { cn, titleCase } from "../../lib/utils";
import {
  RECRUITER_TIMEZONES,
  toUtcIsoString,
  getLocalLaptopTimePreview,
  getTimezoneShort,
} from "../../lib/timezoneUtils";
import type { ReminderCategory, ReminderPriority } from "../../types";

const NOTIFY_BEFORE_OPTIONS = [
  { value: 0, label: "At time of event" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

export function ReminderModal({
  open,
  onOpenChange,
  initialCategory = "reminder",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory?: ReminderCategory;
}) {
  const [activeTab, setActiveTab] = useState<ReminderCategory>(initialCategory);
  const [viewScope, setViewScope] = useState<"create" | "list">("create");
  const [statusFilter, setStatusFilter] = useState<"pending" | "completed" | "all">("pending");
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Sync initial category when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab(initialCategory);
      if (initialCategory === "meeting") {
        setShowMoreOptions(true);
      } else {
        setShowMoreOptions(false);
      }
    }
  }, [open, initialCategory]);

  const handleCategoryChange = (cat: ReminderCategory) => {
    setActiveTab(cat);
    if (cat === "meeting") {
      setShowMoreOptions(true);
    } else {
      setShowMoreOptions(false);
    }
  };

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York"); // Default EDT/EST for US recruiting
  const [priority, setPriority] = useState<ReminderPriority>("medium");
  const [notifyBefore, setNotifyBefore] = useState(0);
  const [candidateId, setCandidateId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [meetingLink, setMeetingLink] = useState("");

  const { data: reminders, isLoading } = useReminders();
  const { data: candidates } = useCandidatesWithJob();
  const { data: jobs } = useJobs();

  const createReminder = useCreateReminder();
  const deleteReminder = useDeleteReminder();
  const toggleCompleted = useToggleReminderCompleted();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate(new Date().toISOString().split("T")[0]);
    setDueTime("");
    setPriority("medium");
    setNotifyBefore(0);
    setCandidateId("");
    setJobId("");
    setMeetingLink("");
    setShowMoreOptions(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      // Calculate exact UTC timestamp based on user's chosen timezone
      const remindIso = toUtcIsoString(dueDate, dueTime, timezone);

      await createReminder.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        category: activeTab,
        due_date: dueDate,
        due_time: dueTime || null,
        timezone,
        remind_at: remindIso,
        priority,
        notify_before_minutes: notifyBefore,
        candidate_id: candidateId || null,
        job_id: jobId || null,
        meeting_link: meetingLink.trim() || null,
      });

      toast.success(`${titleCase(activeTab)} created successfully`);
      resetForm();
      setViewScope("list");
    } catch {
      toast.error("Failed to create reminder");
    }
  };

  const filteredReminders = useMemo(() => {
    if (!reminders) return [];
    return reminders.filter((r) => {
      const matchCategory = r.category === activeTab;
      const matchStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "completed"
            ? r.status === "completed"
            : r.status === "pending" || r.status === "snoozed";
      return matchCategory && matchStatus;
    });
  }, [reminders, activeTab, statusFilter]);

  // Live Local Indian Time / Local Clock conversion preview string
  const localPreview = useMemo(() => {
    if (!dueDate) return "";
    return getLocalLaptopTimePreview(dueDate, dueTime, timezone);
  }, [dueDate, dueTime, timezone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0 border-border bg-surface shadow-2xl">
        {/* Modal Header: pr-10 gives ample breathing room so the close button never overlaps */}
        <div className="border-b border-border/80 bg-surface px-6 pt-5 pb-4 shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-base font-bold text-fg flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {activeTab === "reminder" && <Bell className="h-4 w-4" />}
                {activeTab === "task" && <CheckSquare className="h-4 w-4" />}
                {activeTab === "meeting" && <UsersThree className="h-4 w-4" />}
              </span>
              <span>{titleCase(activeTab)}s &amp; Notifications</span>
            </DialogTitle>

            {/* View Mode: New vs List */}
            <div className="flex items-center rounded-lg bg-surface-hover/70 p-0.5 border border-border/60">
              <button
                type="button"
                onClick={() => setViewScope("create")}
                className={cn(
                  "rounded-md px-3 py-1 text-[11.5px] font-semibold transition-all cursor-pointer",
                  viewScope === "create"
                    ? "bg-surface text-fg shadow-2xs font-bold"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                + New
              </button>
              <button
                type="button"
                onClick={() => setViewScope("list")}
                className={cn(
                  "rounded-md px-3 py-1 text-[11.5px] font-semibold transition-all cursor-pointer",
                  viewScope === "list"
                    ? "bg-surface text-fg shadow-2xs font-bold"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                List ({filteredReminders.length})
              </button>
            </div>
          </div>

          {/* 3 Main Tabs: Reminders, Tasks, Meetings */}
          <div className="mt-3.5 flex items-center rounded-lg bg-surface-active p-1 gap-1">
            <button
              type="button"
              onClick={() => handleCategoryChange("reminder")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "reminder"
                  ? "bg-surface text-fg shadow-2xs font-bold"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              <span>Reminder</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange("task")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "task"
                  ? "bg-surface text-fg shadow-2xs font-bold"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
              <span>Task</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange("meeting")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "meeting"
                  ? "bg-surface text-fg shadow-2xs font-bold"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <UsersThree className="h-3.5 w-3.5 text-blue-500" />
              <span>Meeting</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {viewScope === "create" ? (
            <form onSubmit={handleCreate} className="space-y-3.5">
              {/* Title Field (Always Visible) */}
              <div>
                <Label htmlFor="rem-title" className="text-xs font-semibold text-fg">
                  {activeTab === "meeting"
                    ? "Meeting Title *"
                    : activeTab === "task"
                      ? "Task Title *"
                      : "Reminder Title *"}
                </Label>
                <Input
                  id="rem-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    activeTab === "meeting"
                      ? "e.g., Candidate Pre-Screen / Client Intake Call"
                      : activeTab === "task"
                        ? "e.g., Update boolean strings for Senior React role"
                        : "e.g., Follow up with recruiter on client feedback"
                  }
                  className="mt-1 h-8.5 text-xs"
                  autoFocus
                  required
                />
              </div>

              {/* Notes Field (Always Visible) */}
              <div>
                <Label htmlFor="rem-desc" className="text-xs font-semibold text-fg">
                  Notes / Agenda (Optional)
                </Label>
                <textarea
                  id="rem-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional notes, candidate details, or agenda..."
                  className="mt-1 flex min-h-[56px] w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  rows={2}
                />
              </div>

              {/* Date & Time Grid (Always Visible) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="rem-date" className="text-xs font-semibold text-fg flex items-center gap-1">
                    <CalendarDots className="h-3.5 w-3.5 text-fg-subtle" />
                    Due Date *
                  </Label>
                  <Input
                    id="rem-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="rem-time" className="text-xs font-semibold text-fg flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-fg-subtle" />
                    Due Time (Optional)
                  </Label>
                  <Input
                    id="rem-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              {/* Timezone & Alert When Grid (Always Visible) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-fg flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-fg-subtle" />
                    Timezone *
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECRUITER_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-fg flex items-center gap-1">
                    <Bell className="h-3.5 w-3.5 text-fg-subtle" />
                    Alert When?
                  </Label>
                  <Select
                    value={notifyBefore.toString()}
                    onValueChange={(v) => setNotifyBefore(Number(v))}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Alert time" />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFY_BEFORE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live Local Laptop Time Conversion Banner */}
              {localPreview && (
                <div className="flex items-center gap-2 rounded-lg bg-surface-active/80 px-3 py-1.5 border border-border/80 text-[11px] text-fg-muted select-none">
                  <span className="font-semibold text-primary shrink-0">🕒 Local Alarm Time:</span>
                  <span className="font-medium text-fg">{localPreview}</span>
                </div>
              )}

              {/* Collapsible "More Options" Accordion with Ultra-Smooth Animation */}
              <div className="rounded-lg border border-border/70 bg-surface/50 overflow-hidden transition-colors duration-200">
                <button
                  type="button"
                  onClick={() => setShowMoreOptions((prev) => !prev)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-fg-muted hover:text-fg hover:bg-surface-hover/70 transition-colors cursor-pointer select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-fg-subtle" />
                    <span>More Options</span>
                    {(candidateId || jobId || meetingLink || priority !== "medium") && (
                      <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                        Configured
                      </span>
                    )}
                  </span>
                  <CaretDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      showMoreOptions ? "rotate-180" : "rotate-0",
                    )}
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    showMoreOptions
                      ? "grid-rows-[1fr] opacity-100 border-t border-border/50"
                      : "grid-rows-[0fr] opacity-0 pointer-events-none border-t-0",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="p-3.5 space-y-3">
                      {/* Priority & Meeting Link */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-fg flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5 text-fg-subtle" />
                            Priority
                          </Label>
                          <div className="mt-1 flex items-center gap-1.5">
                            {(["low", "medium", "high"] as const).map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setPriority(p)}
                                className={cn(
                                  "flex-1 rounded-md border py-1 text-center text-xs font-semibold capitalize transition-all cursor-pointer",
                                  priority === p
                                    ? p === "high"
                                      ? "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300 font-bold"
                                      : p === "medium"
                                        ? "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold"
                                        : "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                                    : "border-border text-fg-muted hover:bg-surface-hover",
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="rem-link" className="text-xs font-semibold text-fg flex items-center gap-1">
                            <VideoCamera className="h-3.5 w-3.5 text-fg-subtle" />
                            Meeting / Call Link
                          </Label>
                          <Input
                            id="rem-link"
                            value={meetingLink}
                            onChange={(e) => setMeetingLink(e.target.value)}
                            placeholder="https://meet.google.com/..."
                            className="mt-1 h-8 text-xs"
                          />
                        </div>
                      </div>

                      {/* Context Links */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                        <div>
                          <Label className="text-[11px] text-fg-muted flex items-center gap-1">
                            <Link className="h-3 w-3" /> Link Candidate
                          </Label>
                          <Select value={candidateId || "none"} onValueChange={(v) => setCandidateId(v === "none" ? "" : v)}>
                            <SelectTrigger className="mt-1 h-7.5 text-xs bg-surface">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {candidates?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name} ({c.job_title})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[11px] text-fg-muted flex items-center gap-1">
                            <Link className="h-3 w-3" /> Link Job
                          </Label>
                          <Select value={jobId || "none"} onValueChange={(v) => setJobId(v === "none" ? "" : v)}>
                            <SelectTrigger className="mt-1 h-7.5 text-xs bg-surface">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {jobs?.map((j) => (
                                <SelectItem key={j.id} value={j.id}>
                                  {j.title} ({j.client_name})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createReminder.isPending}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save {titleCase(activeTab)}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {/* List Filter Tabs */}
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-1.5">
                  {(["pending", "completed", "all"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors cursor-pointer",
                        statusFilter === st
                          ? "bg-surface-active text-fg font-bold"
                          : "text-fg-subtle hover:text-fg",
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-fg-subtle">
                  {filteredReminders.length} item{filteredReminders.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Reminders List */}
              {isLoading ? (
                <div className="py-12 text-center text-xs text-fg-muted">Loading items…</div>
              ) : filteredReminders.length === 0 ? (
                <div className="py-12 text-center text-xs text-fg-muted">
                  No {statusFilter} {activeTab}s found.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredReminders.map((rem) => {
                    const tzShort = getTimezoneShort(rem.timezone);
                    const timeText = rem.due_time ? `${rem.due_time} ${tzShort}` : rem.due_date;

                    return (
                      <div
                        key={rem.id}
                        className={cn(
                          "group flex items-start gap-3 rounded-lg border p-3 transition-all",
                          rem.status === "completed"
                            ? "border-border/50 bg-surface/40 opacity-60"
                            : "border-border bg-surface hover:border-primary/40 shadow-2xs",
                        )}
                      >
                        {/* Checkbox Toggle */}
                        <button
                          type="button"
                          onClick={async () => {
                            await toggleCompleted.mutateAsync(rem.id);
                            if (rem.status !== "completed") {
                              playCompletionChime();
                              toast.success(`Completed: ${rem.title}`);
                            }
                          }}
                          className="mt-0.5 text-fg-subtle hover:text-primary transition-colors cursor-pointer shrink-0"
                        >
                          {rem.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="h-4 w-4 text-fg-subtle hover:text-primary" />
                          )}
                        </button>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[13px] font-bold text-fg leading-snug",
                                rem.status === "completed" && "line-through text-fg-muted",
                              )}
                            >
                              {rem.title}
                            </span>
                            {rem.priority === "high" && (
                              <span className="rounded bg-red-500/15 px-1.5 py-0.2 text-[9px] font-bold uppercase text-red-600 dark:text-red-400">
                                High
                              </span>
                            )}
                          </div>

                          {rem.description && (
                            <p className="mt-0.5 text-xs text-fg-muted line-clamp-1">{rem.description}</p>
                          )}

                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
                            <span className="inline-flex items-center gap-1 font-semibold text-fg-muted">
                              <CalendarDots className="h-3 w-3 text-fg-subtle" />
                              {rem.due_date} • {timeText}
                            </span>

                            {(rem.candidate_name || rem.job_title) && (
                              <span className="text-fg-muted truncate">
                                • {[rem.candidate_name, rem.job_title].filter(Boolean).join(" · ")}
                              </span>
                            )}

                            {rem.meeting_link && (
                              <a
                                href={rem.meeting_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline font-semibold"
                              >
                                Open Meeting Link ↗
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteReminder.mutateAsync(rem.id);
                            toast.success("Item deleted");
                          }}
                          className="text-fg-subtle hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Delete"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
