import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Clock,
  FileUser,
  Plus,
} from "lucide-react";
import { useDashboardStats } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/common/PageHeader";
import { jobPalette, submissionPalette } from "../lib/constants";
import { cn, formatDateShort, timeAgo, titleCase } from "../lib/utils";

export function Dashboard() {
  const { data, isLoading } = useDashboardStats();
  const navigate = useNavigate();

  if (isLoading || !data) return <PageLoader label="Loading workspace…" />;

  const isEmpty = data.total_jobs === 0;

  const stats = [
    {
      label: "Active jobs",
      value: data.active_jobs,
      icon: Briefcase,
      accent: "text-blue-500",
      bg: "bg-blue-500/12 dark:bg-blue-500/20",
      to: "/jobs",
    },
    {
      label: "Total candidates",
      value: data.total_candidates,
      icon: FileUser,
      accent: "text-violet-500",
      bg: "bg-violet-500/12 dark:bg-violet-500/20",
      to: "/jobs",
    },
    {
      label: "Needing action",
      value: data.candidates_needing_action,
      icon: Clock,
      accent: "text-amber-500",
      bg: "bg-amber-500/12 dark:bg-amber-500/20",
      to: "/jobs",
    },
    {
      label: "Clients",
      value: data.total_clients,
      icon: Building2,
      accent: "text-emerald-500",
      bg: "bg-emerald-500/12 dark:bg-emerald-500/20",
      to: "/clients",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="Workspace"
        subtitle={isEmpty ? "Start by creating your first job." : `Everything recruiting · ${formatDateShort(new Date().toISOString())}`}
      />

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="group rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.bg)}>
                <s.icon className={cn("h-[18px] w-[18px]", s.accent)} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-fg">
              {s.value}
            </p>
            <p className="mt-0.5 text-[13px] text-fg-muted">{s.label}</p>
          </Link>
        ))}
      </div>

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title="No jobs yet"
            description="Create a client, add a job, then start tracking candidates — everything lives in one place."
            action={
              <Button
                variant="primary"
                onClick={() => navigate("/jobs?new=1")}
              >
                <Plus className="h-4 w-4" />
                Create your first job
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Section
            title="Recent jobs"
            to="/jobs"
            empty={<p className="text-[13px] text-fg-subtle">No jobs yet.</p>}
          >
            <div className="divide-y divide-border">
              {data.recent_jobs.slice(0, 6).map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `${jobPalette(job.status).dot}1a`, color: jobPalette(job.status).dot }}
                  >
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg">{job.title}</span>
                    <span className="block truncate text-xs text-fg-subtle">
                      {job.client_name} · {job.job_id} · {job.candidate_count} candidates
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-fg-subtle">{timeAgo(job.updated_at)}</span>
                </Link>
              ))}
            </div>
          </Section>

          <Section
            title="Recent candidates"
            to="/jobs"
            empty={<p className="text-[13px] text-fg-subtle">No candidates yet.</p>}
          >
            <div className="divide-y divide-border">
              {data.recent_candidates.slice(0, 6).map((cand) => (
                <Link
                  key={cand.id}
                  to={`/candidates/${cand.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      background: `${submissionPalette(cand.submission_status).dot}1a`,
                      color: submissionPalette(cand.submission_status).dot,
                    }}
                  >
                    {cand.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg">{cand.name}</span>
                    <span className="block truncate text-xs text-fg-subtle">
                      {cand.current_title ? `${cand.current_title} · ` : ""}
                      {cand.current_company ?? "—"}
                    </span>
                  </span>
                  <StatusBadge status={cand.submission_status} className="shrink-0" />
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Section title="Pipeline" to="/jobs">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-active">
            {data.candidates_by_status.map((s) => {
              const p = submissionPalette(s.status);
              const pct = data.total_candidates ? (s.count / data.total_candidates) * 100 : 0;
              return (
                <div
                  key={s.status}
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, background: p.dot }}
                  title={`${titleCase(s.status)}: ${s.count}`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {data.candidates_by_status.map((s) => {
              const p = submissionPalette(s.status);
              return (
                <span key={s.status} className="flex items-center gap-1.5 text-xs text-fg-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.dot }} />
                  {titleCase(s.status)}
                  <span className="font-medium tabular-nums text-fg">{s.count}</span>
                </span>
              );
            })}
          </div>
        </Section>

        <Section title="Jobs by status" to="/jobs">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {data.jobs_by_status.map((s) => (
              <Link key={s.status} to={`/jobs?status=${s.status}`} className="group flex items-center gap-2">
                <span className="text-2xl font-semibold tabular-nums text-fg">{s.count}</span>
                <span className="text-[13px] text-fg-muted">{titleCase(s.status)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  to,
  children,
  empty,
}: {
  title: string;
  to: string;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
        <Link
          to={to}
          className="flex items-center gap-1 text-xs font-medium text-fg-muted transition-colors hover:text-primary"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children ?? empty}
    </div>
  );
}