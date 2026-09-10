import { useState, useMemo } from "react";
import {
  ArrowsLeftRight,
  Briefcase,
  Check,
  CircleNotch,
  Copy,
  MagnifyingGlass,
  Warning,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJobs,
  useCandidatesWithJob,
  useUpdateCandidate,
  useCreateCandidate,
} from "../../hooks/useQueries";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { toCandidateInput } from "../../lib/candidateUtils";
import { cn, errorMessage } from "../../lib/utils";
import type { Candidate, JobWithStats } from "../../types";

interface Props {
  candidate: Candidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newJobId: string, action: "move" | "copy") => void;
}

export function ChangeJobDialog({
  candidate,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const { data: allJobs, isLoading: jobsLoading } = useJobs();
  const { data: allCandidates } = useCandidatesWithJob();
  const updateCandidate = useUpdateCandidate();
  const createCandidate = useCreateCandidate();

  const [mode, setMode] = useState<"move" | "copy">("move");
  const [search, setSearch] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Set of job IDs where this candidate already exists (matched by email or phone)
  const existingJobIds = useMemo(() => {
    if (!allCandidates) return new Set<string>();
    const candEmail = candidate.email?.trim().toLowerCase();
    const candPhone = candidate.phone?.trim();
    if (!candEmail && !candPhone) return new Set<string>();

    const matches = allCandidates.filter((c) => {
      if (c.id === candidate.id) return false;
      const matchEmail = candEmail && c.email?.trim().toLowerCase() === candEmail;
      const matchPhone = candPhone && c.phone?.trim() === candPhone;
      return matchEmail || matchPhone;
    });

    return new Set(matches.map((c) => c.job_id));
  }, [allCandidates, candidate]);

  // Filtered list of jobs
  const filteredJobs = useMemo(() => {
    if (!allJobs) return [];
    let list = allJobs;
    if (!includeClosed) {
      list = list.filter((j) => j.status === "active");
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.client_name.toLowerCase().includes(q) ||
        j.job_id.toLowerCase().includes(q)
    );
  }, [allJobs, includeClosed, search]);

  const closedCount = useMemo(() => {
    return allJobs ? allJobs.filter((j) => j.status !== "active").length : 0;
  }, [allJobs]);

  const handleSelectJob = async (targetJob: JobWithStats) => {
    if (targetJob.id === candidate.job_id) return;
    setProcessingId(targetJob.id);

    try {
      if (mode === "move") {
        const oldJobId = candidate.job_id;
        const previousCandidateState = { ...candidate };

        // Reassign to new job: wipe screening answers for fresh role questions, reset stage
        await updateCandidate.mutateAsync({
          id: candidate.id,
          input: toCandidateInput(candidate, {
            job_id: targetJob.id,
            screening_answers: "{}",
            submission_status: "sourced",
            interview_status: null,
            interview_at: null,
            submitted_at: null,
            placed_at: null,
            rejection_reason: null,
            match_score: null,
          }),
        });

        // Invalidate relevant caches
        queryClient.invalidateQueries({ queryKey: ["job", oldJobId] });
        queryClient.invalidateQueries({ queryKey: ["job", targetJob.id] });
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["candidate", candidate.id] });
        queryClient.invalidateQueries({ queryKey: ["candidates"] });
        queryClient.invalidateQueries({ queryKey: ["candidatesWithJob"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["reminders"] });

        toast.success(`Moved ${candidate.name} to "${targetJob.title}"`, {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await updateCandidate.mutateAsync({
                  id: candidate.id,
                  input: toCandidateInput(previousCandidateState),
                });
                queryClient.invalidateQueries({ queryKey: ["job", oldJobId] });
                queryClient.invalidateQueries({ queryKey: ["job", targetJob.id] });
                queryClient.invalidateQueries({ queryKey: ["candidate", candidate.id] });
                queryClient.invalidateQueries({ queryKey: ["candidates"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                toast.success(`Reverted ${candidate.name} back to original role`);
              } catch {
                toast.error("Failed to undo move");
              }
            },
          },
        });

        onOpenChange(false);
        onSuccess?.(targetJob.id, "move");
      } else {
        // Copy to job: creates a fresh candidate record under target job
        const newCand = await createCandidate.mutateAsync({
          job_id: targetJob.id,
          name: candidate.name,
          email: candidate.email ?? null,
          phone: candidate.phone ?? null,
          location: candidate.location ?? null,
          current_title: candidate.current_title ?? null,
          current_company: candidate.current_company ?? null,
          experience_years: candidate.experience_years ?? null,
          resume_path: candidate.resume_path ?? null,
          linkedin_url: candidate.linkedin_url ?? null,
          recruiter_notes: candidate.recruiter_notes ?? null,
          submission_status: "sourced",
          candidate_status: "active",
          screening_answers: "{}",
          submission_details: candidate.submission_details ?? null,
        });

        queryClient.invalidateQueries({ queryKey: ["job", targetJob.id] });
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["candidates"] });
        queryClient.invalidateQueries({ queryKey: ["candidatesWithJob"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });

        toast.success(`Copied "${candidate.name}" to "${targetJob.title}"`);
        onOpenChange(false);
        onSuccess?.(newCand.id, "copy");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-[520px] overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-surface px-5 py-3.5 pr-11">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-fg truncate">
                {mode === "move" ? "Move Candidate to Job" : "Copy Candidate to Job"}
              </DialogTitle>
              <p className="text-[11.5px] text-fg-subtle truncate">
                Candidate: <span className="font-medium text-fg">{candidate.name}</span>
              </p>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-hover/70 p-0.5 border border-border/60">
            <button
              type="button"
              onClick={() => setMode("move")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md font-semibold text-[11.5px] transition-all cursor-pointer",
                mode === "move"
                  ? "bg-surface text-fg shadow-xs border border-border"
                  : "text-fg-muted hover:text-fg"
              )}
            >
              <ArrowsLeftRight className="h-3.5 w-3.5 text-primary" />
              <span>Move (Transfer)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("copy")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md font-semibold text-[11.5px] transition-all cursor-pointer",
                mode === "copy"
                  ? "bg-surface text-fg shadow-xs border border-border"
                  : "text-fg-muted hover:text-fg"
              )}
            >
              <Copy className="h-3.5 w-3.5 text-blue-500" />
              <span>Copy (Clone)</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-border/50 bg-bg/50">
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search target role by title, client, or code…"
              className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-xs placeholder:text-fg-muted focus:outline-none focus:border-primary/60 transition-colors"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Job List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-72 scrollbar-thin">
          {jobsLoading ? (
            <div className="flex h-32 items-center justify-center text-fg-muted">
              <CircleNotch className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-8 text-center text-xs text-fg-muted">
              No jobs found matching "{search}".
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isCurrent = job.id === candidate.job_id;
              const isAlreadyInJob = existingJobIds.has(job.id);
              const isProcessing = processingId === job.id;

              return (
                <button
                  type="button"
                  key={job.id}
                  disabled={isCurrent || isProcessing}
                  onClick={() => handleSelectJob(job)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg p-2.5 text-left text-xs transition-all cursor-pointer border",
                    isCurrent
                      ? "border-primary/20 bg-primary/5 opacity-65 cursor-not-allowed"
                      : "border-transparent hover:border-border hover:bg-surface-hover active:scale-[0.99]"
                  )}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-fg truncate text-[12.5px]">
                        {job.title}
                      </span>
                      {isCurrent && (
                        <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[9px] font-bold text-primary shrink-0">
                          CURRENT
                        </span>
                      )}
                      {isAlreadyInJob && !isCurrent && (
                        <span className="flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          <Warning className="h-2.5 w-2.5" />
                          ALREADY IN ROLE
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted truncate">
                      <span>{job.client_name}</span>
                      <span>·</span>
                      <span className="font-mono text-[10.5px]">{job.job_id}</span>
                      <span>·</span>
                      <span>{job.candidate_count} candidates</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    {isProcessing ? (
                      <CircleNotch className="h-4 w-4 animate-spin text-primary" />
                    ) : isCurrent ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="rounded-md border border-border/80 bg-surface px-2 py-1 text-[11px] font-medium text-fg-subtle hover:text-fg hover:border-primary/40 transition-colors shadow-2xs">
                        {mode === "move" ? "Move" : "Copy"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 bg-surface px-4 py-2.5 flex items-center justify-between text-[11px] text-fg-muted">
          <span>
            {mode === "move"
              ? "Transfers candidate & resets stage to Sourced"
              : "Duplicates profile & keeps original in current role"}
          </span>

          {closedCount > 0 && (
            <button
              type="button"
              onClick={() => setIncludeClosed(!includeClosed)}
              className="text-primary hover:underline cursor-pointer font-medium"
            >
              {includeClosed ? "Hide closed jobs" : `Show ${closedCount} closed jobs`}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
