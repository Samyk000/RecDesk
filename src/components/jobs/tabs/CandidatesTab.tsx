import { useMemo, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  FileUser,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCandidates, useBulkUpdateCandidates } from "../../../hooks/useQueries";
import { useDebounce } from "../../../hooks/useDebounce";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { EmptyState } from "../../common/EmptyState";
import { StatusBadge } from "../../common/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { CandidateForm } from "../../candidates/CandidateForm";
import { CandidateDetailPanel } from "../../candidates/CandidateDetailPanel";
import { SUBMISSION_STATUSES, matchColor, submissionPalette } from "../../../lib/constants";
import { cn, formatDateShort, timeAgo, titleCase } from "../../../lib/utils";
import type { Candidate } from "../../../types";

type SortKey = "name" | "match_score" | "date_added" | "last_updated";

export function CandidatesTab({ jobId }: { jobId: string }) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelId, setPanelId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const bulkUpdate = useBulkUpdateCandidates();

  const { data: candidates, isLoading } = useCandidates(
    jobId,
    status === "all" ? undefined : status,
    debounced || undefined,
  );

  const sorted = useMemo(() => {
    if (!candidates) return [];
    const arr = [...candidates];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "match_score") cmp = (a.match_score ?? -1) - (b.match_score ?? -1);
      else if (sortKey === "date_added") cmp = a.date_added.localeCompare(b.date_added);
      else cmp = a.last_updated.localeCompare(b.last_updated);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [candidates, sortKey, sortDir]);

  const allIds = sorted.map((c) => c.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkStatus(newStatus: string) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      await bulkUpdate.mutateAsync({ ids, patch: { submission_status: newStatus } });
      toast.success(`${ids.length} candidate(s) marked ${titleCase(newStatus)}`);
      clearSelection();
    } catch {
      toast.error("Bulk update failed");
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-fg-subtle" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-44 text-[13px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SUBMISSION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {titleCase(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Add candidate
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 animate-slide-up">
          <span className="text-[13px] font-medium text-fg">
            {selected.size} selected
          </span>
          <Select value="" onValueChange={bulkStatus}>
            <SelectTrigger className="h-8 w-44 text-[13px]">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {SUBMISSION_STATUSES.map((s) => (
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
            onClick={() => {
              // Bulk delete handled via per-row for safety; clear instead
              clearSelection();
              toast.info("Use row actions to delete individual candidates");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
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
          icon={<FileUser className="h-5 w-5" />}
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
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-raise">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/40 text-left">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                </th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("name")} className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
                    Name <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-fg-muted">Current role</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-fg-muted">Location</th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("match_score")} className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
                    Match <SortIcon col="match_score" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-fg-muted">Status</th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("date_added")} className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
                    Added <SortIcon col="date_added" />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("last_updated")} className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
                    Updated <SortIcon col="last_updated" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((cand) => (
                <CandidateRow
                  key={cand.id}
                  candidate={cand}
                  selected={selected.has(cand.id)}
                  onToggle={() => toggle(cand.id)}
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
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/25 animate-fade-in" onClick={() => setPanelId(null)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface shadow-popover animate-slide-in-right">
            <CandidateDetailPanel candidateId={panelId} onClose={() => setPanelId(null)} embedded />
          </div>
        </div>
      )}
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{
              background: `${submissionPalette(candidate.submission_status).dot}1f`,
              color: submissionPalette(candidate.submission_status).dot,
            }}
          >
            {candidate.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
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
          {candidate.current_title ?? "—"}
          {candidate.current_company && (
            <span className="text-fg-subtle"> @ {candidate.current_company}</span>
          )}
        </p>
      </td>
      <td className="px-3 py-2.5 text-[13px] text-fg-muted">{candidate.location ?? "—"}</td>
      <td className="px-3 py-2.5">
        {candidate.match_score != null ? (
          <span className={cn("text-[13px] font-semibold tabular-nums", matchColor(candidate.match_score))}>
            {candidate.match_score}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </td>
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