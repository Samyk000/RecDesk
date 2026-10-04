import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, Clock, ListChecks, Plus, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useJobs, useBulkUpdateJobs, useBulkDeleteJobs } from "../hooks/useQueries";
import { useTableSort, useSortedRows, SortIcon } from "../hooks/useTableSort";
import { useSelection } from "../hooks/useSelection";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { SearchInput } from "../components/common/SearchInput";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { JobFormDialog } from "../components/jobs/JobFormDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { JOB_STATUSES, jobPalette } from "../lib/constants";
import { cn, errorMessage, timeAgo, titleCase } from "../lib/utils";
import { useDebounce } from "../hooks/useDebounce";
import type { JobWithStats } from "../types";

type JobSortKey = "title" | "job_id" | "client_name" | "candidate_count" | "updated_at";

const COMPARE_JOBS: (a: JobWithStats, b: JobWithStats, key: JobSortKey) => number = (a, b, key) => {
  if (key === "title") return a.title.localeCompare(b.title);
  if (key === "job_id") return a.job_id.localeCompare(b.job_id);
  if (key === "client_name") return a.client_name.localeCompare(b.client_name);
  if (key === "candidate_count") return (a.candidate_count ?? 0) - (b.candidate_count ?? 0);
  return a.updated_at.localeCompare(b.updated_at);
};

export function Jobs() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  // Default to "active" if no status query param is present
  const status = statusParam !== null ? statusParam : "active";
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [formOpen, setFormOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { sortKey, sortDir, toggleSort } = useTableSort<JobSortKey>("updated_at");
  const { data, isLoading } = useJobs(
    undefined,
    status === "all" ? undefined : status || undefined,
    debounced || undefined,
  );
  const sortedJobs = useSortedRows(data, sortKey, sortDir, COMPARE_JOBS);
  const selection = useSelection(
    sortedJobs.map((j) => j.id),
    `${status}|${debounced}|${selectMode}`,
  );
  const bulkUpdate = useBulkUpdateJobs();
  const bulkDelete = useBulkDeleteJobs();

  function handleBulkStatus(nextStatus: string) {
    if (!selection.selected.size) return;
    const ids = Array.from(selection.selected);
    bulkUpdate.mutate(
      { ids, status: nextStatus },
      {
        onSuccess: () => {
          toast.success(`Updated ${ids.length} job(s) to ${titleCase(nextStatus)}`);
          selection.clear();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  function handleBulkDelete() {
    if (!selection.selected.size) return;
    const ids = Array.from(selection.selected);
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        toast.success(`Deleted ${ids.length} job(s)`);
        selection.clear();
        setBulkDeleteOpen(false);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  useEffect(() => {
    if (params.get("new")) {
      setFormOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Jobs
            <span className="rounded-md bg-surface-active px-2 py-0.5 text-[13px] font-medium text-fg-muted">
              {data?.length ?? 0}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search jobs…"
          className="w-full max-w-sm"
        />
        <div className="flex items-center gap-1">
          <FilterChip
            active={status === "all"}
            onClick={() => setParams((p) => {
              const n = new URLSearchParams(p);
              n.set("status", "all");
              return n;
            })}
            label="All"
          />
          {JOB_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setParams((p) => {
                const n = new URLSearchParams(p);
                n.set("status", s);
                return n;
              })}
              label={titleCase(s)}
              dot={jobPalette(s).dot}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 text-xs font-medium text-fg-muted hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-fg transition-all cursor-pointer shadow-2xs"
              >
                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="hidden sm:inline">Auto-hold: 2w</span>
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="end"
              className="max-w-xs p-3 bg-surface text-fg border border-border shadow-xl rounded-lg z-50 pointer-events-none"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
                <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                <span>14-Day Auto-Hold Policy</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-muted font-normal">
                Active jobs with no candidate activity or updates for <strong>14 days (2 weeks)</strong> automatically move to <strong className="text-amber-500 font-medium">On Hold</strong> to keep your pipeline clean and focused.
              </p>
              <p className="mt-1.5 text-[10px] text-fg-subtle border-t border-border/50 pt-1.5 font-medium">
                Any candidate submission or job update resets the 14-day timer.
              </p>
            </TooltipContent>
          </Tooltip>

          <Button
            size="icon"
            variant="ghost"
            title={selectMode ? "Exit select mode" : "Select jobs"}
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
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">
          <span className="font-medium text-fg">{selection.selected.size} selected</span>
          <div className="mx-2 h-4 w-px bg-border" />
          <Select onValueChange={handleBulkStatus}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: jobPalette(s).dot }} />
                    {titleCase(s)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBulkDeleteOpen(true)}
            className="h-7 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
            title="Delete selected jobs"
          >
            <Trash className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={selection.clear}
            className="h-7 text-xs text-fg-subtle hover:text-fg ml-auto cursor-pointer"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <PageLoader />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title="No jobs found"
            description={search ? "Try a different search." : "Create your first job to start recruiting."}
            action={
              !search ? (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Job
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left">
                    {selectMode && (
                      <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={selection.allSelected}
                          onChange={selection.toggleAll}
                          className="rounded border-border accent-primary cursor-pointer"
                        />
                      </th>
                    )}
                    <th
                      onClick={() => toggleSort("title")}
                      className="group sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted cursor-pointer select-none hover:text-fg transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Job Title</span>
                        <SortIcon active={sortKey === "title"} dir={sortDir} />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("job_id")}
                      className="group sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted whitespace-nowrap cursor-pointer select-none hover:text-fg transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Job ID</span>
                        <SortIcon active={sortKey === "job_id"} dir={sortDir} />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("client_name")}
                      className="group sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted cursor-pointer select-none hover:text-fg transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Client</span>
                        <SortIcon active={sortKey === "client_name"} dir={sortDir} />
                      </div>
                    </th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted whitespace-nowrap">Location</th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted">Status</th>
                    <th
                      onClick={() => toggleSort("candidate_count")}
                      className="group sticky top-0 z-10 bg-surface px-4 py-2.5 text-right text-xs font-semibold text-fg-muted whitespace-nowrap cursor-pointer select-none hover:text-fg transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Candidates</span>
                        <SortIcon active={sortKey === "candidate_count"} dir={sortDir} />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("updated_at")}
                      className="group sticky top-0 z-10 bg-surface px-4 py-2.5 text-right text-xs font-semibold text-fg-muted whitespace-nowrap cursor-pointer select-none hover:text-fg transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Updated</span>
                        <SortIcon active={sortKey === "updated_at"} dir={sortDir} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => {
                        if (selectMode) {
                          selection.toggle(job.id);
                        } else {
                          navigate(`/jobs/${job.id}`);
                        }
                      }}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-surface-hover",
                        selectMode && selection.selected.has(job.id) && "bg-surface-active/50",
                      )}
                    >
                      {selectMode && (
                        <td className="px-4 py-2.5 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selection.selected.has(job.id)}
                            onChange={() => selection.toggle(job.id)}
                            className="rounded border-border accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-[13px] font-medium text-fg group-hover:text-primary transition-colors">
                        <div className="truncate max-w-[280px]">
                          {job.title}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-fg-muted whitespace-nowrap">
                        {job.job_id}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-fg-muted truncate max-w-[180px]">
                        {job.client_name}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-fg-muted whitespace-nowrap">
                        {job.location ? (
                          <span>
                            {job.location}
                            {job.work_model && <span className="text-fg-subtle"> ({job.work_model})</span>}
                          </span>
                        ) : (
                          <span className="text-fg-subtle">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusBadge status={job.status} kind="job" />
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-fg whitespace-nowrap">
                        {job.candidate_count}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-fg-muted whitespace-nowrap">
                        {timeAgo(job.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <JobFormDialog open={formOpen} onOpenChange={setFormOpen} />
      {bulkDeleteOpen && (
        <ConfirmDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          title="Delete jobs"
          description={`Are you sure you want to delete ${selection.selected.size} job(s) and their associated candidates? This action cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-all duration-150",
        active ? "bg-fg text-bg shadow-raise" : "text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active",
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {label}
    </button>
  );
}