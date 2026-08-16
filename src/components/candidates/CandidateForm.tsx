import { useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input, Textarea } from "../ui/input";
import { Label } from "../ui/label";
import { useCreateCandidate } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/utils";
import type { CandidateInput } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function CandidateForm({ open, onOpenChange, jobId }: Props) {
  const create = useCreateCandidate();

  useEffect(() => {
    if (!open) return;
    const form = document.getElementById("candidate-form") as HTMLFormElement | null;
    form?.reset();
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: CandidateInput = {
      job_id: jobId,
      name: (fd.get("name") as string) || "",
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      location: (fd.get("location") as string) || null,
      current_title: (fd.get("current_title") as string) || null,
      current_company: (fd.get("current_company") as string) || null,
      experience_years: (fd.get("experience_years") as string)
        ? Number(fd.get("experience_years"))
        : null,
      match_score: (fd.get("match_score") as string)
        ? Math.min(100, Math.max(0, Number(fd.get("match_score"))))
        : null,
      recruiter_notes: (fd.get("recruiter_notes") as string) || null,
      submission_status: "new",
      candidate_status: "active",
    };
    if (!input.name.trim()) {
      toast.error("Candidate name is required");
      return;
    }
    try {
      await create.mutateAsync(input);
      toast.success("Candidate added");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>Add a candidate to track for this job.</DialogDescription>
        </DialogHeader>

        <form id="candidate-form" onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="cand-name">Name *</Label>
            <Input id="cand-name" name="name" placeholder="John Smith" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="john@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" placeholder="+1 (555) 000-0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input name="location" placeholder="Boston, MA" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Current title</Label>
              <Input name="current_title" placeholder="Senior Java Developer" />
            </div>
            <div className="space-y-1.5">
              <Label>Current company</Label>
              <Input name="current_company" placeholder="Fidelity" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Experience (years)</Label>
              <Input name="experience_years" type="number" min={0} placeholder="8" />
            </div>
            <div className="space-y-1.5">
              <Label>Match score (0-100)</Label>
              <Input name="match_score" type="number" min={0} max={100} placeholder="85" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea name="recruiter_notes" rows={3} placeholder="First impressions, source, availability…" />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="candidate-form" variant="primary" disabled={create.isPending}>
            Add candidate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}