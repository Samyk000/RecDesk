import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "@phosphor-icons/react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CONTRACT_TYPES, JOB_STATUSES, WORK_MODELS } from "../../lib/constants";
import { errorMessage, titleCase } from "../../lib/utils";
import { useCreateJob, useClients, useJob, useUpdateJob } from "../../hooks/useQueries";
import { ClientForm } from "../clients/ClientForm";
import type { Client, JobInput } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  defaultClientId?: string;
}

const NEW_CLIENT = "__new__";

export function JobFormDialog({ open, onOpenChange, jobId, defaultClientId }: Props) {
  const navigate = useNavigate();
  const clientsQuery = useClients();
  const jobQuery = useJob(jobId);
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const isEdit = !!jobId;
  const job = jobQuery.data;
  const [clientId, setClientId] = useState(defaultClientId ?? job?.client_id ?? "");
  const [clientFormOpen, setClientFormOpen] = useState(false);

  // Reset form fields via uncontrolled DOM when dialog opens
  useEffect(() => {
    if (open) {
      setClientId(defaultClientId ?? job?.client_id ?? "");
      const set = (id: string, val: string | null | undefined) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.value = val ?? "";
      };
      set("job-form-title", job?.title);
      set("job-form-jobid", job?.job_id);
      set("job-form-location", job?.location);
      set("job-form-billrate", job?.bill_rate);
      set("job-form-payrate", job?.pay_rate);
      set("job-form-notes", job?.notes);
    }
  }, [open, job, defaultClientId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: JobInput = {
      client_id: clientId || "",
      job_id: (fd.get("job_id") as string) || "",
      title: (fd.get("title") as string) || "",
      location: (fd.get("location") as string) || null,
      work_model: (fd.get("work_model") as string) || null,
      contract_type: (fd.get("contract_type") as string) || null,
      bill_rate: (fd.get("bill_rate") as string) || null,
      pay_rate: (fd.get("pay_rate") as string) || null,
      status: (fd.get("status") as string) || "active",
      notes: (fd.get("notes") as string) || null,
      refined_jd: isEdit ? (job?.refined_jd ?? null) : null,
      boolean_strings: isEdit ? (job?.boolean_strings ?? []) : [],
      candidate_pitch: isEdit ? (job?.candidate_pitch ?? null) : null,
      screening_questions: isEdit ? (job?.screening_questions ?? []) : [],
      closed_at: isEdit ? (job?.closed_at ?? null) : null,
    };

    if (!input.client_id) {
      toast.error("Please select a client");
      return;
    }
    if (!input.title.trim()) {
      toast.error("Job title is required");
      return;
    }

    try {
      if (isEdit) {
        await updateJob.mutateAsync({ id: jobId!, input });
        toast.success("Job updated");
      } else {
        const created = await createJob.mutateAsync(input);
        toast.success("Job created");
        onOpenChange(false);
        navigate(`/jobs/${created.id}`);
        return;
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit job" : "New job"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details for this position." : "Create a new position to start recruiting."}
          </DialogDescription>
        </DialogHeader>

        <form id="job-form" onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="job-form-client">Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  if (v === NEW_CLIENT) {
                    setClientFormOpen(true);
                  } else {
                    setClientId(v);
                  }
                }}
              >
                <SelectTrigger id="job-form-client" className="w-full">
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  {clientsQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_CLIENT} className="text-primary">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      New client…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-form-jobid">Job ID</Label>
              <Input id="job-form-jobid" name="job_id" placeholder="REQ-12345" defaultValue={job?.job_id} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job-form-title">Job title</Label>
            <Input
              id="job-form-title"
              name="title"
              placeholder="e.g. Senior Java Developer"
              defaultValue={job?.title}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input name="location" placeholder="Boston, MA" defaultValue={job?.location ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Work model</Label>
              <Select name="work_model" defaultValue={job?.work_model ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Engagement</Label>
              <Select name="contract_type" defaultValue={job?.contract_type ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="job-form-billrate">Bill rate</Label>
              <Input id="job-form-billrate" name="bill_rate" placeholder="e.g. $120/hr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-form-payrate">Pay rate</Label>
              <Input id="job-form-payrate" name="pay_rate" placeholder="e.g. $90/hr" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue={job?.status ?? "active"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job-form-notes">Notes</Label>
            <Textarea
              id="job-form-notes"
              name="notes"
              rows={3}
              placeholder="Anything important to remember about this role…"
              defaultValue={job?.notes ?? ""}
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="job-form" variant="primary" disabled={createJob.isPending || updateJob.isPending}>
            {isEdit ? "Save changes" : "Create job"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ClientForm
        open={clientFormOpen}
        onOpenChange={setClientFormOpen}
        onCreated={(c: Client) => setClientId(c.id)}
      />
    </Dialog>
  );
}