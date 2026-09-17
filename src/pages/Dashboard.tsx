import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Building,
  CalendarCheck,
  CheckCircle,
  Clock,
  IdentificationCard,
  Lightning,
  PaperPlaneTilt,
  Plus,
  UserPlus,
} from "@phosphor-icons/react";
import { MetricSparkline } from "../components/dashboard/MetricSparkline";
import { useDashboardStats } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { jobPalette, submissionPalette } from "../lib/constants";
import { getCandidateSubStageLabel } from "../lib/candidateUtils";
import { cn, formatZoneTime, nameInitials, timeAgo, titleCase } from "../lib/utils";
import { useProfile } from "../store/profile";
import { CandidateForm } from "../components/candidates/CandidateForm";
import { JobFormDialog } from "../components/jobs/JobFormDialog";
import { ClientForm } from "../components/clients/ClientForm";
import { QuickScreenDialog } from "../components/candidates/QuickScreenDialog";
import { CandidateDetailPanel } from "../components/candidates/CandidateDetailPanel";
import { DetailDrawer } from "../components/common/DetailDrawer";

export function Dashboard() {
  const { data, isLoading } = useDashboardStats();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const activeCandidateId = selectedCandidateId ?? params.get("candidate");

  const handleOpenCandidate = (id: string) => {
    setSelectedCandidateId(id);
  };

  const handleCloseCandidate = () => {
    setSelectedCandidateId(null);
    if (params.has("candidate")) {
      const next = new URLSearchParams(params);
      next.delete("candidate");
      setParams(next, { replace: true });
    }
  };

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
      color: "#8b5cf6",
      to: "/candidates",
      trend: data.candidates_trend,
    },
    {
      label: "Submissions",
      value: data.external_submissions ?? (data.candidates_by_status.find((s) => s.status === "submitted")?.count ?? 0),
      icon: PaperPlaneTilt,
      accent: "text-amber-500",
      color: "#f59e0b",
      to: "/candidates?status=submitted",
      trend: data.submissions_trend,
    },
    {
      label: "Interview",
      value: data.interview_candidates,
      icon: CalendarCheck,
      accent: "text-purple-500",
      color: "#a855f7",
      to: "/candidates?status=interview",
      trend: data.interviews_trend,
    },
    {
      label: "Placed",
      value: data.placed_candidates,
      icon: CheckCircle,
      accent: "text-emerald-500",
      color: "#10b981",
      to: "/candidates?status=placed",
      trend: data.placed_trend,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden px-6 pt-5 pb-3.5 gap-3">
      {/* 1. Header & KPI Stats */}
      <div className="shrink-0">
        {/* Top Header Row: Left Title + Right Stacked Timezones & Quick Actions Box */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title & Subtitle */}
          <div className="shrink-0">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg leading-none">
              Dashboard
            </h1>
            <p className="mt-1.5 text-xs text-fg-subtle">
              {isEmpty ? "Start by creating your first job." : "Your recruiting workspace"}
            </p>
          </div>

          {/* Right: Stacked Column (Top: Single-Line Timezones, Bottom: Quick Actions Box matching width) */}
          <div className="flex flex-col gap-2.5 w-[500px] max-w-full shrink-0">
            {/* 1. Time Zones in single line on top */}
            <ZoneClock />

            {/* 2. Quick Actions Box - Aligned perfectly with Timezones width */}
            <div className="w-full rounded-xl border border-border/80 bg-surface/80 px-2.5 pt-1.5 pb-2 shadow-2xs backdrop-blur-xs">
              {/* Centered header label with icon */}
              <div className="mb-1.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                <Lightning className="h-3 w-3 text-amber-500" weight="fill" />
                <span>Quick Actions</span>
              </div>

              {/* 4 Action Buttons below */}
              <div className="grid grid-cols-4 gap-1.5">
                {/* 1. Add Candidate */}
                <button
                  type="button"
                  onClick={() => setCandidateFormOpen(true)}
                  className="group flex items-center justify-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300 transition-all duration-150 hover:bg-violet-500/20 hover:border-violet-500/40 hover:shadow-2xs active:scale-97 cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>+ Candidate</span>
                </button>

                {/* 2. Add Job */}
                <button
                  type="button"
                  onClick={() => setJobFormOpen(true)}
                  className="group flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/10 px-2 py-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 transition-all duration-150 hover:bg-blue-500/20 hover:border-blue-500/40 hover:shadow-2xs active:scale-97 cursor-pointer whitespace-nowrap"
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>+ Job</span>
                </button>

                {/* 3. Add Client */}
                <button
                  type="button"
                  onClick={() => setClientFormOpen(true)}
                  className="group flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 transition-all duration-150 hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-2xs active:scale-97 cursor-pointer whitespace-nowrap"
                >
                  <Building className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>+ Client</span>
                </button>

                {/* 4. Quick Screen */}
                <button
                  type="button"
                  onClick={() => setQuickScreenOpen(true)}
                  className="group flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 transition-all duration-150 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-2xs active:scale-97 cursor-pointer whitespace-nowrap"
                >
                  <Lightning className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" weight="fill" />
                  <span>Screen</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Top 4 Stats Cards */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Link
              key={s.label}
              to={s.to}
              style={{ animationDelay: `${i * 40}ms` }}
              className="group relative flex items-center justify-between gap-2.5 rounded-xl border border-border bg-surface py-2.5 px-3.5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-float hover:border-border-strong animate-stagger active:scale-[0.99]"
            >
              {/* Left: Icon + Value & Label */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-active transition-colors duration-150 group-hover:bg-surface-hover">
                  <s.icon className={cn("h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110", s.accent)} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[21px] font-bold tabular-nums leading-tight tracking-tight text-fg transition-colors duration-150 group-hover:text-primary">
                    {s.value}
                  </p>
                  <p className="truncate text-[11.5px] text-fg-muted">{s.label}</p>
                </div>
              </div>

              {/* Right: Sparkline Chart with interactive hover */}
              <MetricSparkline
                trend={s.trend}
                color={s.color}
                metricName={s.label}
              />
            </Link>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className="my-auto">
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
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <Section
              title="Recent jobs"
              to="/jobs"
              empty={<p className="text-[12px] text-fg-subtle">No active jobs yet.</p>}
            >
              {data.recent_jobs.filter((j) => j.status === "active").length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-3 text-center text-xs text-fg-subtle">
                  No active jobs
                </div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
                  {data.recent_jobs
                    .filter((job) => job.status === "active")
                    .slice(0, 7)
                    .map((job) => (
                      <Link
                        key={job.id}
                        to={`/jobs/${job.id}`}
                        className="flex items-center gap-2.5 px-3 py-1.5 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform duration-150 group-hover:scale-105"
                          style={{ background: `${jobPalette(job.status).dot}1a`, color: jobPalette(job.status).dot }}
                        >
                          <Briefcase className="h-3.5 w-3.5" />
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
              empty={<p className="text-[12px] text-fg-subtle">No active candidates yet.</p>}
            >
              {data.recent_candidates.filter(
                (c) => c.submission_status !== "not_interested" && c.submission_status !== "rejected",
              ).length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-3 text-center text-xs text-fg-subtle">
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
                    .slice(0, 7)
                    .map((cand) => (
                      <button
                        type="button"
                        key={cand.id}
                        onClick={() => handleOpenCandidate(cand.id)}
                        className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-all duration-150 hover:bg-surface-hover active:bg-surface-active cursor-pointer"
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                          style={{
                            background: `${submissionPalette(cand.submission_status).dot}1a`,
                            color: submissionPalette(cand.submission_status).dot,
                          }}
                        >
                          {nameInitials(cand.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-fg group-hover:text-primary transition-colors">{cand.name}</span>
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
                      </button>
                    ))}
                </div>
              )}
            </Section>
          </div>

          {/* Full-Width Enhanced Candidate Pipeline Widget */}
          <div className="mt-2.5">
            <Section title="Pipeline" to="/candidates">
              <div className="rounded-xl border border-border bg-surface p-3 shadow-2xs">
                {/* Sleek, thin distribution bar */}
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-active/60">
                  {data.candidates_by_status.map((s) => {
                    const p = submissionPalette(s.status);
                    const pct = data.total_candidates ? (s.count / data.total_candidates) * 100 : 0;
                    if (pct === 0) return null;
                    const displayCount =
                      s.status === "submitted" && data.external_submissions !== undefined
                        ? data.external_submissions
                        : s.status === "interview" && data.interview_candidates !== undefined
                          ? data.interview_candidates
                          : s.count;
                    const pctLabel = `${pct.toFixed(0)}%`;
                    return (
                      <div
                        key={s.status}
                        className="h-full transition-all duration-300 hover:opacity-80 cursor-pointer first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${pct}%`, background: p.dot }}
                        title={`${titleCase(s.status)}: ${displayCount} (${pctLabel})`}
                        onClick={() => navigate(`/candidates?status=${s.status}`)}
                      />
                    );
                  })}
                </div>

                {/* Clean, spread-out status legend showing ALL statuses with dot, count, and percent */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                  {data.candidates_by_status.map((s) => {
                    const p = submissionPalette(s.status);
                    const displayCount =
                      s.status === "submitted" && data.external_submissions !== undefined
                        ? data.external_submissions
                        : s.status === "interview" && data.interview_candidates !== undefined
                          ? data.interview_candidates
                          : s.count;
                    const pct = data.total_candidates
                      ? ((displayCount / data.total_candidates) * 100).toFixed(0)
                      : "0";
                    return (
                      <Link
                        key={s.status}
                        to={`/candidates?status=${s.status}`}
                        className="group flex items-center gap-2 rounded-lg px-2 py-1 text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors cursor-pointer"
                      >
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.dot }} />
                        <span className="font-medium text-fg-subtle group-hover:text-fg transition-colors">
                          {titleCase(s.status)}
                        </span>
                        <span className="font-bold tabular-nums text-fg group-hover:text-primary transition-colors">
                          {displayCount}
                        </span>
                        <span className="text-[11px] text-fg-subtle">({pct}%)</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </Section>
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

      {/* Candidate Detail Overlay Drawer */}
      {activeCandidateId && (
        <DetailDrawer onClose={handleCloseCandidate}>
          <CandidateDetailPanel
            candidateId={activeCandidateId}
            onClose={handleCloseCandidate}
          />
        </DetailDrawer>
      )}
    </div>
  );
}

function getMinimalZoneInfo(zone: string): { letter: string; fullLabel: string } {
  if (zone === "America/New_York") return { letter: "E", fullLabel: "Eastern Time (EDT / EST)" };
  if (zone === "America/Chicago") return { letter: "C", fullLabel: "Central Time (CDT / CST)" };
  if (zone === "America/Denver") return { letter: "M", fullLabel: "Mountain Time (MDT / MST)" };
  if (zone === "America/Los_Angeles") return { letter: "P", fullLabel: "Pacific Time (PDT / PST)" };
  if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return { letter: "IST", fullLabel: "India Standard Time (IST)" };
  if (zone === "UTC") return { letter: "UTC", fullLabel: "Coordinated Universal Time (UTC)" };
  const city = zone.split("/")[1] || zone;
  return { letter: city.slice(0, 3).toUpperCase(), fullLabel: zone };
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
    <div className="flex w-full items-center rounded-xl border border-border/80 bg-surface/80 px-2.5 py-2 text-xs font-medium tabular-nums text-fg-muted shadow-2xs divide-x divide-border/70 backdrop-blur-xs">
      {timeZones.map((zone) => {
        const info = getMinimalZoneInfo(zone);
        return (
          <Tooltip key={zone}>
            <TooltipTrigger asChild>
              <span className="flex-1 flex items-center justify-center gap-1.5 px-2 py-0.5 text-[11.5px] font-medium text-fg-muted cursor-default hover:text-fg transition-colors">
                <Clock className="h-3 w-3 shrink-0 text-primary/75" />
                <span>{formatZoneTime(zone)}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11.5px]">
              <p className="font-semibold">{info.fullLabel}</p>
              <p className="text-[10px] opacity-80">{zone}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
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
      <div className="mb-1 flex items-center justify-between px-1">
        <h2 className="font-display text-[13px] font-semibold tracking-tight text-fg">{title}</h2>
        <Link
          to={to}
          className="flex items-center gap-1 text-[11px] font-medium text-fg-muted transition-colors hover:text-primary"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children ?? empty}
    </div>
  );
}