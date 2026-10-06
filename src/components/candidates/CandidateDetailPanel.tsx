import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsLeftRight,
  Briefcase,
  Check,
  CircleNotch,
  Copy,
  CurrencyDollar,
  DotsThreeVertical,
  EnvelopeSimple,
  FileText,
  IdentificationCard,
  Lightning,
  LinkedinLogo,
  ListChecks,
  MapPin,
  NotePencil,
  Paperclip,
  PencilSimple,
  Phone,
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

  // Candidate details icon is always available in header
  const showDetailsIcon = true;

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
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    if (parts.length === 0) return;

    let addedCount = 0;
    const updated = [...candidateSkills];

    for (const part of parts) {
      if (!updated.some((s: string) => s.toLowerCase() === part.toLowerCase())) {
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
      (s: string) => s.toLowerCase() !== skillToRemove.toLowerCase(),
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
  const hasCompanionControl =
    status === "submitted" ||
    status === "interview" ||
    status === "placed" ||
    status === "rejected" ||
    status === "not_interested";
  const resumeName = candidate.resume_path?.split(/[\\/]/).pop() ?? "";

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-fg tracking-tight">Candidate Details</span>
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

        {/* Section 2: Contact & Documents (2x2 Grid with individual field labels) */}
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

            <div className="space-y-1">
              <div className="flex h-5 items-center">
                <label className="text-[11px] font-medium text-fg-subtle">Resume</label>
              </div>
              <div className="min-w-0">
                {candidate.resume_path ? (
                  isRenamingResume ? (
                    <div className="flex h-9 items-center gap-1 rounded-lg border border-primary/50 bg-surface px-2 shadow-xs">
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
                        className="shrink-0 rounded p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRenamingResume(false)}
                        title="Cancel (Esc)"
                        className="shrink-0 rounded p-1 text-fg-subtle hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 transition-colors hover:border-border">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                      <button
                        type="button"
                        onClick={openResume}
                        className="min-w-0 flex-1 truncate text-left text-[12px] text-fg hover:text-primary transition-colors cursor-pointer"
                        title={`Preview ${resumeName}`}
                      >
                        {resumeName}
                      </button>

                      <div className="flex shrink-0 items-center gap-0.5">
                        {/* 1-Click Auto-Rename */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={handleAutoRenameToCandidate}
                              disabled={renameResumeMut.isPending}
                              className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-primary cursor-pointer"
                            >
                              <Sparkle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Auto-rename</TooltipContent>
                        </Tooltip>

                        {/* Dropdown Menu for Auto-fill, Rename, Replace, Remove */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
                            >
                              <DotsThreeVertical className="h-3.5 w-3.5" weight="bold" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 text-xs">
                            <DropdownMenuItem
                              onClick={handleAutoFillFromResume}
                              disabled={isAutoFillingResume}
                              className="gap-2 cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600"
                            >
                              {isAutoFillingResume ? (
                                <CircleNotch className="h-3.5 w-3.5 animate-spin text-amber-500" />
                              ) : (
                                <Lightning className="h-3.5 w-3.5 text-amber-500" weight="fill" />
                              )}
                              <span>Auto-fill Profile</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={startRenameResume} className="gap-2 cursor-pointer">
                              <PencilSimple className="h-3.5 w-3.5 text-fg-subtle" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={attachResume} className="gap-2 cursor-pointer">
                              <Paperclip className="h-3.5 w-3.5 text-fg-subtle" />
                              <span>Replace</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={removeResume} className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600 cursor-pointer">
                              <Trash className="h-3.5 w-3.5 text-red-500" />
                              <span>Remove</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                ) : (
                  <Button size="sm" variant="outline" onClick={attachResume} className="h-9 w-full text-[12px] gap-1.5 border-dashed">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach resume
                  </Button>
                )}
              </div>
            </div>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
              <Tag className="h-4 w-4 text-fg-subtle" weight="bold" />
              <span>Skills & Tools</span>
              {candidateSkills.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                  {candidateSkills.length}
                </span>
              )}
            </div>
            {!isAddingSkill && candidateSkills.length > 0 && (
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
            )}
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
                className="h-7.5 text-xs flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleAddSkill()}
                className="h-7.5 px-2.5 text-xs"
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
                className="h-7.5 px-2 text-xs text-fg-subtle"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Skills Badges List */}
          {candidateSkills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 max-h-[140px] overflow-y-auto scrollbar-thin">
              {candidateSkills.map((skill: string) => (
                <span
                  key={skill}
                  className="group inline-flex items-center gap-1 rounded-md border border-border/80 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-fg shadow-2xs transition-colors hover:border-border"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    title={`Remove ${skill}`}
                    className="rounded p-0.5 text-fg-subtle hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              {!isAddingSkill && (
                <button
                  type="button"
                  onClick={() => setIsAddingSkill(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-[11.5px] font-medium text-primary hover:bg-primary/10 hover:border-primary/60 transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Skill</span>
                </button>
              )}
            </div>
          ) : (
            !isAddingSkill && (
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-fg-subtle">No skills listed yet.</span>
                <button
                  type="button"
                  onClick={() => setIsAddingSkill(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Skill</span>
                </button>
              </div>
            )
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


function getStatusSelectTriggerStyle(status: string): string {
  switch (status) {
    case "sourced":
      return "bg-slate-500/10 hover:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
    case "in_touch":
      return "bg-blue-500/10 hover:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "pipeline":
      return "bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
    case "submitted":
      return "bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "interview":
      return "bg-purple-500/10 hover:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    case "placed":
      return "bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "rejected":
      return "bg-red-500/10 hover:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "not_interested":
      return "bg-slate-500/10 hover:bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
    default:
      return "bg-slate-500/10 hover:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  }
}

function getAdaptiveNameSize(name: string): string {
  const len = name.trim().length;
  if (len <= 20) return "text-[18px] font-bold tracking-tight text-fg";
  if (len <= 30) return "text-[16px] font-bold tracking-tight text-fg";
  return "text-[14px] font-semibold tracking-tight text-fg";
}

function HeroNameField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const fontClass = getAdaptiveNameSize(draft || value || "Candidate");

  return (
    <div className="min-w-0">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Candidate Name"
        title={draft || value}
        className={cn(
          "w-full bg-transparent text-fg leading-tight placeholder:text-fg-subtle outline-none transition-colors rounded px-1 -ml-1 hover:bg-surface-hover/80 focus:bg-surface focus:ring-1 focus:ring-primary/40 truncate",
          fontClass
        )}
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

function HeroTitleField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="min-w-0 mt-0.5">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Role / Title…"
        title={draft || value}
        className="w-full bg-transparent text-[13px] text-fg-muted placeholder:text-fg-subtle/60 outline-none transition-colors rounded px-1 -ml-1 hover:bg-surface-hover/80 focus:bg-surface focus:ring-1 focus:ring-primary/40 truncate"
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

function HeroMetaField({
  icon,
  value,
  placeholder,
  onSave,
}: {
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="flex items-center gap-1.5 min-w-0 group">
      {icon}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        title={draft || value}
        className="w-full min-w-0 bg-transparent text-[12px] text-fg-muted font-medium placeholder:text-fg-subtle/50 outline-none transition-colors rounded px-1 hover:bg-surface-hover/80 focus:bg-surface focus:ring-1 focus:ring-primary/40 truncate"
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

function ContactField({
  icon,
  value,
  placeholder,
  onSave,
  onCopy,
}: {
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  onCopy: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const handleCopy = () => {
    if (!value) return;
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 transition-colors hover:border-border">
      {icon}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-subtle truncate"
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
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy"}
          className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      ) : null}
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
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const handleCopy = () => {
    if (!value) return;
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 transition-colors hover:border-border">
      <LinkedinLogo className="h-3.5 w-3.5 shrink-0 text-[#0077b5]" weight="fill" />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="LinkedIn URL…"
        className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-subtle truncate"
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
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpen}
            title="Open in browser"
            className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
          >
            <ArrowSquareOut className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy link"}
            className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
