import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowSquareOut,
  Briefcase,
  Building,
  CalendarDots,
  Copy,
  FileText,
  IdentificationCard,
  LinkedinLogo,
  ListChecks,
  CircleNotch,
  Paperclip,
  Trash,
  X,
} from "@phosphor-icons/react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  useAttachResume,
  useCandidate,
  useClient,
  useDeleteCandidate,
  useJob,
  useRemoveResume,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { errorMessage, formatDateAbbr, nameInitials } from "../../lib/utils";
import { toCandidateInput } from "../../lib/candidateUtils";
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
  const update = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const attachResumeMut = useAttachResume();
  const removeResumeMut = useRemoveResume();
  const { data: job } = useJob(candidate.job_id);
  const { data: client } = useClient(job?.client_id);
  const clientName = client?.name || (candidate as CandidateWithJob).client_name || "";
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScreeningQA, setShowScreeningQA] = useState(false);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  // Show "Details" icon once moved to in_touch or if details have been recorded
  const hasSubmissionDetails = Boolean(
    candidate.submission_details && candidate.submission_details !== "{}"
  );
  const showDetailsIcon = candidate.submission_status !== "sourced" || hasSubmissionDetails;

  async function saveField(patch: Partial<CandidateInput>) {
    setSaving(true);
    try {
      await update.mutateAsync({
        id: candidate.id,
        input: toCandidateInput(candidate, patch),
      });
      toast.success("Saved");
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

  async function openResume() {
    if (!candidate.resume_path) return;
    try {
      await openPath(candidate.resume_path);
    } catch (err) {
      toast.error(errorMessage(err));
    }
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

          <div className="min-w-0 space-y-1.5">
            <p className="text-xs text-fg-subtle">LinkedIn</p>
            <div className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-hover px-2">
              <LinkedinLogo className="h-3.5 w-3.5 shrink-0 text-primary" />
              <input
                defaultValue={candidate.linkedin_url ?? ""}
                placeholder="https://linkedin.com/in/…"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === (candidate.linkedin_url ?? "")) return;
                  saveField({ linkedin_url: v || null });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              {candidate.linkedin_url && (
                <>
                  <button
                    onClick={openLinkedIn}
                    title="Open link"
                    className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
                  >
                    <ArrowSquareOut className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={copyLinkedIn}
                    title="Copy link"
                    className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Resume, Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Resume</p>
            {candidate.resume_path ? (
              <div className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-hover px-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-fg" title={resumeName}>
                  {resumeName}
                </span>
                <button
                  onClick={openResume}
                  title="Open resume"
                  className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </button>
                <button
                  onClick={removeResume}
                  title="Remove resume reference"
                  className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-surface-active hover:text-red-500"
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={attachResume} className="h-8 w-full text-[12px]">
                <Paperclip className="h-3.5 w-3.5" />
                Attach resume
              </Button>
            )}
          </div>

          <div className="min-w-0 space-y-1.5">
            <p className="text-xs text-fg-subtle">Status</p>
            <SubmissionStatusSelect
              value={status}
              triggerClassName="h-8 w-full text-xs"
              onValueChange={(v) => {
                const patch: Partial<CandidateInput> = { submission_status: v };
                if (v !== "submitted") patch.submitted_at = null;
                if (v !== "interview") patch.interview_at = null;
                if (v !== "placed") patch.placed_at = null;
                if (v !== "rejected") patch.rejection_reason = null;
                saveField(patch);
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
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-fg-subtle">{label}</p>
      <Input
        ref={ref}
        defaultValue={value}
        className="h-8 text-[13px]"
        onBlur={(e) => {
          if (e.target.value === value) return;
          onSave(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function NameField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="space-y-1.5">
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