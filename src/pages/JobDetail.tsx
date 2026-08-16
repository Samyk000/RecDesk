import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  FileText,
  ListChecks,
  MessageSquareQuote,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown";
import { OverviewTab } from "../components/jobs/tabs/OverviewTab";
import { JdTab } from "../components/jobs/tabs/JdTab";
import { BooleanTab } from "../components/jobs/tabs/BooleanTab";
import { PitchTab } from "../components/jobs/tabs/PitchTab";
import { ScreeningTab } from "../components/jobs/tabs/ScreeningTab";
import { NotesTab } from "../components/jobs/tabs/NotesTab";
import { CandidatesTab } from "../components/jobs/tabs/CandidatesTab";
import { JOB_STATUSES, jobPalette } from "../lib/constants";
import { titleCase } from "../lib/utils";
import { toast } from "sonner";
import type { Job } from "../types";
import { useUpdateJob } from "../hooks/useQueries";
import { toJobInput } from "../components/jobs/tabUtils";

const tabDefs = [
  { value: "overview", label: "Overview", icon: BookOpen },
  { value: "jd", label: "Job Description", icon: FileText },
  { value: "boolean", label: "Boolean", icon: Search },
  { value: "pitch", label: "Candidate Pitch", icon: MessageSquareQuote },
  { value: "screening", label: "Screening Questions", icon: ListChecks },
  { value: "candidates", label: "Candidates", icon: Briefcase },
  { value: "notes", label: "Notes", icon: NotebookPen },
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
      navigate(currentJob.client_id ? `/clients/${currentJob.client_id}` : "/jobs");
    } catch {
      toast.error("Failed to delete job");
    }
  }

  return (
    <div className="px-6 pt-4">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/jobs"))}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {job.client_name}
      </button>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-lg font-semibold tracking-tight text-fg">{job.title}</h1>
            <StatusBadge status={job.status} kind="job" className="shrink-0" />
            <StatusSwitcher job={job} />
          </div>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            <span className="font-mono text-xs">{job.job_id}</span>
            <span className="mx-1.5">·</span>
            {job.client_name}
            {job.location && (
              <>
                <span className="mx-1.5">·</span>
                {job.location}
                {job.work_model && ` · ${job.work_model}`}
              </>
            )}
            {job.contract_type && (
              <>
                <span className="mx-1.5">·</span>
                {job.contract_type}
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete job
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveTab("candidates")}>
                <Briefcase className="h-3.5 w-3.5" />
                View candidates
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                <span className="ml-1 rounded-full bg-surface-active px-1.5 text-[11px] font-medium text-fg-muted">
                  {job.candidate_count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab job={job} />
        </TabsContent>
        <TabsContent value="jd">
          <JdTab job={job} />
        </TabsContent>
        <TabsContent value="boolean">
          <BooleanTab job={job} />
        </TabsContent>
        <TabsContent value="pitch">
          <PitchTab job={job} />
        </TabsContent>
        <TabsContent value="screening">
          <ScreeningTab job={job} />
        </TabsContent>
        <TabsContent value="candidates">
          <CandidatesTab jobId={job.id} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab job={job} />
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