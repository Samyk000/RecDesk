import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  Briefcase,
  Building,
  CalendarDots,
  Check,
  Copy,
  IdentificationCard,
  LinkedinLogo,
  ListChecks,
  CircleNotch,
  Paperclip,
  PencilSimple,
  PhoneCall,
  Sparkle,
  Trash,
  X,
} from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAttachResume,
  useCandidate,
  useClient,
  useDeleteCandidate,
  useJob,
  useRemoveResume,
  useRenameResume,
  useUpdateCandidate,
} from "../../hooks/useQueries";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { RichTextEditor } from "../common/RichTextEditor";
import { SubmissionStatusSelect } from "./SubmissionStatusSelect";
import { SubmittedDatePicker } from "./SubmittedDatePicker";
import { InterviewSchedulePicker } from "./InterviewSchedulePicker";
import { PlacedDatePicker } from "./PlacedDatePicker";
import { ScreeningQADialog } from "./ScreeningQADialog";
import { SubmissionDetailsDialog } from "./SubmissionDetailsDialog";
import {
  InterviewFeedbackDialog,
  hasInterviewFeedback,
} from "./InterviewFeedbackDialog";
import { ResumePreviewModal } from "./ResumePreviewModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { errorMessage, formatDateAbbr, nameInitials, titleCase, cn } from "../../lib/utils";
import { toCandidateInput, syncCandidateFieldsToSubmissionDetails } from "../../lib/candidateUtils";
import { Spinner } from "../common/Spinner";
import type { Candidate, CandidateInput, CandidateWithJob } from "../../types";

interface Props {
  candidateId: string;
  onClose: () => void;
  embedded?: boolean;
}

export function CandidateDetailPanel({ candidateId, onClose, embedded }: Props) {
  const { data: candidate, isLoading } = useCandidate(candidateId);
  if (isLoading || !candidate) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <CandidatePanelBody key={candidate.id} candidate={candidate} onClose={onClose} embedded={embedded} />;
}

function CandidatePanelBody({
  candidate,
  onClose,
  embedded,
}: {
  candidate: Candidate;
  onClose: () => void;
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const attachResumeMut = useAttachResume();
  const removeResumeMut = useRemoveResume();
  const renameResumeMut = useRenameResume();
  const { data: job } = useJob(candidate.job_id);
  const { data: client } = useClient(job?.client_id);
  const clientName = client?.name || (candidate as CandidateWithJob).client_name || "";
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScreeningQA, setShowScreeningQA] = useState(false);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const [showInterviewFeedback, setShowInterviewFeedback] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [isRenamingResume, setIsRenamingResume] = useState(false);
  const [resumeNewName, setResumeNewName] = useState("");
  const [previousStatusSnapshot, setPreviousStatusSnapshot] = useState<{
    submission_status: string;
    submitted_at: string | null;
    interview_at: string | null;
    placed_at: string | null;
    rejection_reason: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Show "Details" icon once moved to in_touch or if details have been recorded
  const hasSubmissionDetails = Boolean(
    candidate.submission_details && candidate.submission_details !== "{}"
  );
  const showDetailsIcon = candidate.submission_status !== "sourced" || hasSubmissionDetails;

  // Show "Feedback Call" icon when on interview status OR if feedback was recorded
  const hasFeedbackRecorded = hasInterviewFeedback(candidate);
  const showFeedbackIcon = candidate.submission_status === "interview" || hasFeedbackRecorded;

  async function saveField(patch: Partial<CandidateInput>) {
    if (patch.submission_status && patch.submission_status !== candidate.submission_status) {
      setPreviousStatusSnapshot({
        submission_status: candidate.submission_status,
        submitted_at: candidate.submitted_at ?? null,
        interview_at: candidate.interview_at ?? null,
        placed_at: candidate.placed_at ?? null,
        rejection_reason: candidate.rejection_reason ?? null,
      });
    }

    // Two-way sync: if editing core profile fields, synchronize existing submission_details rows as well
    let syncedSubmissionDetails = patch.submission_details;
    if (
      syncedSubmissionDetails === undefined &&
      (patch.name !== undefined ||
        patch.email !== undefined ||
        patch.phone !== undefined ||
        patch.location !== undefined ||
        patch.linkedin_url !== undefined)
    ) {
      const updatedDetails = syncCandidateFieldsToSubmissionDetails(
        candidate.submission_details,
        patch,
      );
      if (updatedDetails && updatedDetails !== candidate.submission_details) {
        syncedSubmissionDetails = updatedDetails;
      }
    }

    const fullPatch: Partial<CandidateInput> = {
      ...patch,
      ...(syncedSubmissionDetails !== undefined ? { submission_details: syncedSubmissionDetails } : {}),
    };

    setSaving(true);
    try {
      await update.mutateAsync({
        id: candidate.id,
        input: toCandidateInput(candidate, fullPatch),
      });
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function resetToSourced() {
    setPreviousStatusSnapshot({
      submission_status: candidate.submission_status,
      submitted_at: candidate.submitted_at ?? null,
      interview_at: candidate.interview_at ?? null,
      placed_at: candidate.placed_at ?? null,
      rejection_reason: candidate.rejection_reason ?? null,
    });

    setSaving(true);
    try {
      await update.mutateAsync({
        id: candidate.id,
        input: toCandidateInput(candidate, {
          submission_status: "sourced",
          submitted_at: null,
          interview_at: null,
          placed_at: null,
          rejection_reason: null,
        }),
      });
      toast.success("Reset status to Sourced");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreStatus() {
    if (!previousStatusSnapshot) return;
    const toRestore = previousStatusSnapshot;
    setPreviousStatusSnapshot({
      submission_status: candidate.submission_status,
      submitted_at: candidate.submitted_at ?? null,
      interview_at: candidate.interview_at ?? null,
      placed_at: candidate.placed_at ?? null,
      rejection_reason: candidate.rejection_reason ?? null,
    });

    setSaving(true);
    try {
      await update.mutateAsync({
        id: candidate.id,
        input: toCandidateInput(candidate, {
          submission_status: toRestore.submission_status,
          submitted_at: toRestore.submitted_at,
          interview_at: toRestore.interview_at,
          placed_at: toRestore.placed_at,
          rejection_reason: toRestore.rejection_reason,
        }),
      });
      toast.success(`Restored status to ${titleCase(toRestore.submission_status)}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function attachResume() {
    const file = await openDialog({
      multiple: false,
      filters: [{ name: "Resume", extensions: ["pdf", "doc", "docx", "txt"] }],
    });
    if (!file || typeof file !== "string") return;
    try {
      await attachResumeMut.mutateAsync({ id: candidate.id, sourcePath: file });
      toast.success("Resume attached");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function removeResume() {
    try {
      await removeResumeMut.mutateAsync(candidate.id);
      toast.success("Resume reference removed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function startRenameResume() {
    if (!candidate.resume_path) return;
    const currentName = candidate.resume_path.split(/[\\/]/).pop() ?? "";
    const baseName = currentName.replace(/\.[^/.]+$/, "");
    setResumeNewName(baseName || currentName);
    setIsRenamingResume(true);
  }

  async function handleConfirmRename() {
    const trimmed = resumeNewName.trim();
    if (!trimmed) {
      setIsRenamingResume(false);
      return;
    }
    try {
      await renameResumeMut.mutateAsync({
        id: candidate.id,
        newFilename: trimmed,
      });
      setIsRenamingResume(false);
      toast.success("Resume renamed successfully");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleAutoRenameToCandidate() {
    if (!candidate.resume_path) return;
    const candName = candidate.name.trim();
    if (!candName) {
      toast.error("Candidate does not have a valid name");
      return;
    }
    const formatted = `${candName} - Resume`;
    try {
      await renameResumeMut.mutateAsync({
        id: candidate.id,
        newFilename: formatted,
      });
      toast.success(`Resume renamed to "${formatted}"`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function openResume() {
    if (!candidate.resume_path) return;
    setShowResumePreview(true);
  }

  function linkedInUrl() {
    const raw = candidate.linkedin_url ?? "";
    return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  }

  async function openLinkedIn() {
    try {
      await openUrl(linkedInUrl());
    } catch {
      toast.error("Could not open link");
    }
  }

  async function copyLinkedIn() {
    try {
      await navigator.clipboard.writeText(linkedInUrl());
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function handleDelete() {
    try {
      await deleteCandidate.mutateAsync(candidate.id);
      toast.success("Candidate deleted");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const initials = nameInitials(candidate.name);

  const status = candidate.submission_status;
  const resumeName = candidate.resume_path?.split(/[\\/]/).pop() ?? "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
            <CalendarDots className="h-3 w-3" />
            ADDED ON {formatDateAbbr(candidate.date_added)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showFeedbackIcon && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 hover:bg-primary/10",
                    hasFeedbackRecorded
                      ? "text-primary font-semibold"
                      : "text-fg-subtle hover:text-primary",
                  )}
                  onClick={() => setShowInterviewFeedback(true)}
                  aria-label="Interview Feedback Call"
                >
                  <PhoneCall className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Interview Feedback Call</TooltipContent>
            </Tooltip>
          )}
          {showDetailsIcon && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                  onClick={() => setShowSubmissionDetails(true)}
                  aria-label="Candidate Details"
                >
                  <IdentificationCard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Candidate Details</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-primary hover:bg-primary/10"
                onClick={() => setShowScreeningQA(true)}
              >
                <ListChecks className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Screening Q&A</TooltipContent>
          </Tooltip>
          {!embedded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => navigate(`/jobs/${candidate.job_id}`)}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View job</TooltipContent>
            </Tooltip>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" className="text-xs" onClick={handleDelete}>
                Confirm
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {saving && (
          <div className="absolute right-4 top-16 flex items-center gap-1 text-[11px] text-fg-subtle">
            <CircleNotch className="h-3 w-3 animate-spin" /> Saving…
          </div>
        )}

        {/* Row 1: Name, Title */}
        <div className="grid grid-cols-2 gap-3">
          <NameField value={candidate.name} onSave={(v) => saveField({ name: v })} />
          <InlineField
            label="Title"
            value={candidate.current_title ?? ""}
            onSave={(v) => saveField({ current_title: v || null })}
          />
        </div>

        {/* Row 2: Email, Phone */}
        <div className="grid grid-cols-2 gap-3">
          <InlineField
            label="Email"
            value={candidate.email ?? ""}
            onSave={(v) => saveField({ email: v || null })}
          />
          <InlineField
            label="Phone"
            value={candidate.phone ?? ""}
            onSave={(v) => saveField({ phone: v || null })}
          />
        </div>

        {/* Row 3: Location, LinkedIn */}
        <div className="grid grid-cols-2 gap-3">
          <InlineField
            label="Location"
            value={candidate.location ?? ""}
            onSave={(v) => saveField({ location: v || null })}
          />
          <LinkedInField
            value={candidate.linkedin_url ?? ""}
            onSave={(v) => saveField({ linkedin_url: v || null })}
            onOpen={openLinkedIn}
            onCopy={copyLinkedIn}
          />
        </div>

        {/* Row 4: Resume, Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs text-fg-subtle">Resume</p>
            {candidate.resume_path ? (
              isRenamingResume ? (
                <div className="flex h-8 items-center gap-1 rounded-lg border border-primary/50 bg-surface px-1.5 shadow-xs">
                  <input
                    value={resumeNewName}
                    onChange={(e) => setResumeNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmRename();
                      if (e.key === "Escape") setIsRenamingResume(false);
                    }}
                    autoFocus
                    placeholder="Resume filename…"
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmRename}
                    disabled={renameResumeMut.isPending}
                    title="Save filename (Enter)"
                    className="shrink-0 rounded p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenamingResume(false)}
                    title="Cancel (Esc)"
                    className="shrink-0 rounded p-1 text-fg-subtle hover:bg-surface-hover transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-hover px-2">
                  <button
                    type="button"
                    onClick={openResume}
                    className="min-w-0 flex-1 truncate text-left text-[12px] text-fg hover:text-primary transition-colors cursor-pointer"
                    title={`Preview ${resumeName}`}
                  >
                    {resumeName}
                  </button>

                  {/* 1-Click Rename to Candidate Name */}
                  <button
                    type="button"
                    onClick={handleAutoRenameToCandidate}
                    disabled={renameResumeMut.isPending}
                    title={`1-Click Rename to "${candidate.name || "Candidate"} - Resume"`}
                    className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-primary"
                  >
                    <Sparkle className="h-3.5 w-3.5" />
                  </button>

                  {/* Inline Rename button */}
                  <button
                    type="button"
                    onClick={startRenameResume}
                    title="Rename resume file"
                    className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-primary"
                  >
                    <PencilSimple className="h-3.5 w-3.5" />
                  </button>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={removeResume}
                    title="Remove resume reference"
                    className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-red-500"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            ) : (
              <Button size="sm" variant="outline" onClick={attachResume} className="h-8 w-full text-[12px]">
                <Paperclip className="h-3.5 w-3.5" />
                Attach resume
              </Button>
            )}
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-fg-subtle">Status</p>
              <div className="flex items-center gap-1.5">
                {previousStatusSnapshot && previousStatusSnapshot.submission_status !== candidate.submission_status && (
                  <button
                    type="button"
                    onClick={handleRestoreStatus}
                    title={`Restore previous status: ${titleCase(previousStatusSnapshot.submission_status)}`}
                    className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10.5px] text-primary transition-colors hover:bg-primary/10"
                  >
                    <ArrowCounterClockwise className="h-3 w-3" />
                    <span>Restore</span>
                  </button>
                )}
                {status !== "sourced" && (
                  <button
                    type="button"
                    onClick={resetToSourced}
                    title="Clear status and reset to Sourced"
                    className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10.5px] text-fg-subtle transition-colors hover:bg-surface-hover hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
            <SubmissionStatusSelect
              value={status}
              triggerClassName="h-8 w-full text-xs"
              onValueChange={(v) => {
                if (v === "sourced") {
                  resetToSourced();
                } else {
                  const patch: Partial<CandidateInput> = { submission_status: v };
                  saveField(patch);
                }
              }}
            />
            {(status === "submitted" || status === "interview" || status === "placed" || status === "rejected") && (
              <div className="animate-[fade-up_0.25s_ease-out]">
                {status === "submitted" && (
                  <SubmittedDatePicker
                    value={candidate.submitted_at}
                    onChange={(val) => saveField({ submitted_at: val })}
                  />
                )}
                {status === "interview" && (
                  <InterviewSchedulePicker
                    value={candidate.interview_at}
                    onChange={(val) => saveField({ interview_at: val })}
                  />
                )}
                {status === "placed" && (
                  <div className="space-y-1.5">
                    <PlacedDatePicker
                      value={candidate.placed_at}
                      onChange={(val) => saveField({ placed_at: val })}
                    />
                    {clientName && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        <Building className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">Client: <strong className="font-semibold">{clientName}</strong></span>
                      </div>
                    )}
                  </div>
                )}
                {status === "rejected" && (
                  <Input
                    defaultValue={candidate.rejection_reason ?? ""}
                    placeholder="Rejection reason…"
                    className="h-8 w-full text-[13px]"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === (candidate.rejection_reason ?? "")) return;
                      saveField({ rejection_reason: v || null });
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="mt-2 space-y-1.5 border-t border-border pt-6">
          <p className="text-xs text-fg-subtle">Comments</p>
          <RichTextEditor
            value={candidate.recruiter_notes ?? ""}
            onChange={(html) => saveField({ recruiter_notes: html || null })}
            placeholder="Notes about this candidate…"
            minHeight={300}
          />
        </div>
      </div>

      <InterviewFeedbackDialog
        candidateId={candidate.id}
        open={showInterviewFeedback}
        onOpenChange={setShowInterviewFeedback}
      />

      <ScreeningQADialog
        candidateId={candidate.id}
        open={showScreeningQA}
        onOpenChange={setShowScreeningQA}
      />

      <SubmissionDetailsDialog
        candidateId={candidate.id}
        open={showSubmissionDetails}
        onOpenChange={setShowSubmissionDetails}
      />

      {candidate.resume_path && (
        <ResumePreviewModal
          open={showResumePreview}
          onClose={() => setShowResumePreview(false)}
          filePath={candidate.resume_path}
          candidateName={candidate.name}
          candidateId={candidate.id}
          onResumeUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["candidate", candidate.id] });
            queryClient.invalidateQueries({ queryKey: ["candidates"] });
          }}
        />
      )}
    </div>
  );
}

function InlineField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs text-fg-subtle">{label}</p>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 text-[13px]"
        onBlur={() => {
          const t = draft.trim();
          if (t === value) return;
          onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function LinkedInField({
  value,
  onSave,
  onOpen,
  onCopy,
}: {
  value: string;
  onSave: (v: string) => void;
  onOpen: () => void;
  onCopy: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs text-fg-subtle">LinkedIn</p>
      <div className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-hover px-2">
        <LinkedinLogo className="h-3.5 w-3.5 shrink-0 text-primary" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://linkedin.com/in/…"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
          onBlur={() => {
            const t = draft.trim();
            if (t === value) return;
            onSave(t);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {value ? (
          <>
            <button
              onClick={onOpen}
              title="Open link"
              className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onCopy}
              title="Copy link"
              className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function NameField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs text-fg-subtle">Name</p>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 text-[13px] font-medium"
        onBlur={() => {
          const t = draft.trim();
          if (!t || t === value) {
            setDraft(value);
            return;
          }
          onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}