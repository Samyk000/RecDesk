import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Briefcase, Plus } from "@phosphor-icons/react";
import { useJobs, useMoveJob } from "../hooks/useQueries";
import { useFlipList } from "../hooks/useFlipList";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { SearchInput } from "../components/common/SearchInput";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/common/PageHeader";
import { JobFormDialog } from "../components/jobs/JobFormDialog";
import { JOB_STATUSES, jobPalette } from "../lib/constants";
import { cn, timeAgo, titleCase } from "../lib/utils";
import { useDebounce } from "../hooks/useDebounce";

export function Jobs() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading } = useJobs(undefined, status || undefined, debounced || undefined);
  const moveJob = useMoveJob();
  const flipRef = useFlipList();
  const canReorder = !status && !debounced;

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
            active={status === ""}
            onClick={() => setParams((p) => {
              const n = new URLSearchParams(p);
              n.delete("status");
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
      </div>

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
          <div className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <div ref={flipRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <div className="divide-y divide-border">
            {data.map((job, i) => (
              <Link
                key={job.id}
                data-flip-id={job.id}
                to={`/jobs/${job.id}`}
                className="group flex cursor-pointer items-center gap-4 px-4 py-3 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-fg transition-colors duration-150 group-hover:text-primary">{job.title}</p>
                    <StatusBadge status={job.status} kind="job" className="shrink-0" />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">
                    <span className="font-mono text-[11px]">{job.job_id}</span>
                    <span className="mx-1.5">·</span>
                    {job.client_name}
                    {job.location && (
                      <>
                        <span className="mx-1.5">·</span>
                        {job.location}
                        {job.work_model && ` (${job.work_model})`}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-5 text-right">
                  <div>
                    <p className="text-[13px] font-semibold tabular-nums text-fg">{job.candidate_count}</p>
                    <p className="text-[11px] text-fg-subtle">candidates</p>
                  </div>
                  <div className="w-16">
                    <p className="text-xs text-fg-muted">{timeAgo(job.updated_at)}</p>
                    <p className="text-[11px] text-fg-subtle">updated</p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Move up"
                      disabled={!canReorder || i === 0 || moveJob.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        moveJob.mutate({ id: job.id, direction: -1 });
                      }}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={!canReorder || i === data.length - 1 || moveJob.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        moveJob.mutate({ id: job.id, direction: 1 });
                      }}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
            </div>
            </div>
          </div>
        )}
      </div>

      <JobFormDialog open={formOpen} onOpenChange={setFormOpen} />
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