import React, { useState } from "react";
import { Check, X, CircleNotch, ArrowRight, CalendarBlank, UserPlus, Briefcase } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { AiProposedAction } from "../../types";
import { apiCandidates, apiReminders } from "../../lib/api";
import { useChatStore } from "../../store/chatStore";
import { useJobs } from "../../hooks/useQueries";
import { toUtcIsoString } from "../../lib/timezoneUtils";

interface Props {
  action: AiProposedAction;
  messageId: string;
}

export function AiActionCard({ action, messageId }: Props) {
  const queryClient = useQueryClient();
  const updateMessageAction = useChatStore((s) => s.updateMessageAction);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const { data: jobs } = useJobs();
  const activeJobs = jobs?.filter((j) => j.status === "active") ?? [];

  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(action.payload_json);
  } catch {
    payload = {};
  }

  // Pre-select first active job if needed
  React.useEffect(() => {
    if (activeJobs.length > 0 && !selectedJobId && payload.job_id) {
      setSelectedJobId(payload.job_id);
    } else if (activeJobs.length > 0 && !selectedJobId) {
      setSelectedJobId(activeJobs[0].id);
    }
  }, [activeJobs, selectedJobId, payload.job_id]);

  const isPending = !action.status || action.status === "pending";
  const isCompleted = action.status === "completed";
  const isCancelled = action.status === "cancelled";

  async function handleConfirm() {
    setIsExecuting(true);
    updateMessageAction(messageId, { status: "executing" });

    try {
      if (action.action_type === "update_candidate_status") {
        const { candidate_id, to_status, candidate_name } = payload;
        await apiCandidates.bulkUpdate([candidate_id], {
          submission_status: to_status,
          candidate_status: "active",
        });

        await queryClient.invalidateQueries({ queryKey: ["candidates"] });
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

        toast.success(`Updated ${candidate_name} to ${to_status} stage`);
        updateMessageAction(messageId, {
          status: "completed",
          result_message: `Successfully moved **${candidate_name}** to **${to_status}** stage in your database.`,
        });
      } else if (action.action_type === "create_reminder") {
        const { title, due_date, due_time, priority, category, candidate_id } = payload;
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const exactUtcRemindAt = toUtcIsoString(due_date, due_time, localTz);
        await apiReminders.create({
          title,
          due_date,
          due_time: due_time || null,
          timezone: localTz,
          priority: priority || "high",
          category: category || "reminder",
          candidate_id: candidate_id || null,
          remind_at: exactUtcRemindAt,
        });

        await queryClient.invalidateQueries({ queryKey: ["reminders"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

        toast.success(`Created reminder: ${title}`);
        updateMessageAction(messageId, {
          status: "completed",
          result_message: `Saved reminder **"${title}"** for **${due_date} at ${due_time || "09:00"}**.`,
        });
      } else if (action.action_type === "create_candidate") {
        const { name, email, phone, current_role, experience_years, location, linkedin_url, skills } = payload;
        const targetJobId = selectedJobId || (activeJobs[0] ? activeJobs[0].id : "");

        if (!targetJobId) {
          toast.error("Please select a job requisition to assign this candidate");
          setIsExecuting(false);
          updateMessageAction(messageId, { status: "pending" });
          return;
        }

        await apiCandidates.create({
          job_id: targetJobId,
          name: name || "New Candidate",
          email: email || null,
          phone: phone || null,
          current_title: current_role || null,
          experience_years: experience_years ? Math.round(Number(experience_years)) : null,
          location: location || null,
          linkedin_url: linkedin_url || null,
          recruiter_notes: skills && skills.length > 0 ? `Skills: ${skills.join(", ")}` : null,
          submission_status: "sourced",
          candidate_status: "active",
        });

        await queryClient.invalidateQueries({ queryKey: ["candidates"] });
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

        toast.success(`Added candidate ${name} to database`);
        updateMessageAction(messageId, {
          status: "completed",
          result_message: `Candidate **${name}** was successfully added to your database under **${activeJobs.find((j) => j.id === targetJobId)?.title || "Job"}**.`,
        });
      }
    } catch (err: any) {
      toast.error(`Action failed: ${err?.message || String(err)}`);
      updateMessageAction(messageId, {
        status: "failed",
        result_message: `Action encountered an error: ${err?.message || String(err)}`,
      });
    } finally {
      setIsExecuting(false);
    }
  }

  function handleCancel() {
    updateMessageAction(messageId, {
      status: "cancelled",
      result_message: "Action was cancelled.",
    });
    toast.info("Action cancelled");
  }

  if (isCompleted) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
        <div className="flex items-center gap-2 font-medium">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3 w-3" />
          </div>
          <span>{action.result_message || "Action executed successfully."}</span>
        </div>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs text-fg-subtle">
        <div className="flex items-center gap-1.5 font-medium">
          <X className="h-3.5 w-3.5 text-fg-muted" />
          <span>Action was cancelled.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-primary/30 bg-surface p-4 shadow-sm">
      {/* Action Header Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {action.action_type === "update_candidate_status" && <ArrowRight className="h-3.5 w-3.5" />}
            {action.action_type === "create_reminder" && <CalendarBlank className="h-3.5 w-3.5" />}
            {action.action_type === "create_candidate" && <UserPlus className="h-3.5 w-3.5" />}
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {action.action_type === "update_candidate_status" && "Pipeline Stage Update"}
            {action.action_type === "create_reminder" && "New Reminder Proposal"}
            {action.action_type === "create_candidate" && "Add Candidate Proposal"}
          </span>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
          Requires Confirmation
        </span>
      </div>

      {/* Action Details Body */}
      <div className="py-3 text-xs text-fg space-y-2">
        <p className="font-semibold text-[13px]">{action.title}</p>
        <p className="text-fg-subtle">{action.description}</p>

        {/* Candidate creation: Job dropdown */}
        {action.action_type === "create_candidate" && (
          <div className="mt-2.5 space-y-1.5 pt-2 border-t border-border/50">
            <label className="text-[11px] font-semibold text-fg-subtle flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              Assign to Job Requisition:
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg focus:border-primary focus:outline-none"
            >
              {activeJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.client_name} — Req: {j.job_id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Action Confirmation Buttons */}
      {isPending && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
          <button
            onClick={handleConfirm}
            disabled={isExecuting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Confirm & Execute</span>
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={isExecuting}
            className="flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-subtle hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      )}
    </div>
  );
}
