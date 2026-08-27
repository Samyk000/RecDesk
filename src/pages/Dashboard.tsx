import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Building,
  CalendarCheck,
  CheckCircle,
  Clock,
  IdentificationCard,
  Lightning,
  ListChecks,
  Plus,
  UserPlus,
} from "@phosphor-icons/react";
import { useDashboardStats } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/common/PageHeader";
import { jobPalette, submissionPalette } from "../lib/constants";
import { getCandidateSubStageLabel } from "../lib/candidateUtils";
import { cn, formatZoneTime, greetingLine, nameInitials, timeAgo, titleCase } from "../lib/utils";
import { useProfile } from "../store/profile";
import { CandidateForm } from "../components/candidates/CandidateForm";
import { JobFormDialog } from "../components/jobs/JobFormDialog";
import { ClientForm } from "../components/clients/ClientForm";
import { QuickScreenDialog } from "../components/candidates/QuickScreenDialog";

export function Dashboard() {
  const { data, isLoading } = useDashboardStats();
  const navigate = useNavigate();
  const { name } = useProfile();

  const [candidateFormOpen, setCandidateFormOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [quickScreenOpen, setQuickScreenOpen] = useState(false);

  if (isLoading || !data) return <PageLoader label="Loading workspace…" />;

  const isEmpty = data.total_jobs === 0;

  const stats = [
    {
      label: "Total candidates",
      value: data.total_candidates,
      icon: IdentificationCard,
      accent: "text-violet-500",
      to: "/candidates",
    },
    {
      label: "Active jobs",
      value: data.active_jobs,
      icon: Briefcase,
      accent: "text-blue-500",
      to: "/jobs",
    },
    {
      label: "Interview",
      value: data.interview_candidates,
      icon: CalendarCheck,
      accent: "text-violet-500",
      to: "/candidates?status=interview",
    },
    {
      label: "Placed",
      value: data.placed_candidates,
      icon: CheckCircle,
      accent: "text-emerald-500",
      to: "/candidates?status=placed",
    },
  ];

  return (
    <div className="px-6 pt-4 pb-6">
      <PageHeader
        title={greetingLine(name)}
        subtitle={isEmpty ? "Start by creating your first job." : undefined}
        actions={<ZoneClock />}
        className="mb-4"
      />

      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            to={s.to}
            style={{ animationDelay: `${i * 40}ms` }}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-float hover:border-border-strong animate-stagger active:scale-[0.99]"
          >
            <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-surface-active transition-colors duration-150 group-hover:bg-surface-hover">
              <s.icon className={cn("h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110", s.accent)} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[20px] font-bold tabular-nums leading-tight tracking-tight text-fg transition-colors duration-150 group-hover:text-primary">
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
                onClick={() => setJobFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create your first job
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Recent Jobs & Recent Candidates (2 Columns) */}
          <div className="mt-4 grid grid-cols-2 gap-4">
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
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
                  {data.recent_jobs
                    .filter((job) => job.status === "active")
                    .slice(0, 5)
                    .map((job) => (
                      <Link
                        key={job.id}
                        to={`/jobs/${job.id}`}
                        className="flex items-center gap-3 px-3.5 py-2 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                      >
                        <span
                          className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md transition-transform duration-150 group-hover:scale-105"
                          style={{ background: `${jobPalette(job.status).dot}1a`, color: jobPalette(job.status).dot }}
                        >
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-fg">{job.title}</span>
                          <span className="block truncate text-xs text-fg-subtle">
                            {job.client_name} · {job.job_id}
                            <span className="ml-1.5 text-fg-muted">{job.candidate_count} candidates</span>
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
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
                  {data.recent_candidates
                    .filter(
                      (cand) =>
                        cand.submission_status !== "not_interested" &&
                        cand.submission_status !== "rejected",
                    )
                    .slice(0, 5)
                    .map((cand) => (
                      <Link
                        key={cand.id}
                        to={`/candidates?candidate=${cand.id}`}
                        className="flex items-center gap-3 px-3.5 py-2 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                      >
                        <span
                          className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
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
                        <StatusBadge
                          status={cand.submission_status}
                          subStage={getCandidateSubStageLabel(cand)}
                          className="shrink-0"
                        />
                      </Link>
                    ))}
                </div>
              )}
            </Section>
          </div>

          {/* Full-Width Candidate Pipeline Widget */}
          <div className="mt-4">
            <Section title="Pipeline" to="/candidates">
              <div className="rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
                {/* Thin, refined distribution bar */}
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-active shadow-inner">
                  {data.candidates_by_status.map((s) => {
                    const p = submissionPalette(s.status);
                    const pct = data.total_candidates ? (s.count / data.total_candidates) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={s.status}
                        className="h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
                        style={{ width: `${pct}%`, background: p.dot }}
                        title={`${titleCase(s.status)}: ${s.count} (${pct.toFixed(0)}%)`}
                        onClick={() => navigate(`/candidates?status=${s.status}`)}
                      />
                    );
                  })}
                </div>

                {/* Clean, horizontal stage breakdown pills */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-border/50">
                  {data.candidates_by_status.map((s) => {
                    const p = submissionPalette(s.status);
                    const pct = data.total_candidates
                      ? ((s.count / data.total_candidates) * 100).toFixed(0)
                      : "0";
                    return (
                      <Link
                        key={s.status}
                        to={`/candidates?status=${s.status}`}
                        className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fg-muted transition-all hover:bg-surface-hover hover:text-fg cursor-pointer"
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.dot }} />
                        <span className="font-medium">{titleCase(s.status)}</span>
                        <span className="font-bold tabular-nums text-fg group-hover:text-primary transition-colors">
                          {s.count}
                        </span>
                        <span className="text-[10px] text-fg-subtle">({pct}%)</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </Section>
          </div>

          {/* Quick Actions Bento Cards Section */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-display text-[14px] font-semibold tracking-tight text-fg flex items-center gap-1.5">
                <Lightning className="h-4 w-4 text-amber-500" weight="fill" />
                <span>Quick Actions</span>
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {/* 1. Add Candidate */}
              <button
                type="button"
                onClick={() => setCandidateFormOpen(true)}
                className="group flex flex-col items-start rounded-xl border border-border bg-surface p-3.5 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-float hover:border-violet-500/40 active:scale-[0.99]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500 group-hover:text-white transition-all duration-200">
                  <UserPlus className="h-4 w-4" />
                </div>
                <p className="mt-2.5 font-display text-[13.5px] font-semibold text-fg group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  Add Candidate
                </p>
                <p className="mt-0.5 text-xs text-fg-muted line-clamp-1">
                  Profile & auto-resume extract
                </p>
              </button>

              {/* 2. Add Job */}
              <button
                type="button"
                onClick={() => setJobFormOpen(true)}
                className="group flex flex-col items-start rounded-xl border border-border bg-surface p-3.5 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-float hover:border-blue-500/40 active:scale-[0.99]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-200">
                  <Briefcase className="h-4 w-4" />
                </div>
                <p className="mt-2.5 font-display text-[13.5px] font-semibold text-fg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Add Job
                </p>
                <p className="mt-0.5 text-xs text-fg-muted line-clamp-1">
                  New client job requisition
                </p>
              </button>

              {/* 3. Add Client */}
              <button
                type="button"
                onClick={() => setClientFormOpen(true)}
                className="group flex flex-col items-start rounded-xl border border-border bg-surface p-3.5 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-float hover:border-amber-500/40 active:scale-[0.99]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all duration-200">
                  <Building className="h-4 w-4" />
                </div>
                <p className="mt-2.5 font-display text-[13.5px] font-semibold text-fg group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Add Client
                </p>
                <p className="mt-0.5 text-xs text-fg-muted line-clamp-1">
                  Register client organization
                </p>
              </button>

              {/* 4. Quick Screen */}
              <button
                type="button"
                onClick={() => setQuickScreenOpen(true)}
                className="group flex flex-col items-start rounded-xl border border-border bg-surface p-3.5 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-float hover:border-emerald-500/40 active:scale-[0.99]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200">
                  <ListChecks className="h-4 w-4" />
                </div>
                <p className="mt-2.5 font-display text-[13.5px] font-semibold text-fg group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Quick Screen
                </p>
                <p className="mt-0.5 text-xs text-fg-muted line-clamp-1">
                  Live screening script & questions
                </p>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dialogs for Quick Actions */}
      <CandidateForm
        open={candidateFormOpen}
        onOpenChange={setCandidateFormOpen}
      />
      <JobFormDialog
        open={jobFormOpen}
        onOpenChange={setJobFormOpen}
      />
      <ClientForm
        open={clientFormOpen}
        onOpenChange={setClientFormOpen}
      />
      <QuickScreenDialog
        open={quickScreenOpen}
        onOpenChange={setQuickScreenOpen}
      />
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
    <div className="flex items-center rounded-lg border border-border/80 bg-surface/80 px-1 py-0.5 text-xs font-medium tabular-nums text-fg-muted shadow-2xs divide-x divide-border/70">
      {timeZones.map((zone) => (
        <span key={zone} className="flex items-center gap-1.5 px-2.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{formatZoneTime(zone)}</span>
        </span>
      ))}
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
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
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