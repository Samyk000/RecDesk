import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Building,
  Clock,
  IdentificationCard,
  Plus,
} from "@phosphor-icons/react";
import { useDashboardStats } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/common/PageHeader";
import { jobPalette, submissionPalette } from "../lib/constants";
import { cn, formatZoneTime, greetingLine, nameInitials, timeAgo, titleCase } from "../lib/utils";
import { useProfile } from "../store/profile";

export function Dashboard() {
  const { data, isLoading } = useDashboardStats();
  const navigate = useNavigate();
  const { name } = useProfile();

  if (isLoading || !data) return <PageLoader label="Loading workspace…" />;

  const isEmpty = data.total_jobs === 0;

  const stats = [
    {
      label: "Active jobs",
      value: data.active_jobs,
      icon: Briefcase,
      accent: "text-blue-500",
      to: "/jobs",
    },
    {
      label: "Total candidates",
      value: data.total_candidates,
      icon: IdentificationCard,
      accent: "text-violet-500",
      to: "/candidates",
    },
    {
      label: "Needing action",
      value: data.candidates_needing_action,
      icon: Clock,
      accent: "text-amber-500",
      to: "/candidates",
    },
    {
      label: "Clients",
      value: data.total_clients,
      icon: Building,
      accent: "text-emerald-500",
      to: "/clients",
    },
  ];

  return (
    <div className="px-6 pt-4 pb-6">
      <PageHeader
        title={greetingLine(name)}
        subtitle={isEmpty ? "Start by creating your first job." : undefined}
        actions={<ZoneClock />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            to={s.to}
            style={{ animationDelay: `${i * 40}ms` }}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-float hover:border-border-strong animate-stagger active:scale-[0.99]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-active transition-colors duration-150 group-hover:bg-surface-hover">
              <s.icon className={cn("h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110", s.accent)} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[22px] font-bold tabular-nums leading-tight tracking-tight text-fg transition-colors duration-150 group-hover:text-primary">
                {s.value}
              </p>
              <p className="truncate text-xs text-fg-muted">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title="No jobs yet"
            description="Create a client, add a job, then start tracking candidates. Everything lives in one place."
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
            empty={<p className="text-[13px] text-fg-subtle">No active jobs yet.</p>}
          >
            {data.recent_jobs.filter((j) => j.status === "active").length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-4 text-center text-xs text-fg-subtle">
                No active jobs
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {data.recent_jobs
                  .filter((job) => job.status === "active")
                  .slice(0, 6)
                  .map((job) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-transform duration-150 group-hover:scale-105"
                        style={{ background: `${jobPalette(job.status).dot}1a`, color: jobPalette(job.status).dot }}
                      >
                        <Briefcase className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-fg">{job.title}</span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {job.client_name} · {job.job_id}
                          <span className="ml-2 text-fg-muted">{job.candidate_count} candidates</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-fg-subtle">{timeAgo(job.updated_at)}</span>
                    </Link>
                  ))}
              </div>
            )}
          </Section>

          <Section
            title="Recent candidates"
            to="/candidates"
            empty={<p className="text-[13px] text-fg-subtle">No active candidates yet.</p>}
          >
            {data.recent_candidates.filter(
              (c) => c.submission_status !== "not_interested" && c.submission_status !== "rejected",
            ).length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-4 text-center text-xs text-fg-subtle">
                No active candidates
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {data.recent_candidates
                  .filter(
                    (cand) =>
                      cand.submission_status !== "not_interested" &&
                      cand.submission_status !== "rejected",
                  )
                  .slice(0, 6)
                  .map((cand) => (
                    <Link
                      key={cand.id}
                      to={`/candidates?candidate=${cand.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                        style={{
                          background: `${submissionPalette(cand.submission_status).dot}1a`,
                          color: submissionPalette(cand.submission_status).dot,
                        }}
                      >
                        {nameInitials(cand.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-fg">{cand.name}</span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {cand.current_title ? `${cand.current_title} · ` : ""}
                          {cand.current_company ?? "-"}
                        </span>
                      </span>
                      <StatusBadge status={cand.submission_status} className="shrink-0" />
                    </Link>
                  ))}
              </div>
            )}
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
                  className="h-full transition-all duration-500"
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
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-active">
            {data.jobs_by_status.map((s) => {
              const p = jobPalette(s.status);
              const pct = data.total_jobs ? (s.count / data.total_jobs) * 100 : 0;
              return (
                <div
                  key={s.status}
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: p.dot }}
                  title={`${titleCase(s.status)}: ${s.count}`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {data.jobs_by_status.map((s) => {
              const p = jobPalette(s.status);
              return (
                <Link
                  key={s.status}
                  to={`/jobs?status=${s.status}`}
                  className="group flex cursor-pointer items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: p.dot }} />
                  {titleCase(s.status)}
                  <span className="font-medium tabular-nums text-fg transition-colors group-hover:text-primary">{s.count}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

function ZoneClock() {
  const timeZones = useProfile((s) => s.timeZones);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (timeZones.length === 0) return;
    let id: number;
    const schedule = () => {
      const now = new Date();
      const delay = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
      id = window.setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(id);
  }, [timeZones.length]);

  if (timeZones.length === 0) return null;
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-fg-muted">
      <Clock className="h-4 w-4 shrink-0 text-fg-subtle" />
      {timeZones.map((zone, i) => (
        <span key={zone} className="flex items-center">
          {i > 0 && <span className="mx-1.5 text-fg-subtle">·</span>}
          {formatZoneTime(zone)}
        </span>
      ))}
    </span>
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
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h2 className="font-display text-[14px] font-semibold tracking-tight text-fg">{title}</h2>
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