import { useState } from "react";
import { ListChecks, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useCreateCandidate, useJobs } from "../../hooks/useQueries";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ScreeningQADialog } from "./ScreeningQADialog";
import { errorMessage } from "../../lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJobId?: string;
}

export function QuickScreenDialog({ open, onOpenChange, defaultJobId }: Props) {
  const { data: jobs, isLoading: jobsLoading } = useJobs(undefined, "active");
  const createCandidate = useCreateCandidate();

  const [jobId, setJobId] = useState<string>(defaultJobId ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [activeScreeningId, setActiveScreeningId] = useState<string | null>(null);

  const selectedJobId = jobId || (defaultJobId ?? (jobs && jobs.length > 0 ? jobs[0].id : ""));

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Candidate name is required");
      return;
    }
    if (!selectedJobId) {
      toast.error("Please select a job for this candidate");
      return;
    }

    try {
      const cand = await createCandidate.mutateAsync({
        job_id: selectedJobId,
        name: cleanName,
        phone: phone.trim() || null,
        email: email.trim() || null,
        submission_status: "in_touch",
      });

      toast.success("Candidate added — starting live screening!");
      setName("");
      setPhone("");
      setEmail("");
      onOpenChange(false);
      // Open screening modal for new candidate
      setActiveScreeningId(cand.id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkle className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold text-fg">
                  Quick Live Screening
                </DialogTitle>
                <p className="text-xs text-fg-subtle">
                  Pick a job & candidate name to start screening immediately.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleStart} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Job Position *</Label>
              <Select value={selectedJobId} onValueChange={setJobId}>
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue placeholder={jobsLoading ? "Loading jobs…" : "Select a job…"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {jobs?.map((j) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs">
                      {j.title} — <span className="text-fg-muted">{j.client_name}</span> ({j.job_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Candidate Name *</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-fg-subtle">Phone (optional)</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-fg-subtle">Email (optional)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="gap-1.5"
                disabled={createCandidate.isPending}
              >
                <ListChecks className="h-4 w-4" />
                {createCandidate.isPending ? "Creating…" : "Start Screening"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {activeScreeningId && (
        <ScreeningQADialog
          candidateId={activeScreeningId}
          open={!!activeScreeningId}
          onOpenChange={(open) => {
            if (!open) setActiveScreeningId(null);
          }}
        />
      )}
    </>
  );
}
