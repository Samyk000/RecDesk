import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IdentificationCard, Plus, PencilSimple, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiCandidates } from "../lib/api";
import { useDebounce } from "../hooks/useDebounce";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { CandidateForm } from "../components/candidates/CandidateForm";
import { StatusChangeDialog } from "../components/candidates/StatusChangeDialog";
import { submissionPalette, SUBMISSION_STATUSES } from "../lib/constants";
import { errorMessage, timeAgo, titleCase } from "../lib/utils";
import { useBulkUpdateCandidates, useDeleteCandidate } from "../hooks/useQueries";
import type { CandidateWithJob } from "../types";

const DETAIL_STATUSES = new Set(["submitted", "interview", "rejected"]);

export function Candidates() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [formOpen, setFormOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    candidate: CandidateWithJob;
    status: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<CandidateWithJob | null>(null);
  const bulkUpdate = useBulkUpdateCandidates();
  const deleteCandidate = useDeleteCandidate();

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteCandidate.mutateAsync(deleting.id);
      toast.success("Candidate deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["candidatesWithJob", debounced],
    queryFn: () => apiCandidates.withJob(undefined, debounced || undefined),
  });

  function handleStatusChange(candidate: CandidateWithJob, status: string) {
    if (DETAIL_STATUSES.has(status)) {
      setStatusDialog({ candidate, status });
      return;
    }
    bulkUpdate.mutate(
      { ids: [candidate.id], patch: { submission_status: status } },
      {
        onSuccess: () => toast.success(`${candidate.name} marked ${titleCase(status)}`),
        onError: () => toast.error("Failed to update status"),
      },
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pt-4">
      <PageHeader
        title="Candidates"
        subtitle={`${data?.length ?? 0} candidates`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Candidate
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Spinner className="py-16" />
      ) : !data?.length ? (
        <EmptyState
          icon={<IdentificationCard className="h-5 w-5" />}
          title="No candidates"
          description={
            debounced
              ? "Try a different search."
              : "Candidates appear here when added to jobs."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/40 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Job</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Client</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Match</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Location</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Updated</th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((c) => (
                <tr
                  key={c.id}
                  className="group cursor-pointer transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                  onClick={() => navigate(`/candidates/${c.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                        style={{
                          background: `${submissionPalette(c.submission_status).dot}1f`,
                          color: submissionPalette(c.submission_status).dot,
                        }}
                      >
                        {c.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg transition-colors duration-150 group-hover:text-primary">{c.name}</p>
                        {c.email && (
                          <p className="truncate text-[11px] text-fg-subtle">{c.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{c.job_title}</td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{c.client_name}</td>
                  <td className="px-4 py-2.5">
                    <InlineStatus
                      candidate={c}
                      onUpdate={(v) => handleStatusChange(c, v)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-[13px] tabular-nums text-fg-muted">
                    {c.match_score != null ? c.match_score : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{c.location ?? "-"}</td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{timeAgo(c.last_updated)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/candidates/${c.id}`);
                        }}
                      >
                        <PencilSimple className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-fg-subtle hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(c);
                        }}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CandidateForm open={formOpen} onOpenChange={setFormOpen} />
      {statusDialog && (
        <StatusChangeDialog
          candidate={statusDialog.candidate}
          initialStatus={statusDialog.status}
          onClose={() => setStatusDialog(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete candidate?"
        description={`This will permanently delete "${deleting?.name}". This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function InlineStatus({
  candidate,
  onUpdate,
}: {
  candidate: CandidateWithJob;
  onUpdate: (status: string) => void;
}) {
  return (
    <Select
      value={candidate.submission_status}
      onValueChange={(v) => {
        if (v === candidate.submission_status) return;
        onUpdate(v);
      }}
    >
      <SelectTrigger
        className="h-7 w-[118px] text-[11px]"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue className="truncate" />
      </SelectTrigger>
      <SelectContent>
        {SUBMISSION_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: submissionPalette(s).dot }}
              />
              {titleCase(s)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
