import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Copy,
  EyeSlash,
  IdentificationCard,
  Plus,
  Trash,
  X,
  ListChecks,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  useBulkUpdateCandidates,
  useBulkDeleteCandidates,
  useCandidatesWithJob,
  useCreateCandidate,
  useDeleteCandidate,
} from "../hooks/useQueries";
import { useDebounce } from "../hooks/useDebounce";
import { useSelection } from "../hooks/useSelection";
import { useTableSort, useSortedRows, SortIcon } from "../hooks/useTableSort";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/common/EmptyState";
import { SearchInput } from "../components/common/SearchInput";
import { Spinner } from "../components/common/Spinner";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { CandidateForm } from "../components/candidates/CandidateForm";
import { StatusChangeDialog } from "../components/candidates/StatusChangeDialog";
import { StatusFilter } from "../components/candidates/StatusFilter";
import { SubmissionStatusSelect } from "../components/candidates/SubmissionStatusSelect";
import { CandidateDetailPanel } from "../components/candidates/CandidateDetailPanel";
import { DetailDrawer } from "../components/common/DetailDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { getCandidateSubStageLabel } from "../lib/candidateUtils";
import { BULK_STATUSES, submissionPalette } from "../lib/constants";
import { cn, errorMessage, formatDateShort, nameInitials, timeAgo, titleCase } from "../lib/utils";
import type { CandidateWithJob } from "../types";

const DETAIL_STATUSES = new Set(["submitted", "interview", "placed", "rejected"]);

type SortKey = "job_title" | "client_name" | "location" | "date_added" | "last_updated";

const COMPARE: (a: CandidateWithJob, b: CandidateWithJob, key: SortKey) => number = (a, b, key) => {
  if (key === "job_title") return a.job_title.localeCompare(b.job_title);
  if (key === "client_name") return a.client_name.localeCompare(b.client_name);
  if (key === "location") return (a.location ?? "").localeCompare(b.location ?? "");
  if (key === "date_added") return a.date_added.localeCompare(b.date_added);
  return a.last_updated.localeCompare(b.last_updated);
};

export function Candidates() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [status, setStatus] = useState(() => params.get("status") || "all");
  const [selectMode, setSelectMode] = useState(false);
  const { sortKey, sortDir, toggleSort } = useTableSort<SortKey>("last_updated");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    candidate: CandidateWithJob;
    status: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<CandidateWithJob | null>(null);
  const bulkUpdate = useBulkUpdateCandidates();
  const bulkDelete = useBulkDeleteCandidates();
  const createCandidate = useCreateCandidate();
  const deleteCandidate = useDeleteCandidate();

  const [hideRejected, setHideRejected] = useState(() => {
    return localStorage.getItem("recdesk_hide_rejected") === "true";
  });

  useEffect(() => {
    localStorage.setItem("recdesk_hide_rejected", hideRejected.toString());
  }, [hideRejected]);

  useEffect(() => {
    const s = params.get("status");
    if (s && s !== status) {
      setStatus(s);
    }
  }, [params]);

  const { data, isLoading } = useCandidatesWithJob(
    debounced || undefined,
    status === "all" ? undefined : status,
  );

  const sorted = useSortedRows(data, sortKey, sortDir, COMPARE);

  const displayedCandidates = useMemo(() => {
    if (!sorted) return [];
    if (!hideRejected) return sorted;
    return sorted.filter(
      (c) => c.submission_status !== "rejected" && c.submission_status !== "not_interested",
    );
  }, [sorted, hideRejected]);

  const selection = useSelection(
    displayedCandidates.map((c) => c.id),
    `${status}|${debounced}|${selectMode}|${hideRejected}`,
  );

  function handleStatusChange(candidate: CandidateWithJob, nextStatus: string) {
    if (DETAIL_STATUSES.has(nextStatus)) {
      setStatusDialog({ candidate, status: nextStatus });
      return;
    }
    bulkUpdate.mutate(
      { ids: [candidate.id], patch: { submission_status: nextStatus } },
      {
        onSuccess: () => toast.success(`${candidate.name} marked ${titleCase(nextStatus)}`),
        onError: () => toast.error("Failed to update status"),
      },
    );
  }

  function handleBulkStatus(value: string) {
    if (!selection.selected.size) return;
    const ids = Array.from(selection.selected);
    bulkUpdate.mutate(
      { ids, patch: { submission_status: value } },
      {
        onSuccess: () => {
          toast.success(`Updated ${ids.length} candidate(s) to ${titleCase(value)}`);
          selection.clear();
        },
        onError: () => toast.error("Failed to update candidates"),
      },
    );
  }

  function handleBulkDelete() {
    if (!selection.selected.size) return;
    const ids = Array.from(selection.selected);
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        toast.success(`Deleted ${ids.length} candidate(s)`);
        selection.clear();
        setBulkDeleteOpen(false);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  function handleDelete() {
    if (!deleting) return;
    deleteCandidate.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`Deleted ${deleting.name}`);
        setDeleting(null);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  const handleDuplicate = async (e: React.MouseEvent, c: CandidateWithJob) => {
    e.stopPropagation();
    try {
      const dup = await createCandidate.mutateAsync({
        job_id: c.job_id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        location: c.location ?? null,
        current_title: c.current_title ?? null,
        current_company: c.current_company ?? null,
        experience_years: c.experience_years ?? null,
        resume_path: c.resume_path ?? null,
        linkedin_url: c.linkedin_url ?? null,
        recruiter_notes: c.recruiter_notes ?? null,
        match_score: c.match_score ?? null,
        submission_status: "in_touch",
        candidate_status: "active",
        screening_answers: c.screening_answers ?? null,
        submission_details: c.submission_details ?? null,
      });
      toast.success(`Duplicated "${c.name}" — ready for new role/client`);
      openPanel(dup.id);
    } catch {
      toast.error("Failed to duplicate candidate");
    }
  };

  const filtered = status !== "all" || search.length > 0;

  function handleFilterChange(newStatus: string) {
    setStatus(newStatus);
    const next = new URLSearchParams(params);
    if (newStatus === "all") {
      next.delete("status");
    } else {
      next.set("status", newStatus);
    }
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setStatus("all");
    setSearch("");
    const next = new URLSearchParams(params);
    next.delete("status");
    setParams(next, { replace: true });
  }

  function openPanel(id: string) {
    const next = new URLSearchParams(params);
    next.set("candidate", id);
    setParams(next, { replace: true });
  }

  function closePanel() {
    const next = new URLSearchParams(params);
    next.delete("candidate");
    setParams(next, { replace: true });
  }

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Candidates
            <span className="rounded-md bg-surface-active px-2 py-0.5 text-[13px] font-medium text-fg-muted">
              {displayedCandidates.length}
            </span>
          </span>
        }
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Candidate
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search candidates…"
          className="w-full max-w-xs"
        />
        <StatusFilter
          value={status}
          onValueChange={handleFilterChange}
          filtered={filtered}
          onClear={clearFilters}
        />

        {/* Minimal Hide Rejected & Not Interested Toggle Button with Minimal Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setHideRejected((h) => !h)}
              className={cn(
                "h-8 gap-1.5 px-2.5 text-xs transition-all cursor-pointer font-medium",
                hideRejected
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/20"
                  : "text-fg-subtle hover:text-fg hover:bg-surface-hover border-border",
              )}
            >
              <EyeSlash className="h-3.5 w-3.5" />
              <span>Hide</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Hide NI &amp; Rejected</TooltipContent>
        </Tooltip>

        <div className="ml-auto">
          <Button
            size="icon"
            variant="ghost"
            title={selectMode ? "Exit select mode" : "Select candidates"}
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) selection.clear();
            }}
            className={selectMode ? "bg-surface-active text-fg" : "text-fg-muted"}
          >
            <ListChecks className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectMode && selection.selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs">
          <span className="font-medium text-fg">{selection.selected.size} selected</span>
          <div className="mx-2 h-4 w-px bg-border" />
          <Select onValueChange={handleBulkStatus}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {BULK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: submissionPalette(s).dot }} />
                    {titleCase(s)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={selection.clear}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <Spinner className="py-16" />
        ) : !displayedCandidates.length ? (
          <EmptyState
            icon={<IdentificationCard className="h-5 w-5" />}
            title="No candidates"
            description={
              debounced || status !== "all" || hideRejected
                ? "Try adjusting your search or filters."
                : "Candidates appear here when added to jobs."
            }
          />
        ) : (
          <div className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left">
                {selectMode && (
                  <th className="sticky top-0 z-10 w-10 bg-surface px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selection.allSelected}
                      onChange={selection.toggleAll}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                  </th>
                )}
                <th className="sticky top-0 z-10 w-[240px] max-w-[260px] bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted">Name</th>
                <th className="sticky top-0 z-10 max-w-[180px] bg-surface px-4 py-2.5">
                  <button
                    onClick={() => toggleSort("job_title")}
                    className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                  >
                    Job <SortIcon active={sortKey === "job_title"} dir={sortDir} />
                  </button>
                </th>
                <th className="sticky top-0 z-10 max-w-[140px] bg-surface px-4 py-2.5">
                  <button
                    onClick={() => toggleSort("client_name")}
                    className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                  >
                    Client <SortIcon active={sortKey === "client_name"} dir={sortDir} />
                  </button>
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted">Status</th>
                <th className="sticky top-0 z-10 min-w-[150px] whitespace-nowrap bg-surface px-4 py-2.5">
                  <button
                    onClick={() => toggleSort("location")}
                    className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                  >
                    Location <SortIcon active={sortKey === "location"} dir={sortDir} />
                  </button>
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-2.5">
                  <button
                    onClick={() => toggleSort("date_added")}
                    className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                  >
                    Added <SortIcon active={sortKey === "date_added"} dir={sortDir} />
                  </button>
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-2.5">
                  <button
                    onClick={() => toggleSort("last_updated")}
                    className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                  >
                    Updated <SortIcon active={sortKey === "last_updated"} dir={sortDir} />
                  </button>
                </th>
                <th className="sticky top-0 z-10 w-20 bg-surface px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedCandidates.map((c) => (
                <tr
                  key={c.id}
                  className={cn(
                    "group cursor-pointer transition-colors hover:bg-surface-hover",
                    selection.selected.has(c.id) && "bg-primary/5 hover:bg-primary/5",
                  )}
                  onClick={() => (selectMode ? selection.toggle(c.id) : openPanel(c.id))}
                >
                  {selectMode && (
                    <td className="w-10 px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selection.selected.has(c.id)}
                        onChange={() => selection.toggle(c.id)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                    </td>
                  )}
                  <td className="w-[240px] max-w-[260px] px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                        style={{
                          background: `${submissionPalette(c.submission_status).dot}1f`,
                          color: submissionPalette(c.submission_status).dot,
                        }}
                      >
                        {nameInitials(c.name)}
                      </span>
                      <div className="min-w-0 max-w-[190px]">
                        <p className="truncate text-[13px] font-medium text-fg transition-colors duration-150 group-hover:text-primary">{c.name}</p>
                        <p className="truncate text-[11px] text-fg-subtle">
                          {c.current_title ? `${c.current_title}${c.email ? ` · ${c.email}` : ""}` : c.email || ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[180px] px-4 py-2.5 text-[13px] text-fg-muted" title={c.job_title}>
                    <p className="truncate">{c.job_title}</p>
                  </td>
                  <td className="max-w-[140px] px-4 py-2.5 text-[13px] text-fg-muted" title={c.client_name}>
                    <p className="truncate">{c.client_name}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex flex-col gap-1">
                      <SubmissionStatusSelect
                        value={c.submission_status}
                        triggerClassName="h-7 w-[118px] text-[11px]"
                        onValueChange={(v) => {
                          if (v === c.submission_status) return;
                          handleStatusChange(c, v);
                        }}
                      />
                      {getCandidateSubStageLabel(c) && (
                        <span className="inline-flex items-center self-start rounded bg-surface-hover border border-border/60 px-1.5 py-0.2 text-[10px] font-medium text-fg-subtle">
                          {getCandidateSubStageLabel(c)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="min-w-[150px] whitespace-nowrap px-4 py-2.5 text-[13px] text-fg-muted">{c.location ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[13px] text-fg-muted">{formatDateShort(c.date_added)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[13px] text-fg-muted">{timeAgo(c.last_updated)}</td>
                  <td className="w-20 px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-fg-subtle hover:text-primary hover:bg-primary/10 cursor-pointer"
                            onClick={(e) => handleDuplicate(e, c)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate Candidate</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-fg-subtle hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleting(c);
                            }}
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-border bg-surface-hover/40 px-4 py-2 text-xs text-fg-subtle">
            {sorted.length} candidate{sorted.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
      </div>

      <CandidateForm open={formOpen} onOpenChange={setFormOpen} />
      {params.get("candidate") && (
        <DetailDrawer onClose={closePanel}>
          <CandidateDetailPanel candidateId={params.get("candidate")!} onClose={closePanel} />
        </DetailDrawer>
      )}
      {statusDialog && (
        <StatusChangeDialog
          candidate={statusDialog.candidate}
          initialStatus={statusDialog.status}
          onClose={() => setStatusDialog(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete candidate"
          description={`Are you sure you want to delete ${deleting.name}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
        />
      )}
      {bulkDeleteOpen && (
        <ConfirmDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          title="Delete candidates"
          description={`Are you sure you want to delete ${selection.selected.size} candidate(s)? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}
