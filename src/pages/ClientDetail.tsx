import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, PencilSimple, Plus } from "@phosphor-icons/react";
import { useClient, useJobs } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/common/PageHeader";
import { ClientForm } from "../components/clients/ClientForm";
import { JobFormDialog } from "../components/jobs/JobFormDialog";
import { jobPalette } from "../lib/constants";
import { formatDateTime, timeAgo } from "../lib/utils";
import type { ClientWithStats } from "../types";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id);
  if (isLoading || !client) return <PageLoader label="Loading client…" />;
  return <ClientDetailBody key={client.id} client={client} />;
}

function ClientDetailBody({ client }: { client: ClientWithStats }) {
  const navigate = useNavigate();
  const { data: jobs } = useJobs(client.id);
  const [editOpen, setEditOpen] = useState(false);
  const [newJobOpen, setNewJobOpen] = useState(false);

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/clients"))}
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </button>

      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate">{client.name}</span>
            <span className="shrink-0 whitespace-nowrap text-[13px] font-normal text-fg-muted">
              {formatDateTime(client.created_at)}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilSimple className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="primary" onClick={() => setNewJobOpen(true)}>
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </>
        }
      />

      <section className="flex min-h-0 flex-1 flex-col">
        <h2 className="font-display mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
          <Briefcase className="h-4 w-4 text-fg-subtle" />
          Jobs
          <span className="rounded-md bg-surface-active px-2 py-0.5 text-[11px] font-medium text-fg-muted">
            {jobs?.length ?? 0}
          </span>
        </h2>

        {!jobs || jobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title="No jobs for this client yet"
            description="Create a job to start tracking candidates for this client."
            action={
              <Button variant="primary" size="sm" onClick={() => setNewJobOpen(true)}>
                <Plus className="h-4 w-4" />
                New Job
              </Button>
            }
          />
        ) : (
          <div className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_110px_80px_80px] items-center gap-4 border-b border-border bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              <span>Job</span>
              <span>Location</span>
              <span>Status</span>
              <span className="text-right">Candidates</span>
              <span className="text-right">Updated</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <div className="divide-y divide-border">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="group grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_110px_80px_80px] items-center gap-4 px-4 py-2.5 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: jobPalette(job.status).dot }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-fg transition-colors duration-150 group-hover:text-primary">{job.title}</span>
                      <span className="block truncate font-mono text-[11px] text-fg-subtle">{job.job_id}</span>
                    </span>
                  </div>
                  <span className="truncate text-[13px] text-fg-muted">{job.location ?? "-"}</span>
                  <StatusBadge status={job.status} kind="job" />
                  <span className="text-right text-[13px] font-semibold tabular-nums text-fg">{job.candidate_count}</span>
                  <span className="text-right text-xs text-fg-muted">{timeAgo(job.updated_at)}</span>
                </Link>
              ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <ClientForm open={editOpen} onOpenChange={setEditOpen} client={client} key={client.id} />
      <JobFormDialog open={newJobOpen} onOpenChange={setNewJobOpen} defaultClientId={client.id} />
    </div>
  );
}