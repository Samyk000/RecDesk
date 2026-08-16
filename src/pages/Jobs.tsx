import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Briefcase, Plus, Search } from "lucide-react";
import { useJobs } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="Jobs"
        subtitle={`${data?.length ?? 0} positions`}
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
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="pl-9"
          />
        </div>
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
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="divide-y divide-border">
            {data.map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-hover"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${jobPalette(job.status).dot}1a`, color: jobPalette(job.status).dot }}
                >
                  <Briefcase className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-fg">{job.title}</p>
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
                    <p className="text-sm font-semibold tabular-nums text-fg">{job.candidate_count}</p>
                    <p className="text-[11px] text-fg-subtle">candidates</p>
                  </div>
                  <div className="w-16">
                    <p className="text-xs text-fg-muted">{timeAgo(job.updated_at)}</p>
                    <p className="text-[11px] text-fg-subtle">updated</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
        "flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
        active ? "bg-fg text-bg" : "text-fg-muted hover:bg-surface-hover hover:text-fg",
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {label}
    </button>
  );
}