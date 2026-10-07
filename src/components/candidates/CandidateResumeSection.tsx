import { useState, lazy, Suspense } from "react";
import {
  Check,
  CircleNotch,
  DotsThreeVertical,
  FileText,
  Lightning,
  Paperclip,
  PencilSimple,
  Sparkle,
  Trash,
  X,
} from "@phosphor-icons/react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAttachResume,
  useRemoveResume,
  useRenameResume,
} from "../../hooks/useQueries";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { errorMessage } from "../../lib/utils";
import { apiFiles, apiResumeParser } from "../../lib/api";
import { extractDocumentText } from "../../lib/resumeParser";
import { ResumeProfileMergeDialog } from "./ResumeProfileMergeDialog";
import type { Candidate, CandidateInput, ExtractedCandidateProfile } from "../../types";

const ResumePreviewModal = lazy(() =>
  import("./ResumePreviewModal").then((m) => ({ default: m.ResumePreviewModal }))
);

interface CandidateResumeSectionProps {
  candidate: Candidate;
  onSaveField: (patch: Partial<CandidateInput>) => void;
}

export function CandidateResumeSection({
  candidate,
  onSaveField,
}: CandidateResumeSectionProps) {
  const queryClient = useQueryClient();
  const attachResumeMut = useAttachResume();
  const removeResumeMut = useRemoveResume();
  const renameResumeMut = useRenameResume();

  const [showResumePreview, setShowResumePreview] = useState(false);
  const [isRenamingResume, setIsRenamingResume] = useState(false);
  const [resumeNewName, setResumeNewName] = useState("");
  const [showResumeMergeDialog, setShowResumeMergeDialog] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState<ExtractedCandidateProfile | null>(null);
  const [isAutoFillingResume, setIsAutoFillingResume] = useState(false);

  const resumeName = candidate.resume_path?.split(/[\\/]/).pop() ?? "";

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

  async function handleAutoFillFromResume() {
    if (!candidate.resume_path) {
      toast.error("No resume file attached to auto-fill from");
      return;
    }
    void parseAndOpenMerge(candidate.resume_path);
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

  return (
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

      <ResumeProfileMergeDialog
        candidate={candidate}
        extracted={extractedProfile}
        open={showResumeMergeDialog}
        onOpenChange={setShowResumeMergeDialog}
        onApply={(patch) => {
          onSaveField(patch);
          toast.success("Profile updated from resume!");
        }}
      />
    </div>
  );
}
