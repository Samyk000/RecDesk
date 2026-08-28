import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, Plus } from "@phosphor-icons/react";
import { useJobs } from "../hooks/useQueries";
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
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  // Default to "active" if no status query param is present
  const status = statusParam !== null ? statusParam : "active";
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading } = useJobs(
    undefined,
    status === "all" ? undefined : status || undefined,
    debounced || undefined,
  );

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
          <div className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left">
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted">Job Title</th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted whitespace-nowrap">Job ID</th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted">Client</th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted whitespace-nowrap">Location</th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-xs font-semibold text-fg-muted">Status</th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-right text-xs font-semibold text-fg-muted whitespace-nowrap">Candidates</th>
                    <th className="sticky top-0 z-10 bg-surface px-4 py-2.5 text-right text-xs font-semibold text-fg-muted whitespace-nowrap">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="group cursor-pointer transition-colors hover:bg-surface-hover"
                    >
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