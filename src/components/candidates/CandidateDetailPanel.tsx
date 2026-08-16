import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  CalendarDots,
  FileText,
  Link,
  CircleNotch,
  Paperclip,
  Trash,
  X,
} from "@phosphor-icons/react";
import { openPath } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  useCandidate,
  useDeleteCandidate,
  useUpdateCandidate,
} from "../../hooks/useQueries";
import { apiFiles } from "../../lib/api";
import { Input, Textarea } from "../ui/input";
import { Button } from "../ui/button";
import { StatusBadge } from "../common/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SUBMISSION_STATUSES } from "../../lib/constants";
import { errorMessage, formatDate, titleCase } from "../../lib/utils";
import { Spinner } from "../common/Spinner";
import type { Candidate, CandidateInput } from "../../types";

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
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveField(patch: Partial<CandidateInput>) {
    setSaving(true);
    try {
      await update.mutateAsync({
        id: candidate.id,
        input: {
          job_id: candidate.job_id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          location: candidate.location,
          current_title: candidate.current_title,
          current_company: candidate.current_company,
          experience_years: candidate.experience_years,
          resume_path: candidate.resume_path,
          recruiter_notes: candidate.recruiter_notes,
          match_score: candidate.match_score,
          submission_status: candidate.submission_status,
          interview_status: candidate.interview_status,
          client_feedback: candidate.client_feedback,
          candidate_status: candidate.candidate_status,
          submitted_at: candidate.submitted_at,
          interview_at: candidate.interview_at,
          rejection_reason: candidate.rejection_reason,
          ...patch,
        },
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
      filters: [
        { name: "Resume", extensions: ["pdf", "doc", "docx", "txt"] },
      ],
    });
    if (!file || typeof file !== "string") return;
    try {
      await apiFiles.attachResume(candidate.id, file);
      toast.success("Resume attached");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function openResume() {
    if (!candidate.resume_path) return;
    try {
      await openPath(candidate.resume_path);
    } catch {
      toast.error("Could not open file. It may have been moved");
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

  const initials = candidate.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const status = candidate.submission_status;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-fg">{candidate.name}</h3>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {candidate.current_title ?? "No title"}
            {candidate.current_company ? ` @ ${candidate.current_company}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={candidate.submission_status} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {saving && (
          <div className="absolute right-4 top-16 flex items-center gap-1 text-[11px] text-fg-subtle">
            <CircleNotch className="h-3 w-3 animate-spin" /> Saving…
          </div>
        )}

        {/* Row 1: Email, Phone, Location */}
        <div className="grid grid-cols-3 gap-3">
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
          <InlineField
            label="Location"
            value={candidate.location ?? ""}
            onSave={(v) => saveField({ location: v || null })}
          />
        </div>

        {/* Row 2: Status + status-specific fields */}
        <div className="space-y-2">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Status</p>
            <Select
              value={status}
              onValueChange={(v) => {
                const patch: Partial<CandidateInput> = { submission_status: v };
                if (v !== "submitted") patch.submitted_at = null;
                if (v !== "interview") patch.interview_at = null;
                if (v !== "rejected") patch.rejection_reason = null;
                saveField(patch);
              }}
            >
              <SelectTrigger className="h-8 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBMISSION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === "submitted" && (
            <div className="space-y-1.5">
              <p className="text-xs text-fg-subtle">Submitted date</p>
              <input
                type="date"
                defaultValue={candidate.submitted_at ?? ""}
                onChange={(e) => saveField({ submitted_at: e.target.value || null })}
                className="h-8 w-full rounded-md border border-border bg-transparent px-3 text-[13px] text-fg outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {status === "interview" && (
            <div className="space-y-1.5">
              <p className="text-xs text-fg-subtle">Interview date & time</p>
              <input
                type="datetime-local"
                defaultValue={candidate.interview_at ?? ""}
                onChange={(e) => saveField({ interview_at: e.target.value || null })}
                className="h-8 w-full rounded-md border border-border bg-transparent px-3 text-[13px] text-fg outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {status === "rejected" && (
            <div className="space-y-1.5">
              <p className="text-xs text-fg-subtle">Rejection reason (optional)</p>
              <Input
                defaultValue={candidate.rejection_reason ?? ""}
                placeholder="Reason for rejection…"
                className="h-8 text-[13px]"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === (candidate.rejection_reason ?? "")) return;
                  saveField({ rejection_reason: v || null });
                }}
              />
            </div>
          )}
        </div>

        {/* Row 3: Comments + Resume */}
        <div className="grid grid-cols-[1fr_200px] gap-4">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Comments</p>
            <Textarea
              defaultValue={candidate.recruiter_notes ?? ""}
              rows={3}
              className="text-[13px]"
              placeholder="Notes about this candidate…"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (candidate.recruiter_notes ?? "")) return;
                saveField({ recruiter_notes: v || null });
              }}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Resume</p>
            {candidate.resume_path ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-hover px-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                  {candidate.resume_path.split(/[\\/]/).pop()}
                </span>
                <Button size="xs" variant="ghost" onClick={openResume}>
                  <Link className="h-3.5 w-3.5" />
                  Open
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await apiFiles.removeResume(candidate.id);
                      toast.success("Resume reference removed");
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  }}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={attachResume} className="w-full">
                <Paperclip className="h-4 w-4" />
                Attach resume
              </Button>
            )}
          </div>
        </div>

        {/* Date added */}
        <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
          <CalendarDots className="h-3 w-3" />
          Added {formatDate(candidate.date_added)}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        {!embedded && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/jobs/${candidate.job_id}`)}
            className="text-xs"
          >
            <Briefcase className="h-3.5 w-3.5" />
            View job
          </Button>
        )}
        <div className={embedded ? "w-full" : ""}></div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              Confirm delete
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
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
