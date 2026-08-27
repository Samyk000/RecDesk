import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  ChatCircleText,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { useDeleteJob, useJob } from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { JobFormDialog } from "../components/jobs/JobFormDialog";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown";
import { OverviewTab } from "../components/jobs/tabs/OverviewTab";
import { PitchScreeningTab } from "../components/jobs/tabs/PitchScreeningTab";
import { CandidatesTab } from "../components/jobs/tabs/CandidatesTab";
import { JOB_STATUSES, jobPalette } from "../lib/constants";
import { titleCase, formatDateAbbr } from "../lib/utils";
import { toast } from "sonner";
import type { Job } from "../types";
import { useUpdateJob } from "../hooks/useQueries";
import { toJobInput } from "../components/jobs/tabUtils";

const tabDefs = [
  { value: "overview", label: "Overview", icon: BookOpen },
  { value: "pitch-screening", label: "Pitch & Screening", icon: ChatCircleText },
  { value: "candidates", label: "Candidates", icon: Briefcase },
];

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useJob(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteJob = useDeleteJob();
  const [activeTab, setActiveTab] = useState("overview");

  if (isLoading || !job) return <PageLoader label="Loading job…" />;
  const currentJob = job;

  async function handleDelete() {
    try {
      await deleteJob.mutateAsync(currentJob.id);
      toast.success("Job deleted");
      navigate("/jobs");
    } catch {
      toast.error("Failed to delete job");
    }
  }

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/jobs"))}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Jobs
        </button>
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          {job.client_name && (
            <>
              <button
                type="button"
                onClick={() => job.client_id && navigate(`/clients/${job.client_id}`)}
                className="hover:text-primary transition-colors cursor-pointer font-medium"
              >
                {job.client_name}
              </button>
              <span>·</span>
            </>
          )}
          <span>
            Created: <span className="tabular-nums font-medium text-fg">{formatDateAbbr(job.created_at)}</span>
          </span>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-lg font-semibold tracking-tight text-fg">
            {job.title}
            <span className="font-normal text-fg-muted">
              <span className="mx-2">:</span>
              <span className="font-mono text-[13px]">{job.job_id}</span>
              {job.location && (
                <>
                  <span className="mx-1">·</span>
                  {job.location}
                </>
              )}
              {job.contract_type && (
                <>
                  <span className="mx-1">·</span>
                  {job.contract_type}
                </>
              )}
            </span>
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={job.status} kind="job" className="shrink-0" />
          <StatusSwitcher job={job} />
          <Button variant="outline" onClick={() => setEditOpen(true)} className="cursor-pointer">
            <PencilSimple className="h-4 w-4" />
            Edit
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            title="Delete job"
            className="text-fg-subtle hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mb-5 w-full justify-start">
          {tabDefs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="gap-1.5 px-3 pb-2 pt-1"
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.value === "candidates" && (
                <span className="ml-1 rounded-md bg-surface-active px-1.5 text-[11px] font-medium text-fg-muted">
                  {job.candidate_count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <OverviewTab job={job} />
        </TabsContent>
        <TabsContent value="pitch-screening" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <PitchScreeningTab job={job} />
        </TabsContent>
        <TabsContent value="candidates" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <CandidatesTab jobId={job.id} />
        </TabsContent>
      </Tabs>

      <JobFormDialog open={editOpen} onOpenChange={setEditOpen} jobId={job.id} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete job"
        description={`Delete "${job.title}"? All ${job.candidate_count} candidate record(s) will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteJob.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function StatusSwitcher({ job }: { job: Job }) {
  const update = useUpdateJob();
  const palette = jobPalette(job.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="xs" variant="ghost" className="h-6 gap-1 px-1.5 text-xs" title="Change status">
          <span
            className="h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-125"
            style={{ background: palette.dot }}
          />
          <span className="text-fg-subtle hover:text-fg">Change</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Job status</DropdownMenuLabel>
        {JOB_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => update.mutate({ id: job.id, input: toJobInput(job, { status: s }) })}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: jobPalette(s).dot }} />
            {titleCase(s)}
            {s === job.status && <span className="ml-auto text-xs text-fg-subtle">current</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}