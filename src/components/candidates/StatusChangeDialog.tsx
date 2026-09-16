import { useState } from "react";
import { CalendarDots, FileText, Flag, CheckCircle, Building } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useBulkUpdateCandidates } from "../../hooks/useQueries";
import { SUBMISSION_STATUSES, submissionPalette } from "../../lib/constants";
import { errorMessage, titleCase } from "../../lib/utils";
import { Spinner } from "../common/Spinner";
import { SubmittedDatePicker } from "./SubmittedDatePicker";
import { InterviewSchedulePicker } from "./InterviewSchedulePicker";
import { PlacedDatePicker } from "./PlacedDatePicker";
import { BackwardStatusConfirmDialog } from "./BackwardStatusConfirmDialog";
import { ResetStatusConfirmDialog } from "./ResetStatusConfirmDialog";
import { isBackwardTransition, parseRejectionDetail, serializeRejectionDetail } from "../../lib/candidateUtils";
import type { CandidatePatch, CandidateWithJob, RejectionDetail } from "../../types";

interface Props {
  candidate: CandidateWithJob;
  initialStatus: string;
  onClose: () => void;
}

export function StatusChangeDialog({ candidate, initialStatus, onClose }: Props) {
  const bulkUpdate = useBulkUpdateCandidates();
  const [status, setStatus] = useState(initialStatus);
  const [submittedAt, setSubmittedAt] = useState<string | null>(candidate.submitted_at ?? null);
  const [interviewAt, setInterviewAt] = useState<string | null>(candidate.interview_at ?? null);
  const [placedAt, setPlacedAt] = useState<string | null>(candidate.placed_at ?? null);
  const [rejectionReason, setRejectionReason] = useState(candidate.rejection_reason ?? "");
  const [showBackwardConfirm, setShowBackwardConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const saving = bulkUpdate.isPending;

  async function executeSave(patch: CandidatePatch) {
    try {
      await bulkUpdate.mutateAsync({ ids: [candidate.id], patch });
      toast.success(`${candidate.name} marked ${titleCase(patch.submission_status || status)}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function handleSave() {
    if (status === candidate.submission_status) {
      onClose();
      return;
    }

    if (isBackwardTransition(candidate.submission_status, status)) {
      setShowBackwardConfirm(true);
      return;
    }

    if (status === "sourced") {
      setShowResetConfirm(true);
      return;
    }

    const patch: CandidatePatch = { submission_status: status };
    if (status === "submitted") {
      patch.submitted_at = submittedAt || new Date().toISOString();
      patch.client_feedback = candidate.client_feedback || "internal";
    } else if (status === "interview") {
      patch.interview_at = interviewAt || new Date().toISOString();
      patch.client_feedback = "client";
      patch.submitted_at = candidate.submitted_at || submittedAt || new Date().toISOString();
    } else if (status === "placed") {
      patch.placed_at = placedAt || new Date().toISOString();
      patch.client_feedback = "client";
      patch.submitted_at = candidate.submitted_at || submittedAt || new Date().toISOString();
    }
    if (status === "rejected") {
      const existing = parseRejectionDetail(candidate.rejection_reason);
      const origin =
        candidate.submission_status === "interview"
          ? "interview"
          : candidate.submission_status === "submitted"
            ? (candidate.client_feedback === "internal" ? "internal" : "client_screening")
            : existing.origin || "general";

      const detail: RejectionDetail = {
        ...existing,
        origin,
        reason: rejectionReason.trim() || existing.reason || null,
        rejected_at: existing.rejected_at || new Date().toISOString(),
      };
      patch.rejection_reason = serializeRejectionDetail(detail);
    }

    executeSave(patch);
  }

  function handleConfirmBackward(preserveMilestones: boolean) {
    setShowBackwardConfirm(false);
    const patch: CandidatePatch = { submission_status: status };
    if (!preserveMilestones) {
      if (status === "sourced" || status === "in_touch") {
        patch.submitted_at = null;
        patch.interview_at = null;
        patch.placed_at = null;
        patch.rejection_reason = null;
      }
    }
    executeSave(patch);
  }

  function handleConfirmReset() {
    setShowResetConfirm(false);
    const patch: CandidatePatch = {
      submission_status: "sourced",
      submitted_at: null,
      interview_at: null,
      placed_at: null,
      rejection_reason: null,
    };
    executeSave(patch);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update status</DialogTitle>
          <DialogDescription>{candidate.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Status</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {SUBMISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </div>

          {status === "submitted" && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <CalendarDots className="h-3 w-3" />
                Submitted date
              </p>
              <SubmittedDatePicker value={submittedAt} onChange={setSubmittedAt} />
            </div>
          )}

          {status === "interview" && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <CalendarDots className="h-3 w-3" />
                Interview date & time
              </p>
              <InterviewSchedulePicker value={interviewAt} onChange={setInterviewAt} />
            </div>
          )}

          {status === "placed" && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  Selection date
                </p>
                <PlacedDatePicker value={placedAt} onChange={setPlacedAt} />
              </div>

              {candidate.client_name && (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300">
                  <Building className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Associated Client: <strong className="font-semibold">{candidate.client_name}</strong></span>
                </div>
              )}
            </div>
          )}

          {status === "rejected" && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <Flag className="h-3 w-3" />
                Rejection reason (optional)
              </p>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection…"
                className="h-8 text-[13px]"
              />
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg bg-surface-hover/60 px-3 py-2 text-[12px] text-fg-muted">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: submissionPalette(status).dot }}
            />
            <FileText className="h-3.5 w-3.5 shrink-0" />
            Will set {candidate.name} to {titleCase(status)}.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : "Save"}
          </Button>
        </DialogFooter>

        <BackwardStatusConfirmDialog
          open={showBackwardConfirm}
          candidateName={candidate.name}
          currentStatus={candidate.submission_status}
          targetStatus={status}
          onConfirm={handleConfirmBackward}
          onCancel={() => setShowBackwardConfirm(false)}
        />

        <ResetStatusConfirmDialog
          open={showResetConfirm}
          candidateName={candidate.name}
          onConfirm={handleConfirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      </DialogContent>
    </Dialog>
  );
}