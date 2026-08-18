import { useState } from "react";
import {
  ArrowUp,
  IdentificationCard,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  useCandidates,
  useBulkUpdateCandidates,
  useBulkDeleteCandidates,
} from "../../../hooks/useQueries";
import { useDebounce } from "../../../hooks/useDebounce";
import { useSelection } from "../../../hooks/useSelection";
import { useTableSort, useSortedRows, SortIcon } from "../../../hooks/useTableSort";
import { Button } from "../../ui/button";
import { EmptyState } from "../../common/EmptyState";
import { SearchInput } from "../../common/SearchInput";
import { StatusBadge } from "../../common/StatusBadge";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { CandidateForm } from "../../candidates/CandidateForm";
import { CandidateDetailPanel } from "../../candidates/CandidateDetailPanel";
import { StatusFilter } from "../../candidates/StatusFilter";
import { DetailDrawer } from "../../common/DetailDrawer";
import { BULK_STATUSES, submissionPalette } from "../../../lib/constants";
import { cn, formatDateShort, nameInitials, timeAgo, titleCase } from "../../../lib/utils";
import type { Candidate } from "../../../types";

type SortKey = "date_added" | "last_updated";

const COMPARE: (a: Candidate, b: Candidate, key: SortKey) => number = (a, b, key) =>
  key === "date_added"
    ? a.date_added.localeCompare(b.date_added)
    : a.last_updated.localeCompare(b.last_updated);

export function CandidatesTab({ jobId }: { jobId: string }) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [status, setStatus] = useState("all");
  const { sortKey, sortDir, toggleSort } = useTableSort<SortKey>("last_updated");
  const [panelId, setPanelId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const bulkUpdate = useBulkUpdateCandidates();
  const bulkDelete = useBulkDeleteCandidates();

  const { data: candidates, isLoading } = useCandidates(
    jobId,
    status === "all" ? undefined : status,
    debounced || undefined,
  );

  const sorted = useSortedRows(candidates, sortKey, sortDir, COMPARE);

  const selection = useSelection(
    sorted.map((c) => c.id),
    `${status}|${debounced}`,
  );

  const filtered = status !== "all" || search.length > 0;

  function clearFilters() {
    setStatus("all");
    setSearch("");
  }

  async function bulkStatus(newStatus: string) {
    const ids = Array.from(selection.selected);
    if (!ids.length) return;
    try {
      await bulkUpdate.mutateAsync({ ids, patch: { submission_status: newStatus } });
      toast.success(`${ids.length} candidate(s) marked ${titleCase(newStatus)}`);
      selection.clear();
    } catch {
      toast.error("Bulk update failed");
    }
  }

  async function confirmBulkDelete() {
    try {
      await bulkDelete.mutateAsync(Array.from(selection.selected));
      toast.success("Candidates deleted");
      selection.clear();
      setDeleteOpen(false);
    } catch {
      toast.error("Bulk delete failed");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search candidates…"
          className="w-full max-w-xs"
        />
        <StatusFilter
          value={status}
          onValueChange={setStatus}
          filtered={filtered}
          onClear={clearFilters}
        />
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Add candidate
          </Button>
        </div>
      </div>

      {selection.selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 animate-slide-up">
          <span className="text-[13px] font-medium text-fg">
            {selection.selected.size} selected
          </span>
          <Select value="" onValueChange={bulkStatus}>
            <SelectTrigger className="h-8 w-44 text-[13px]">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {BULK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {titleCase(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={selection.clear}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
        </div>
      ) : !sorted.length ? (
        <EmptyState
          icon={<IdentificationCard className="h-5 w-5" />}
          title="No candidates"
          description={
            search || status !== "all"
              ? "Try adjusting your search or filters."
              : "Add candidates to start tracking this job's pipeline."
          }
          action={
            !search && status === "all" ? (
              <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Add candidate
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/40 text-left">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selection.allSelected}
                    onChange={selection.toggleAll}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-fg-muted">Name</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-fg-muted">Current role</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-fg-muted">Location</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-fg-muted">Status</th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("date_added")} className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
                    Added <SortIcon active={sortKey === "date_added"} dir={sortDir} />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("last_updated")} className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
                    Updated <SortIcon active={sortKey === "last_updated"} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((cand) => (
                <CandidateRow
                  key={cand.id}
                  candidate={cand}
                  selected={selection.selected.has(cand.id)}
                  onToggle={() => selection.toggle(cand.id)}
                  onOpen={() => setPanelId(cand.id)}
                />
              ))}
            </tbody>
          </table>
          <div className="border-t border-border bg-surface-hover/40 px-4 py-2 text-xs text-fg-subtle">
            {sorted.length} candidate{sorted.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <CandidateForm open={formOpen} onOpenChange={setFormOpen} jobId={jobId} />

      {panelId && (
        <DetailDrawer onClose={() => setPanelId(null)}>
          <CandidateDetailPanel candidateId={panelId} onClose={() => setPanelId(null)} embedded />
        </DetailDrawer>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
        title="Delete candidates?"
        description={`This will permanently delete ${selection.selected.size} candidate(s). This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={bulkDelete.isPending}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  onToggle,
  onOpen,
}: {
  candidate: Candidate;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <tr
      className={cn(
        "group cursor-pointer transition-colors hover:bg-surface-hover",
        selected && "bg-primary/5 hover:bg-primary/5",
      )}
      onClick={onOpen}
    >
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
        />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
            style={{
              background: `${submissionPalette(candidate.submission_status).dot}1f`,
              color: submissionPalette(candidate.submission_status).dot,
            }}
          >
            {nameInitials(candidate.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-fg">{candidate.name}</p>
            {candidate.email && (
              <p className="truncate text-[11px] text-fg-subtle">{candidate.email}</p>
            )}
          </div>
        </div>
      </td>
      <td className="max-w-[180px] px-3 py-2.5">
        <p className="truncate text-[13px] text-fg-muted">
          {candidate.current_title ?? "-"}
          {candidate.current_company && (
            <span className="text-fg-subtle"> @ {candidate.current_company}</span>
          )}
        </p>
      </td>
      <td className="px-3 py-2.5 text-[13px] text-fg-muted">{candidate.location ?? "-"}</td>
      <td className="px-3 py-2.5">
        <StatusBadge status={candidate.submission_status} />
      </td>
      <td className="px-3 py-2.5 text-[13px] text-fg-muted">{formatDateShort(candidate.date_added)}</td>
      <td className="px-3 py-2.5 text-[13px] text-fg-muted">
        <span className="flex items-center gap-1">
          {timeAgo(candidate.last_updated)}
          <ArrowUp className="h-3 w-3 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
      </td>
    </tr>
  );
}