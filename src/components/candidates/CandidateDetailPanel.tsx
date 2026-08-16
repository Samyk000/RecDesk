import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  CalendarDays,
  Check,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
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
import { CANDIDATE_STATUSES, SUBMISSION_STATUSES, matchColor } from "../../lib/constants";
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
  return (
    <CandidatePanelBody key={candidate.id} candidate={candidate} onClose={onClose} embedded={embedded} />
  );
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
      toast.error("Could not open file — it may have been moved");
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
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
            {candidate.match_score != null && (
              <span className={`text-xs font-semibold ${matchColor(candidate.match_score)}`}>
                {candidate.match_score}% match
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin">
        {saving && (
          <div className="absolute right-4 top-16 flex items-center gap-1 text-[11px] text-fg-subtle">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </div>
        )}

        <Section title="Contact">
          <Field
            label="Email"
            value={candidate.email ?? ""}
            onSave={(v) => saveField({ email: v || null })}
          />
          <Field label="Phone" value={candidate.phone ?? ""} onSave={(v) => saveField({ phone: v || null })} />
          <Field label="Location" value={candidate.location ?? ""} onSave={(v) => saveField({ location: v || null })} />
        </Section>

        <Section title="Current role">
          <Field
            label="Current title"
            value={candidate.current_title ?? ""}
            onSave={(v) => saveField({ current_title: v || null })}
          />
          <Field
            label="Company"
            value={candidate.current_company ?? ""}
            onSave={(v) => saveField({ current_company: v || null })}
          />
          <Field
            label="Experience (years)"
            value={candidate.experience_years != null ? String(candidate.experience_years) : ""}
            type="number"
            onSave={(v) => saveField({ experience_years: v ? Number(v) : null })}
          />
        </Section>

        <Section title="Recruiting">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Submission status</p>
            <Select
              value={candidate.submission_status}
              onValueChange={(v) => saveField({ submission_status: v })}
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
          <Field
            label="Interview status"
            value={candidate.interview_status ?? ""}
            onSave={(v) => saveField({ interview_status: v || null })}
          />
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Candidate status</p>
            <Select
              value={candidate.candidate_status}
              onValueChange={(v) => saveField({ candidate_status: v })}
            >
              <SelectTrigger className="h-8 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANDIDATE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Match score</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                defaultValue={candidate.match_score ?? ""}
                onBlur={(e) => {
                  const v = e.target.value;
                  if ((v ? Number(v) : null) === candidate.match_score) return;
                  saveField({ match_score: v ? Math.min(100, Math.max(0, Number(v))) : null });
                }}
                className="h-8 w-24 text-[13px]"
              />
              <span className="text-xs text-fg-subtle">/ 100</span>
            </div>
          </div>
        </Section>

        <Section title="Resume">
          {candidate.resume_path ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-hover px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                {candidate.resume_path.split(/[\\/]/).pop()}
              </span>
              <Button size="xs" variant="ghost" onClick={openResume}>
                <Link2 className="h-3.5 w-3.5" />
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
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={attachResume} className="w-full">
              <Paperclip className="h-4 w-4" />
              Attach resume
            </Button>
          )}
        </Section>

        <Section title="Notes & feedback">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Recruiter notes</p>
            <Textarea
              defaultValue={candidate.recruiter_notes ?? ""}
              rows={4}
              className="text-[13px]"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (candidate.recruiter_notes ?? "")) return;
                saveField({ recruiter_notes: v || null });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-fg-subtle">Client feedback</p>
            <Textarea
              defaultValue={candidate.client_feedback ?? ""}
              rows={3}
              className="text-[13px]"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (candidate.client_feedback ?? "")) return;
                saveField({ client_feedback: v || null });
              }}
            />
          </div>
        </Section>

        <div className="space-y-1.5 rounded-lg border border-border bg-surface-hover/50 p-3">
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            <CalendarDays className="h-3.5 w-3.5" />
            Added {formatDate(candidate.date_added)}
          </div>
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            <Check className="h-3.5 w-3.5" />
            Updated {formatDate(candidate.last_updated)}
          </div>
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
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
  type = "text",
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-fg-subtle">{label}</p>
      <Input
        ref={ref}
        type={type}
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