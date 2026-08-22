import { useEffect, useMemo, useState } from "react";
import { Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { PlacedDatePicker } from "./PlacedDatePicker";
import { ResumeAutoFillDialog } from "./ResumeAutoFillDialog";
import type { CandidateInput, ExtractedCandidateProfile, JobWithStats } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
}

export function CandidateForm({ open, onOpenChange, jobId }: Props) {
  const create = useCreateCandidate();
  const { data: allJobs } = useJobs();

  const [autoFillOpen, setAutoFillOpen] = useState(false);

  // Controlled form states
  const [name, setName] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const [selectedRole, setSelectedRole] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(jobId ?? "");
  const [status, setStatus] = useState("sourced");
  const [submittedAt, setSubmittedAt] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [placedAt, setPlacedAt] = useState("");
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
    setName("");
    setCurrentTitle("");
    setEmail("");
    setPhone("");
    setLocation("");
    setLinkedin("");
    setSelectedRole("");
    setSelectedClient("");
    setSelectedJobId(jobId ?? "");
    setStatus("sourced");
    setSubmittedAt("");
    setInterviewAt("");
    setPlacedAt("");
    setRejectionReason("");
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

  function handleApplyExtracted(profile: ExtractedCandidateProfile) {
    if (profile.name) setName(profile.name);
    if (profile.current_role) setCurrentTitle(profile.current_role);
    if (profile.location) setLocation(profile.location);
    if (profile.email) setEmail(profile.email);
    if (profile.phone) setPhone(profile.phone);
    if (profile.linkedin_url) setLinkedin(profile.linkedin_url);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedJobId) {
      toast.error("Please select a role and client");
      return;
    }

    const input: CandidateInput = {
      job_id: selectedJobId,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      location: location.trim() || null,
      current_title: currentTitle.trim() || null,
      linkedin_url: linkedin.trim() || null,
      submission_status: status,
      candidate_status: "active",
      submitted_at: status === "submitted" ? submittedAt || null : null,
      interview_at: status === "interview" ? interviewAt || null : null,
      placed_at: status === "placed" ? placedAt || null : null,
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 pr-12">
            <div>
              <DialogTitle className="text-base font-semibold text-fg">Add candidate</DialogTitle>
              <DialogDescription className="text-xs text-fg-subtle">
                Add a candidate to track for this job.
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7.5 gap-1.5 px-2.5 text-xs font-medium text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 transition cursor-pointer shrink-0"
              onClick={() => setAutoFillOpen(true)}
            >
              <Lightning className="h-3.5 w-3.5 text-primary" />
              Auto-Fill
            </Button>
          </div>

          <form id="candidate-form" onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cand-name">Name *</Label>
                <Input
                  id="cand-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Amara Chen"
                  required
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cand-title">Current Title / Role</Label>
                <Input
                  id="cand-title"
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>
            </div>

            {!jobId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-1.5">
                  <Label>Job Role *</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(v) => {
                      setSelectedRole(v);
                      setSelectedClient("");
                    }}
                  >
                    <SelectTrigger className="h-8 text-[13px] min-w-0 w-full" title={selectedRole || undefined}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.title} value={r.title} title={r.title}>
                          <span className="truncate block">{r.title}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label>Client *</Label>
                  <Select
                    value={selectedClient}
                    onValueChange={setSelectedClient}
                    disabled={!selectedRole}
                  >
                    <SelectTrigger className="h-8 text-[13px] min-w-0 w-full" title={selectedClient || undefined}>
                      <SelectValue placeholder={selectedRole ? "Select client" : "Select role first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsForRole.map((c) => (
                        <SelectItem key={c.client_name} value={c.client_name} title={c.client_name}>
                          <span className="truncate block">{c.client_name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="name@email.com"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Boston, MA"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label>LinkedIn</Label>
                <Input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/…"
                />
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
              <SubmittedDatePicker
                value={submittedAt || null}
                onChange={(v) => setSubmittedAt(v ?? "")}
              />
            )}

            {status === "interview" && (
              <InterviewSchedulePicker
                value={interviewAt || null}
                onChange={(v) => setInterviewAt(v ?? "")}
              />
            )}

            {status === "placed" && (
              <PlacedDatePicker
                value={placedAt || null}
                onChange={(v) => setPlacedAt(v ?? "")}
              />
            )}

            {status === "rejected" && (
              <div className="space-y-1.5">
                <Label htmlFor="cand-rej-reason">Rejection Reason</Label>
                <Input
                  id="cand-rej-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Failed technical round"
                />
              </div>
            )}
          </form>

          <DialogFooter className="border-t border-border bg-surface px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="candidate-form"
              variant="primary"
              className="text-xs"
              disabled={create.isPending}
            >
              {create.isPending ? "Adding…" : "Add candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResumeAutoFillDialog
        open={autoFillOpen}
        onOpenChange={setAutoFillOpen}
        onApply={handleApplyExtracted}
      />
    </>
  );
}
