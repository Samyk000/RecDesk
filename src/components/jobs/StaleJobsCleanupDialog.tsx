import { useState, useEffect, useMemo } from "react";
import { Broom, Trash, Sparkle, ShieldCheck, CheckSquare, Square } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { StatusBadge } from "../common/StatusBadge";
import { useBulkDeleteJobs } from "../../hooks/useQueries";
import { timeAgo, errorMessage, cn } from "../../lib/utils";
import type { JobWithStats } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: JobWithStats[];
}

export function StaleJobsCleanupDialog({ open, onOpenChange, jobs }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const bulkDelete = useBulkDeleteJobs();

  // Reset selected IDs whenever dialog opens or jobs change
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(jobs.map((j) => j.id)));
    }
  }, [open, jobs]);

  const allSelected = useMemo(() => {
    if (jobs.length === 0) return false;
    return jobs.every((j) => selectedIds.has(j.id));
  }, [jobs, selectedIds]);

  const someSelected = useMemo(() => {
    return selectedIds.size > 0 && !allSelected;
  }, [selectedIds, allSelected]);

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(jobs.map((j) => j.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleDelete() {
    if (selectedIds.size === 0) return;

    // Safety safeguard: Filter out any job that gained candidates in a race condition
    const safeIdsToDelete = jobs
      .filter((j) => selectedIds.has(j.id) && (j.candidate_count ?? 0) === 0)
      .map((j) => j.id);

    if (safeIdsToDelete.length === 0) {
      toast.info("No matching 0-candidate jobs to delete.");
      onOpenChange(false);
      return;
    }

    bulkDelete.mutate(safeIdsToDelete, {
      onSuccess: () => {
        toast.success(`Removed ${safeIdsToDelete.length} abandoned job(s)`);
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(errorMessage(err));
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Broom className="h-5 w-5" weight="duotone" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-fg">
                Clean Abandoned Jobs
              </DialogTitle>
              <DialogDescription className="text-xs text-fg-muted mt-0.5">
                Jobs older than 10 days with 0 candidates.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Safety Notice */}
        <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-fg-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" weight="fill" />
          <span className="text-[11.5px]">
            Jobs with candidates are protected and excluded.
          </span>
        </div>

        {/* Content Body */}
        {jobs.length === 0 ? (
          <div className="px-6 py-8 text-center flex flex-col items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-active text-fg-subtle mb-2">
              <Sparkle className="h-5 w-5 text-emerald-500" weight="duotone" />
            </div>
            <p className="text-sm font-medium text-fg">Pipeline is clean</p>
            <p className="text-xs text-fg-muted mt-0.5">
              No jobs older than 10 days with 0 candidates.
            </p>
          </div>
        ) : (
          <div className="flex flex-col min-h-0">
            {/* Selection Toolbar Header */}
            <div className="flex items-center justify-between border-y border-border/80 bg-surface-hover/40 px-6 py-2 text-xs">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 font-medium text-fg-muted hover:text-fg cursor-pointer select-none"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" weight="fill" />
                ) : someSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary/60" />
                ) : (
                  <Square className="h-4 w-4 text-fg-subtle" />
                )}
                <span>Select All ({jobs.length})</span>
              </button>
              <span className="font-mono text-[11px] text-fg-subtle">
                {selectedIds.size} of {jobs.length} selected
              </span>
            </div>

            {/* Scrollable Job Review List */}
            <div className="max-h-[260px] overflow-y-auto px-6 py-2.5 space-y-1.5 scrollbar-thin">
              {jobs.map((job) => {
                const isSelected = selectedIds.has(job.id);

                return (
                  <div
                    key={job.id}
                    onClick={() => toggleOne(job.id)}
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary/40 bg-primary/5 shadow-2xs"
                        : "border-border/60 bg-surface-hover/20 hover:border-border hover:bg-surface-hover/40",
                    )}
                  >
                    {/* Left: Checkbox + Job Details */}
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(job.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-border accent-primary cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[13px] text-fg truncate">
                            {job.title}
                          </span>
                          <span className="font-mono text-[10.5px] text-fg-subtle shrink-0">
                            {job.job_id}
                          </span>
                        </div>
                        <p className="text-[11px] text-fg-subtle truncate">
                          {job.client_name}
                        </p>
                      </div>
                    </div>

                    {/* Right: Status badge & Age */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <StatusBadge kind="job" status={job.status} dot={false} className="text-[11px]" />
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[10.5px] text-fg-muted font-medium whitespace-nowrap">
                          {timeAgo(job.created_at)}
                        </span>
                        <span className="text-[9.5px] font-mono text-fg-subtle/80">
                          0 candidates
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="px-6 py-3.5 border-t border-border bg-surface-hover/20">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={bulkDelete.isPending}
            className="text-xs cursor-pointer"
          >
            {jobs.length === 0 ? "Close" : "Cancel"}
          </Button>
          {jobs.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={bulkDelete.isPending || selectedIds.size === 0}
              className="text-xs gap-1.5 cursor-pointer"
            >
              <Trash className="h-3.5 w-3.5" />
              <span>
                {bulkDelete.isPending
                  ? "Deleting..."
                  : selectedIds.size > 0
                    ? `Delete ${selectedIds.size} Job${selectedIds.size === 1 ? "" : "s"}`
                    : "Select Jobs to Delete"}
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
