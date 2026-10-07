import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsLeftRight,
  Briefcase,
  Check,
  CircleNotch,
  CurrencyDollar,
  EnvelopeSimple,
  IdentificationCard,
  ListChecks,
  MapPin,
  NotePencil,
  Phone,
  PhoneCall,
  Trash,
  X,
} from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  useCandidate,
  useDeleteCandidate,
  useUpdateCandidate,
} from "../../hooks/useQueries";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SubmissionStatusSelect } from "./SubmissionStatusSelect";
import { SubmittedDatePicker } from "./SubmittedDatePicker";
import { PlacedDatePicker } from "./PlacedDatePicker";
import { ScreeningQADialog } from "./ScreeningQADialog";
import { SubmissionDetailsDialog } from "./SubmissionDetailsDialog";
import { RecruiterNotesDialog } from "./RecruiterNotesDialog";
import { InterviewRoundsManager } from "./InterviewRoundsManager";
import {
  InterviewFeedbackDialog,
  hasInterviewFeedback,
} from "./InterviewFeedbackDialog";
import { ChangeJobDialog } from "./ChangeJobDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { errorMessage, titleCase, cn, nameInitials } from "../../lib/utils";
import { submissionPalette } from "../../lib/constants";
import { BackwardStatusConfirmDialog } from "./BackwardStatusConfirmDialog";
import { ResetStatusConfirmDialog } from "./ResetStatusConfirmDialog";
import {
  toCandidateInput,
  syncCandidateFieldsToSubmissionDetails,
  getPayRateFromSubmissionDetails,
  setPayRateInSubmissionDetails,
  parseInterviewRounds,
  serializeInterviewRounds,
  getActiveInterviewSchedule,
  parseRejectionDetail,
  serializeRejectionDetail,
  isBackwardTransition,
} from "../../lib/candidateUtils";
import { Spinner } from "../common/Spinner";
import { QueryErrorState } from "../common/QueryErrorState";
import {
  ContactField,
  HeroMetaField,
  HeroNameField,
  HeroTitleField,
  LinkedInField,
  getPlainTextFromNotes,
  getStatusSelectTriggerStyle,
} from "./CandidateDetailFields";
import { CandidateResumeSection } from "./CandidateResumeSection";
import { CandidateSkillsSection } from "./CandidateSkillsSection";
import type {
  Candidate,
  CandidateInput,
  RejectionDetail,
  RejectionOrigin,
} from "../../types";

interface Props {
  candidateId: string;
  onClose: () => void;
  embedded?: boolean;
}

export function CandidateDetailPanel({ candidateId, onClose, embedded }: Props) {
  const { data: candidate, isLoading, isError, refetch } = useCandidate(candidateId);
  if (isLoading || !candidate) {
    if (isError) return <QueryErrorState label="this candidate" onRetry={refetch} />;
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
  const navigate = useNavigate();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScreeningQA, setShowScreeningQA] = useState(false);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const [showInterviewFeedback, setShowInterviewFeedback] = useState(false);
  const [changeJobOpen, setChangeJobOpen] = useState(false);
  const [previousStatusSnapshot, setPreviousStatusSnapshot] = useState<{
    submission_status: string;
    submitted_at: string | null;
    interview_at: string | null;
    placed_at: string | null;
    rejection_reason: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [backwardTargetStatus, setBackwardTargetStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRecruiterNotesModal, setShowRecruiterNotesModal] = useState(false);
  const [notesDraft, setNotesDraft] = useState(() => getPlainTextFromNotes(candidate.recruiter_notes));

  useEffect(() => {
    setNotesDraft(getPlainTextFromNotes(candidate.recruiter_notes));
  }, [candidate.recruiter_notes]);

  // Candidate details icon is always available in header
  const showDetailsIcon = true;

  // Show "Feedback Call" icon when on interview status OR if feedback was recorded
  const hasFeedbackRecorded = hasInterviewFeedback(candidate);
  const showFeedbackIcon = candidate.submission_status === "interview" || hasFeedbackRecorded;

  const payRate = useMemo(
    () => getPayRateFromSubmissionDetails(candidate.submission_details),
    [candidate.submission_details]
  );

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
    setJustSaved(false);
    try {
      await update.mutateAsync({
        id: candidate.id,
        input: toCandidateInput(candidate, fullPatch),
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
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

  async function handleRetractSubmission() {
    setPreviousStatusSnapshot({
      submission_status: candidate.submission_status,
      submitted_at: candidate.submitted_at ?? null,
      interview_at: candidate.interview_at ?? null,
      placed_at: candidate.placed_at ?? null,
      rejection_reason: candidate.rejection_reason ?? null,
    });

    const patch: Partial<CandidateInput> = {
      submission_status: "in_touch",
      submitted_at: null,
    };
    saveField(patch);
    toast.success("Submission retracted (moved to In Touch)");
  }

  const handleConfirmBackward = (preserveMilestone: boolean) => {
    const target = backwardTargetStatus;
    setBackwardTargetStatus(null);
    if (!target) return;

    setPreviousStatusSnapshot({
      submission_status: candidate.submission_status,
      submitted_at: candidate.submitted_at ?? null,
      interview_at: candidate.interview_at ?? null,
      placed_at: candidate.placed_at ?? null,
      rejection_reason: candidate.rejection_reason ?? null,
    });

    if (preserveMilestone) {
      saveField({ submission_status: target });
      toast.success(`Moved to ${titleCase(target)} (milestone history preserved)`);
    } else {
      const patch: Partial<CandidateInput> = { submission_status: target };
      if (target === "sourced" || target === "in_touch") {
        patch.submitted_at = null;
        patch.interview_at = null;
        patch.placed_at = null;
        patch.rejection_reason = null;
      }
      saveField(patch);
      toast.success(`Moved to ${titleCase(target)} (milestones reset)`);
    }
  };

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

  async function copyEmail() {
    if (!candidate.email) return;
    try {
      await navigator.clipboard.writeText(candidate.email);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy email");
    }
  }

  async function copyPhone() {
    if (!candidate.phone) return;
    try {
      await navigator.clipboard.writeText(candidate.phone);
      toast.success("Phone copied");
    } catch {
      toast.error("Could not copy phone");
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

  const status = candidate.submission_status;
  const palette = submissionPalette(status);
  const initials = nameInitials(candidate.name) || "??";
  const hasCompanionControl =
    status === "submitted" ||
    status === "interview" ||
    status === "placed" ||
    status === "rejected" ||
    status === "not_interested";

  return (
    <div className="relative flex h-full flex-col">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold tracking-tight select-none shadow-2xs transition-colors"
            style={{
              borderColor: palette.dot,
              backgroundColor: `${palette.dot}14`,
              color: palette.dot,
            }}
            title={`${candidate.name || "Candidate"} (${titleCase(status)})`}
          >
            {initials}
          </span>
          {!candidate.job_id && (
            <button
              type="button"
              onClick={() => setChangeJobOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Click to assign to a job"
            >
              <Briefcase className="h-3 w-3" />
              Unassigned
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-fg-muted hover:text-fg hover:bg-surface-hover cursor-pointer"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          ) : (
            <>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Job options"
                    className="h-8 w-8 text-fg-subtle hover:text-fg hover:bg-surface-hover cursor-pointer"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" sideOffset={6} className="w-36">
                  {!embedded && candidate.job_id && (
                    <DropdownMenuItem
                      onSelect={() => {
                        onClose();
                        setTimeout(() => {
                          navigate(`/jobs/${candidate.job_id}`);
                        }, 0);
                      }}
                      className="flex items-center gap-2 cursor-pointer text-xs"
                    >
                      <ArrowSquareOut className="h-3.5 w-3.5 text-fg-muted" />
                      <span>View job</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={() => setChangeJobOpen(true)}
                    className="flex items-center gap-2 cursor-pointer text-xs"
                  >
                    <ArrowsLeftRight className="h-3.5 w-3.5 text-primary" />
                    <span>{candidate.job_id ? "Change job…" : "Assign to job…"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer ml-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col space-y-4 overflow-y-auto px-4 py-3.5 scrollbar-thin">
        {/* Section 1: Candidate Hero (Name, Title, Location, Pay Rate) */}
        <div className="flex items-start justify-between gap-3 pt-0.5 pb-0.5">
          {/* Left: Name & Title */}
          <div className="flex flex-1 min-w-0 flex-col">
            <HeroNameField
              value={candidate.name}
              onSave={(v) => saveField({ name: v })}
            />
            <HeroTitleField
              value={candidate.current_title ?? ""}
              onSave={(v) => saveField({ current_title: v || null })}
            />
          </div>

          {/* Right: Location & Pay Rate with subtle vertical divider */}
          <div className="flex shrink-0 items-center gap-3 self-stretch">
            <div className="w-px bg-border/60 self-stretch my-0.5" />
            <div className="flex w-[140px] flex-col justify-center gap-1">
              <HeroMetaField
                icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
                value={candidate.location ?? ""}
                placeholder="Add location…"
                onSave={(v) => saveField({ location: v || null })}
              />
              <HeroMetaField
                icon={<CurrencyDollar className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
                value={payRate}
                placeholder="Add rate…"
                onSave={(v) => {
                  const updatedDetails = setPayRateInSubmissionDetails(
                    candidate.submission_details,
                    v
                  );
                  saveField({ submission_details: updatedDetails });
                }}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Section 2: Contact & Documents (2x2 Grid) */}
        <div className="space-y-2.5">
          {/* Row 1: Email & Phone */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex h-5 items-center">
                <label className="text-[11px] font-medium text-fg-subtle">Email</label>
              </div>
              <ContactField
                icon={<EnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
                value={candidate.email ?? ""}
                placeholder="Add email…"
                onSave={(v) => saveField({ email: v || null })}
                onCopy={copyEmail}
              />
            </div>

            <div className="space-y-1">
              <div className="flex h-5 items-center">
                <label className="text-[11px] font-medium text-fg-subtle">Phone</label>
              </div>
              <ContactField
                icon={<Phone className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
                value={candidate.phone ?? ""}
                placeholder="Add phone…"
                onSave={(v) => saveField({ phone: v || null })}
                onCopy={copyPhone}
              />
            </div>
          </div>

          {/* Row 2: LinkedIn & Resume */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex h-5 items-center">
                <label className="text-[11px] font-medium text-fg-subtle">LinkedIn</label>
              </div>
              <LinkedInField
                value={candidate.linkedin_url ?? ""}
                onSave={(v) => saveField({ linkedin_url: v || null })}
                onOpen={openLinkedIn}
                onCopy={copyLinkedIn}
              />
            </div>

            <CandidateResumeSection
              candidate={candidate}
              onSaveField={saveField}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Section 3: Status & Dates (Pipeline Stage) */}
        <div className="space-y-2">
          <div className={cn("grid gap-2.5 items-start", hasCompanionControl ? "grid-cols-2" : "grid-cols-1")}>
            {/* Status Column */}
            <div className="space-y-1">
              <div className="flex h-5 items-center justify-between">
                <label className="text-[11px] font-medium text-fg-subtle">Status</label>
                <div className="flex items-center gap-1.5">
                  {previousStatusSnapshot && previousStatusSnapshot.submission_status !== candidate.submission_status && (
                    <button
                      type="button"
                      onClick={handleRestoreStatus}
                      title={`Restore previous status: ${titleCase(previousStatusSnapshot.submission_status)}`}
                      className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10 cursor-pointer"
                    >
                      <ArrowCounterClockwise className="h-2.5 w-2.5" />
                      <span>Restore</span>
                    </button>
                  )}
                  {status !== "sourced" && (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      title="Clear status and reset to Sourced"
                      className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-fg-subtle transition-colors hover:bg-surface-hover hover:text-red-500 cursor-pointer"
                    >
                      <X className="h-2.5 w-2.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
              <SubmissionStatusSelect
                value={status}
                triggerClassName={cn(
                  "h-9 w-full text-xs font-medium transition-all shadow-2xs",
                  getStatusSelectTriggerStyle(status)
                )}
                onValueChange={(v) => {
                  if (v === candidate.submission_status) return;

                  if (isBackwardTransition(candidate.submission_status, v)) {
                    setBackwardTargetStatus(v);
                  } else if (v === "sourced") {
                    setShowResetConfirm(true);
                  } else if (v === "submitted") {
                    const patch: Partial<CandidateInput> = {
                      submission_status: "submitted",
                      submitted_at: candidate.submitted_at || new Date().toISOString(),
                    };
                    saveField(patch);
                  } else if (v === "interview") {
                    const patch: Partial<CandidateInput> = {
                      submission_status: "interview",
                      submitted_at: candidate.submitted_at || new Date().toISOString(),
                      interview_at: candidate.interview_at || new Date().toISOString(),
                    };
                    saveField(patch);
                  } else if (v === "placed") {
                    const patch: Partial<CandidateInput> = {
                      submission_status: "placed",
                      submitted_at: candidate.submitted_at || new Date().toISOString(),
                      placed_at: candidate.placed_at || new Date().toISOString(),
                    };
                    saveField(patch);
                  } else if (v === "rejected") {
                    const existing = parseRejectionDetail(candidate.rejection_reason);
                    const origin =
                      candidate.submission_status === "interview"
                        ? "interview"
                        : candidate.submission_status === "submitted"
                          ? "client_screening"
                          : existing.origin || "general";

                    const detail: RejectionDetail = {
                      ...existing,
                      origin,
                      rejected_at: existing.rejected_at || new Date().toISOString(),
                    };
                    const patch: Partial<CandidateInput> = {
                      submission_status: "rejected",
                      rejection_reason: serializeRejectionDetail(detail),
                    };
                    saveField(patch);
                  } else {
                    const patch: Partial<CandidateInput> = { submission_status: v };
                    saveField(patch);
                  }
                }}
              />
            </div>

            {/* Companion Column (Date, Stage, Reason) */}
            {hasCompanionControl && (
              <div className="space-y-1">
                <div className="flex h-5 items-center justify-between">
                  <label className="text-[11px] font-medium text-fg-subtle">
                    {status === "submitted"
                      ? "Date"
                      : status === "interview"
                        ? "Submitted Date"
                        : status === "placed"
                          ? "Placed Date"
                          : status === "rejected"
                            ? "Rejection Stage"
                            : "Reason"}
                  </label>
                </div>

                {status === "submitted" && (
                  <div className="flex items-center gap-1.5">
                    <SubmittedDatePicker
                      value={candidate.submitted_at}
                      onChange={(val) => saveField({ submitted_at: val })}
                      className="h-9 flex-1 min-w-0"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleRetractSubmission}
                          className="flex h-7.5 shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2 text-[10.5px] font-medium text-amber-700 dark:text-amber-300 transition-colors cursor-pointer shadow-2xs"
                        >
                          <ArrowCounterClockwise className="h-2.5 w-2.5" />
                          <span>Retract</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Retract to In Touch</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {status === "placed" && (
                  <PlacedDatePicker
                    value={candidate.placed_at}
                    onChange={(val) => saveField({ placed_at: val })}
                    className="h-9"
                  />
                )}

                {status === "interview" && (
                  <SubmittedDatePicker
                    value={candidate.submitted_at}
                    onChange={(val) => saveField({ submitted_at: val })}
                    className="h-9"
                  />
                )}

                {status === "rejected" && (
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={parseRejectionDetail(candidate.rejection_reason).origin || "client_screening"}
                      onValueChange={(val) => {
                        const existing = parseRejectionDetail(candidate.rejection_reason);
                        const detail: RejectionDetail = {
                          ...existing,
                          origin: val as RejectionOrigin,
                          rejected_at: existing.rejected_at || new Date().toISOString(),
                        };
                        const patch: Partial<CandidateInput> = {
                          rejection_reason: serializeRejectionDetail(detail),
                        };
                        if (val === "internal") {
                          patch.submitted_at = null; // Clear submitted_at so internal pass is excluded from submission count and calendar
                        }
                        saveField(patch);
                        if (val === "internal") {
                          toast.info("Candidate marked as Internal / Team Pass (excluded from submissions)");
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 flex-1 min-w-0 text-xs">
                        <SelectValue placeholder="Rejection stage…" />
                      </SelectTrigger>
                      <SelectContent className="w-[var(--radix-select-trigger-width)]">
                        <SelectItem value="client_screening">Client Screening</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="internal">Internal / Team Pass</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            saveField({ submission_status: "in_touch" });
                            toast.success("Candidate restored to In Touch");
                          }}
                          className="flex h-7.5 shrink-0 items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-2 text-[10.5px] font-medium text-blue-700 dark:text-blue-300 transition-colors cursor-pointer shadow-2xs"
                        >
                          <ArrowCounterClockwise className="h-2.5 w-2.5" />
                          <span>Reopen</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Reconsider Candidate (Move to In Touch)</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {status === "not_interested" && (
                  <Select
                    value={candidate.rejection_reason ?? ""}
                    onValueChange={(val) => saveField({ rejection_reason: val || null })}
                  >
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Reason…" />
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      <SelectItem value="Rate / Compensation">Rate / Comp</SelectItem>
                      <SelectItem value="Location / Commute">Location / Commute</SelectItem>
                      <SelectItem value="Accepted another offer">Accepted Other Offer</SelectItem>
                      <SelectItem value="Timing / Not looking">Timing / Not Looking</SelectItem>
                      <SelectItem value="Role mismatch">Role Mismatch</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          {/* Underneath elements only for multi-round interview or rejection note */}
          {status === "interview" && (
            <div className="pt-1.5 animate-[fade-up_0.2s_ease-out]">
              <InterviewRoundsManager
                rounds={parseInterviewRounds(candidate.interview_status, candidate.interview_at)}
                onChange={(newRounds) => {
                  saveField({
                    interview_status: serializeInterviewRounds(newRounds),
                    interview_at: getActiveInterviewSchedule(newRounds),
                  });
                }}
                onSelectAndPlace={() => {
                  saveField({
                    submission_status: "placed",
                    client_feedback: "client",
                    submitted_at: candidate.submitted_at || new Date().toISOString(),
                    placed_at: new Date().toISOString(),
                  });
                  toast.success("Candidate marked as Placed!");
                }}
                onRejectRound={(rNum, rejectionMsg) => {
                  const detail: RejectionDetail = {
                    origin: "interview",
                    round_number: rNum,
                    category: "Interview feedback",
                    reason: rejectionMsg?.trim() || null,
                    rejected_at: new Date().toISOString(),
                  };
                  saveField({
                    submission_status: "rejected",
                    client_feedback: "client",
                    submitted_at: candidate.submitted_at || new Date().toISOString(),
                    rejection_reason: serializeRejectionDetail(detail),
                  });
                  toast.success(`Candidate marked as Rejected after Round ${rNum}`);
                }}
              />
            </div>
          )}

          {status === "rejected" && (
            <div className="pt-1 animate-[fade-up_0.2s_ease-out]">
              <input
                type="text"
                defaultValue={parseRejectionDetail(candidate.rejection_reason).reason ?? ""}
                placeholder="Rejection reason notes (optional)…"
                onBlur={(e) => {
                  const existing = parseRejectionDetail(candidate.rejection_reason);
                  const detail: RejectionDetail = {
                    ...existing,
                    reason: e.target.value.trim() || null,
                  };
                  saveField({ rejection_reason: serializeRejectionDetail(detail) });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="h-8.5 w-full rounded-lg border border-border/70 bg-surface px-2.5 text-[11.5px] text-fg outline-none transition-colors focus:border-red-500/50"
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Section 4: Notes */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
            <NotePencil className="h-4 w-4 text-fg-subtle" weight="bold" />
            <span>Notes</span>
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              const trimmed = notesDraft.trim();
              const currentPlain = getPlainTextFromNotes(candidate.recruiter_notes).trim();
              if (trimmed === currentPlain) return;
              saveField({ recruiter_notes: trimmed || null });
            }}
            placeholder="Add notes about this candidate…"
            rows={3}
            className="w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle/70 outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20 resize-y min-h-[70px] max-h-36 scrollbar-thin"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Section 5: Skills & Tools */}
        <CandidateSkillsSection
          candidate={candidate}
          onSaveField={saveField}
        />
      </div>

      {(saving || justSaved) && (
        <div className="pointer-events-none absolute bottom-3 right-4 z-30 flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/95 px-3 py-1 text-xs shadow-md backdrop-blur-xs animate-fade-in">
          {saving ? (
            <>
              <CircleNotch className="h-3 w-3 animate-spin text-primary" />
              <span className="text-[11px] font-medium text-fg-subtle">Saving…</span>
            </>
          ) : (
            <>
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Saved</span>
            </>
          )}
        </div>
      )}

      {/* Dialogs and Modals */}
      <InterviewFeedbackDialog
        candidateId={candidate.id}
        open={showInterviewFeedback}
        onOpenChange={setShowInterviewFeedback}
      />

      <RecruiterNotesDialog
        candidateName={candidate.name}
        notes={candidate.recruiter_notes}
        open={showRecruiterNotesModal}
        onOpenChange={setShowRecruiterNotesModal}
        onSave={(notes) => saveField({ recruiter_notes: notes })}
        saving={saving}
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

      <ChangeJobDialog
        candidate={candidate}
        open={changeJobOpen}
        onOpenChange={setChangeJobOpen}
        onSuccess={(_jobId, action) => {
          if (action === "move" && embedded) {
            onClose();
          }
        }}
      />

      <BackwardStatusConfirmDialog
        open={backwardTargetStatus !== null}
        candidateName={candidate.name}
        currentStatus={candidate.submission_status}
        targetStatus={backwardTargetStatus || ""}
        onConfirm={handleConfirmBackward}
        onCancel={() => setBackwardTargetStatus(null)}
      />

      <ResetStatusConfirmDialog
        open={showResetConfirm}
        candidateName={candidate.name}
        onConfirm={() => {
          setShowResetConfirm(false);
          resetToSourced();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}