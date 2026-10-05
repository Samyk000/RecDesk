import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsLeftRight,
  Briefcase,
  Check,
  Copy,
  IdentificationCard,
  LinkedinLogo,
  ListChecks,
  CircleNotch,
  Lightning,
  NotePencil,
  Paperclip,
  PencilSimple,
  PhoneCall,
  Plus,
  Sparkle,
  Tag,
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
  useDeleteCandidate,
  useRemoveResume,
  useRenameResume,
  useUpdateCandidate,
} from "../../hooks/useQueries";
import { Input } from "../ui/input";
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
import { ResumeProfileMergeDialog } from "./ResumeProfileMergeDialog";
import { apiFiles, apiResumeParser } from "../../lib/api";
import { extractDocumentText } from "../../lib/resumeParser";
import { InterviewRoundsManager } from "./InterviewRoundsManager";
import {
  InterviewFeedbackDialog,
  hasInterviewFeedback,
} from "./InterviewFeedbackDialog";
const ResumePreviewModal = lazy(() =>
  import("./ResumePreviewModal").then((m) => ({ default: m.ResumePreviewModal }))
);
import { ChangeJobDialog } from "./ChangeJobDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { errorMessage, titleCase, cn } from "../../lib/utils";
import { BackwardStatusConfirmDialog } from "./BackwardStatusConfirmDialog";
import { ResetStatusConfirmDialog } from "./ResetStatusConfirmDialog";
import {
  toCandidateInput,
  syncCandidateFieldsToSubmissionDetails,
  getPayRateFromSubmissionDetails,
  setPayRateInSubmissionDetails,
  getCandidateSkills,
  setCandidateSkills,
  parseInterviewRounds,
  serializeInterviewRounds,
  getActiveInterviewSchedule,
  parseRejectionDetail,
  serializeRejectionDetail,
  isBackwardTransition,
} from "../../lib/candidateUtils";
import { Spinner } from "../common/Spinner";
import { QueryErrorState } from "../common/QueryErrorState";
import type {
  Candidate,
  CandidateInput,
  ExtractedCandidateProfile,
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
  const queryClient = useQueryClient();
  const update = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const attachResumeMut = useAttachResume();
  const removeResumeMut = useRemoveResume();
  const renameResumeMut = useRenameResume();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScreeningQA, setShowScreeningQA] = useState(false);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const [showInterviewFeedback, setShowInterviewFeedback] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [isRenamingResume, setIsRenamingResume] = useState(false);
  const [resumeNewName, setResumeNewName] = useState("");
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
  const [showResumeMergeDialog, setShowResumeMergeDialog] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState<ExtractedCandidateProfile | null>(null);
  const [isAutoFillingResume, setIsAutoFillingResume] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [notesDraft, setNotesDraft] = useState(() => getPlainTextFromNotes(candidate.recruiter_notes));

  useEffect(() => {
    setNotesDraft(getPlainTextFromNotes(candidate.recruiter_notes));
  }, [candidate.recruiter_notes]);

  // Show "Details" icon once moved to in_touch or if details have been recorded
  const hasSubmissionDetails = Boolean(
    candidate.submission_details && candidate.submission_details !== "{}"
  );
  const showDetailsIcon = candidate.submission_status !== "sourced" || hasSubmissionDetails;

  // Show "Feedback Call" icon when on interview status OR if feedback was recorded
  const hasFeedbackRecorded = hasInterviewFeedback(candidate);
  const showFeedbackIcon = candidate.submission_status === "interview" || hasFeedbackRecorded;

  const payRate = useMemo(
    () => getPayRateFromSubmissionDetails(candidate.submission_details),
    [candidate.submission_details]
  );

  const candidateSkills = useMemo(
    () => getCandidateSkills(candidate),
    [candidate.submission_details]
  );
  const hasRecruiterNotes = Boolean(candidate.recruiter_notes?.trim());

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

  async function attachResume() {
    const file = await openDialog({
      multiple: false,
      filters: [{ name: "Resume", extensions: ["pdf", "doc", "docx", "txt"] }],
    });
    if (!file || typeof file !== "string") return;
    try {
      const updated = await attachResumeMut.mutateAsync({ id: candidate.id, sourcePath: file });
      toast.success("Resume attached");
      // Extract fields & skills right away instead of requiring a second click
      void parseAndOpenMerge(updated.resume_path ?? file);
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

  async function parseAndOpenMerge(resumePath: string) {
    try {
      setIsAutoFillingResume(true);
      const filename = resumePath.split(/[\\/]/).pop() ?? "resume";
      const bytesArray = await apiFiles.readResumeBytes(resumePath);
      const data = new Uint8Array(bytesArray);
      const { text, embeddedLinks } = await extractDocumentText(resumePath, data);
      if (!text.trim()) {
        throw new Error("Could not extract readable text from resume document.");
      }
      const profile = await apiResumeParser.parseResume(text, filename, embeddedLinks);
      setExtractedProfile(profile);
      setShowResumeMergeDialog(true);
    } catch (err) {
      toast.error(`Auto-fill failed: ${errorMessage(err)}`);
    } finally {
      setIsAutoFillingResume(false);
    }
  }

  async function handleAutoFillFromResume() {
    if (!candidate.resume_path) {
      toast.error("No resume file attached to auto-fill from");
      return;
    }
    void parseAndOpenMerge(candidate.resume_path);
  }

  const handleAddSkill = (skillName?: string) => {
    const raw = (skillName ?? newSkillInput).trim();
    if (!raw) return;

    // Split on commas, semicolons, pipes, or newlines (e.g. "AWS, Node, Python")
    const parts = raw
      .split(/[,;|\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (parts.length === 0) return;

    let addedCount = 0;
    const updated = [...candidateSkills];

    for (const part of parts) {
      if (!updated.some((s) => s.toLowerCase() === part.toLowerCase())) {
        updated.push(part);
        addedCount++;
      }
    }

    if (addedCount === 0 && parts.length === 1) {
      toast.info(`"${parts[0]}" is already in skills list`);
      setNewSkillInput("");
      setIsAddingSkill(false);
      return;
    }

    const newDetails = setCandidateSkills(candidate.submission_details, updated);
    saveField({ submission_details: newDetails });
    if (parts.length > 1) {
      toast.success(`Added ${addedCount} skill${addedCount === 1 ? "" : "s"}`);
    }
    setNewSkillInput("");
    setIsAddingSkill(false);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = candidateSkills.filter(
      (s) => s.toLowerCase() !== skillToRemove.toLowerCase(),
    );
    const newDetails = setCandidateSkills(candidate.submission_details, updated);
    saveField({ submission_details: newDetails });
  };

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

  const status = candidate.submission_status;
  const resumeName = candidate.resume_path?.split(/[\\/]/).pop() ?? "";

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[13px] font-semibold text-fg tracking-tight">Candidate Details</span>
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
              {/* Recruiter Notes Icon with notification dot */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "relative h-8 w-8 hover:bg-primary/10",
                      hasRecruiterNotes
                        ? "text-primary font-semibold"
                        : "text-fg-subtle hover:text-primary",
                    )}
                    onClick={() => setShowRecruiterNotesModal(true)}
                    aria-label="Recruiter Notes"
                  >
                    <NotePencil className="h-4 w-4" />
                    {hasRecruiterNotes && (
                      <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasRecruiterNotes ? "Recruiter Notes (recorded)" : "Recruiter Notes"}
                </TooltipContent>
              </Tooltip>
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
                  {!embedded && (
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
                    <span>Change job…</span>
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

      <div className="flex flex-1 flex-col space-y-3 overflow-y-auto p-4 scrollbar-thin">

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

        {/* Row 3: Location, Pay Rate */}
        <div className="grid grid-cols-2 gap-3">
          <InlineField
            label="Location"
            value={candidate.location ?? ""}
            onSave={(v) => saveField({ location: v || null })}
          />
          <InlineField
            label="Pay Rate"
            value={payRate}
            placeholder="e.g. $80/hr or $120k/yr"
            onSave={(v) => {
              const updatedDetails = setPayRateInSubmissionDetails(
                candidate.submission_details,
                v
              );
              saveField({ submission_details: updatedDetails });
            }}
          />
        </div>

        {/* Row 4: LinkedIn, Resume */}
        <div className="grid grid-cols-2 gap-3">
          <LinkedInField
            value={candidate.linkedin_url ?? ""}
            onSave={(v) => saveField({ linkedin_url: v || null })}
            onOpen={openLinkedIn}
            onCopy={copyLinkedIn}
          />
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

                  {/* 1-Click Auto-Fill from Resume */}
                  <button
                    type="button"
                    onClick={handleAutoFillFromResume}
                    disabled={isAutoFillingResume}
                    title="Auto-Fill profile fields and skills from this resume"
                    className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                  >
                    {isAutoFillingResume ? (
                      <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Lightning className="h-3.5 w-3.5" weight="fill" />
                    )}
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
        </div>

        {/* Row 5: Status (Full width) */}
        <div className="w-full space-y-1.5">
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
                  onClick={() => setShowResetConfirm(true)}
                  title="Clear status and reset to Sourced"
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10.5px] text-fg-subtle transition-colors hover:bg-surface-hover hover:text-red-500 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
          <div className={cn("grid gap-3 items-center", (status === "sourced" || status === "pipeline") ? "grid-cols-1" : "grid-cols-2")}>
            <SubmissionStatusSelect
              value={status}
              triggerClassName="h-8 w-full text-xs"
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

            {/* Same-line companion control for each active status */}
            {status === "submitted" && (
              <SubmittedDatePicker
                value={candidate.submitted_at}
                onChange={(val) => saveField({ submitted_at: val })}
                className="h-8"
              />
            )}

            {status === "placed" && (
              <PlacedDatePicker
                value={candidate.placed_at}
                onChange={(val) => saveField({ placed_at: val })}
                className="h-8"
              />
            )}

            {status === "interview" && (
              <SubmittedDatePicker
                value={candidate.submitted_at}
                onChange={(val) => saveField({ submitted_at: val })}
                className="h-8"
              />
            )}

            {status === "rejected" && (
              <Select
                value={parseRejectionDetail(candidate.rejection_reason).origin || "client_screening"}
                onValueChange={(val) => {
                  const existing = parseRejectionDetail(candidate.rejection_reason);
                  const detail: RejectionDetail = {
                    ...existing,
                    origin: val as RejectionOrigin,
                    rejected_at: existing.rejected_at || new Date().toISOString(),
                  };
                  saveField({ rejection_reason: serializeRejectionDetail(detail) });
                }}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Rejection stage…" />
                </SelectTrigger>
                <SelectContent className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="client_screening">Client Screening</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            )}

            {status === "not_interested" && (
              <Select
                value={candidate.rejection_reason ?? ""}
                onValueChange={(val) => saveField({ rejection_reason: val || null })}
              >
                <SelectTrigger className="h-8 w-full text-xs">
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
                className="h-7 w-full rounded border border-border/70 bg-surface px-2 text-[11px] text-fg outline-none focus:border-red-500/50"
              />
            </div>
          )}
        </div>

        {/* Notes Section (between Status and Skills & Tools) */}
        <div className="w-full space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-fg-subtle font-medium">
              <NotePencil className="h-3.5 w-3.5 text-fg-muted" />
              <span>Notes</span>
            </p>
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
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20 resize-y min-h-[56px] max-h-36 scrollbar-thin"
          />
        </div>

        {/* Skills & Tools Badges Section */}
        <div className="flex flex-col rounded-lg border border-border bg-surface p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
              <Tag className="h-3.5 w-3.5 text-primary" weight="bold" />
              <span>Skills & Tools</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                {candidateSkills.length}
              </span>
            </div>
            {!isAddingSkill ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingSkill(true)}
                className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 cursor-pointer gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Skill
              </Button>
            ) : null}
          </div>

          {/* Inline Add Skill Input */}
          {isAddingSkill && (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <Input
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill();
                  } else if (e.key === "Escape") {
                    setIsAddingSkill(false);
                    setNewSkillInput("");
                  }
                }}
                autoFocus
                placeholder="Type skill(s) e.g. AWS, Node, Python & press Enter…"
                className="h-7 text-xs flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleAddSkill()}
                className="h-7 px-2.5 text-xs"
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddingSkill(false);
                  setNewSkillInput("");
                }}
                className="h-7 px-2 text-xs text-fg-subtle"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Skills Badge Pills */}
          {candidateSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto scrollbar-thin">
              {candidateSkills.map((skill) => (
                <span
                  key={skill}
                  className="group inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11.5px] font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/15"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    title={`Remove ${skill}`}
                    className="rounded p-0.5 text-primary/60 opacity-60 hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-3 text-center">
              <p className="text-xs text-fg-muted">No skills listed yet.</p>
              <p className="text-[11px] text-fg-subtle">
                Auto-fill from resume or click &quot;Add Skill&quot; to highlight technologies.
              </p>
            </div>
          )}
        </div>
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

      <ResumeProfileMergeDialog
        candidate={candidate}
        extracted={extractedProfile}
        open={showResumeMergeDialog}
        onOpenChange={setShowResumeMergeDialog}
        onApply={(patch) => {
          saveField(patch);
          toast.success("Profile updated from resume!");
        }}
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

      {candidate.resume_path && showResumePreview && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}


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

function getPlainTextFromNotes(raw?: string | null): string {
  if (!raw) return "";
  if (!raw.includes("<") || !raw.includes(">")) return raw;
  try {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    return doc.body.textContent || "";
  } catch {
    return raw.replace(/<[^>]*>/g, "");
  }
}

function InlineField({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
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