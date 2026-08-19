import { useEffect, useMemo, useState } from "react";
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
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useCreateCandidate, useJobs } from "../../hooks/useQueries";
import { SUBMISSION_STATUSES } from "../../lib/constants";
import { errorMessage } from "../../lib/utils";
import { StatusSelectItem } from "./StatusSelectItem";
import { SubmittedDatePicker } from "./SubmittedDatePicker";
import { InterviewSchedulePicker } from "./InterviewSchedulePicker";
import type { CandidateInput, JobWithStats } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
}

export function CandidateForm({ open, onOpenChange, jobId }: Props) {
  const create = useCreateCandidate();
  const { data: allJobs } = useJobs();

  const [selectedRole, setSelectedRole] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(jobId ?? "");
  const [status, setStatus] = useState("sourced");
  const [submittedAt, setSubmittedAt] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const roles = useMemo(() => {
    if (!allJobs) return [];
    const map = new Map<string, JobWithStats>();
    for (const j of allJobs) {
      if (!map.has(j.title)) map.set(j.title, j);
    }
    return Array.from(map.values());
  }, [allJobs]);

  const clientsForRole = useMemo(() => {
    if (!allJobs || !selectedRole) return [];
    const filtered = allJobs.filter((j) => j.title === selectedRole);
    const unique = new Map(filtered.map((j) => [j.client_name, j]));
    return Array.from(unique.values());
  }, [allJobs, selectedRole]);

  useEffect(() => {
    if (!open) return;
    setSelectedRole("");
    setSelectedClient("");
    setSelectedJobId(jobId ?? "");
    setStatus("sourced");
    setSubmittedAt("");
    setInterviewAt("");
    setRejectionReason("");
    const form = document.getElementById("candidate-form") as HTMLFormElement | null;
    form?.reset();
  }, [open, jobId]);

  useEffect(() => {
    if (!selectedRole || !selectedClient || !allJobs) {
      if (!jobId) setSelectedJobId("");
      return;
    }
    const match = allJobs.find(
      (j) => j.title === selectedRole && j.client_name === selectedClient,
    );
    if (match) setSelectedJobId(match.id);
  }, [selectedRole, selectedClient, allJobs, jobId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedJobId) {
      toast.error("Please select a role and client");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const input: CandidateInput = {
      job_id: selectedJobId,
      name: (fd.get("name") as string) || "",
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      location: (fd.get("location") as string) || null,
      linkedin_url: (fd.get("linkedin") as string) || null,
      submission_status: status,
      candidate_status: "active",
      submitted_at: status === "submitted" ? submittedAt || null : null,
      interview_at: status === "interview" ? interviewAt || null : null,
      rejection_reason: status === "rejected" ? rejectionReason.trim() || null : null,
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
            <Input id="cand-name" name="name" placeholder="Amara Chen" required />
          </div>

          {!jobId && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); setSelectedClient(""); }}>
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.title} value={r.title}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <Select
                  value={selectedClient}
                  onValueChange={setSelectedClient}
                  disabled={!selectedRole}
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue placeholder={selectedRole ? "Select client" : "Select role first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsForRole.map((c) => (
                      <SelectItem key={c.client_name} value={c.client_name}>
                        {c.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="name@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input name="location" placeholder="Boston, MA" />
            </div>
            <div className="space-y-1.5">
              <Label>LinkedIn</Label>
              <Input name="linkedin" placeholder="https://linkedin.com/in/…" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBMISSION_STATUSES.map((s) => (
                  <StatusSelectItem key={s} value={s} />
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === "submitted" && (
            <div className="space-y-1.5">
              <Label>Submitted date</Label>
              <SubmittedDatePicker value={submittedAt} onChange={(val) => setSubmittedAt(val || "")} />
            </div>
          )}

          {status === "interview" && (
            <div className="space-y-1.5">
              <Label>Interview date & time</Label>
              <InterviewSchedulePicker value={interviewAt} onChange={(val) => setInterviewAt(val || "")} />
            </div>
          )}

          {status === "rejected" && (
            <div className="space-y-1.5">
              <Label>Rejection reason (optional)</Label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection…"
                className="h-8 text-[13px]"
              />
            </div>
          )}
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
