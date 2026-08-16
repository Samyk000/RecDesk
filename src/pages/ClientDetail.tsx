import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  StickyNote,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  useClient,
  useDeleteClient,
  useJobs,
  useUpdateClient,
} from "../hooks/useQueries";
import { PageLoader } from "../components/common/Spinner";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/input";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ClientForm } from "../components/clients/ClientForm";
import { JobFormDialog } from "../components/jobs/JobFormDialog";
import { jobPalette } from "../lib/constants";
import { errorMessage, timeAgo } from "../lib/utils";
import type { ClientWithStats, ClientInput } from "../types";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id);
  if (isLoading || !client) return <PageLoader label="Loading client…" />;
  return <ClientDetailBody key={client.id} client={client} />;
}

function ClientDetailBody({ client }: { client: ClientWithStats }) {
  const navigate = useNavigate();
  const { data: jobs } = useJobs(client.id);
  const update = useUpdateClient();
  const deleteClient = useDeleteClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newJobOpen, setNewJobOpen] = useState(false);

  async function saveField(field: keyof ClientInput, value: string) {
    const input: ClientInput = {
      name: client.name,
      company: client.company,
      email: client.email,
      hiring_manager: client.hiring_manager,
      address: client.address,
      notes: client.notes,
      [field]: value || null,
    };
    try {
      await update.mutateAsync({ id: client.id, input });
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleDelete() {
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("Client deleted");
      navigate("/clients");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="px-6 pt-4">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/clients"))}
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </button>

      <PageHeader
        title={client.name}
        subtitle={client.company ?? "Client"}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="primary" onClick={() => setNewJobOpen(true)}>
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-raise">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Contact
            </h3>
            <Field
              icon={<Mail className="h-3.5 w-3.5" />}
              placeholder="No email"
              value={client.email ?? ""}
              onSave={(v) => saveField("email", v)}
            />
            <Field
              icon={<User className="h-3.5 w-3.5" />}
              placeholder="No hiring manager"
              value={client.hiring_manager ?? ""}
              onSave={(v) => saveField("hiring_manager", v)}
            />
            <Field
              icon={<MapPin className="h-3.5 w-3.5" />}
              placeholder="No address"
              value={client.address ?? ""}
              onSave={(v) => saveField("address", v)}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-raise">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <StickyNote className="h-3.5 w-3.5" />
              Notes
            </h3>
            <Textarea
              key={client.notes ?? ""}
              defaultValue={client.notes ?? ""}
              rows={6}
              placeholder="Client preferences, rate agreement, communication style…"
              className="text-[13px]"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (client.notes ?? "")) return;
                saveField("notes", v);
              }}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 text-xs text-fg-subtle shadow-raise">
            <p className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Created {timeAgo(client.created_at)}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5">
              Updated {timeAgo(client.updated_at)}
            </p>
          </div>
        </aside>

        <section>
          <h2 className="font-display mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
            <Briefcase className="h-4 w-4 text-fg-subtle" />
            Jobs
            <span className="rounded-full bg-surface-active px-2 py-0.5 text-[11px] font-medium text-fg-muted">
              {jobs?.length ?? 0}
            </span>
          </h2>

          {!jobs || jobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title="No jobs for this client yet"
              description="Create a job to start tracking candidates for this client."
              action={
                <Button variant="primary" size="sm" onClick={() => setNewJobOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Job
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-raise">
              <div className="divide-y divide-border">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="group flex cursor-pointer items-center gap-4 px-4 py-3 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: jobPalette(job.status).dot }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-fg transition-colors duration-150 group-hover:text-primary">{job.title}</p>
                        <StatusBadge status={job.status} kind="job" className="shrink-0" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-fg-subtle">
                        <span className="font-mono text-[11px]">{job.job_id}</span>
                        {job.location && (
                          <>
                            <span className="mx-1.5">·</span>
                            {job.location}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold tabular-nums text-fg">{job.candidate_count}</p>
                      <p className="text-[11px] text-fg-subtle">candidates</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <ClientForm open={editOpen} onOpenChange={setEditOpen} client={client} key={client.id} />
      <JobFormDialog open={newJobOpen} onOpenChange={setNewJobOpen} defaultClientId={client.id} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete client?"
        description={`This will permanently delete "${client.name}" and all of its jobs and candidates. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteClient.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Field({
  icon,
  value,
  placeholder,
  onSave,
}: {
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border/60 py-2 last:border-b-0">
      <span className="shrink-0 text-fg-subtle">{icon}</span>
      <input
        defaultValue={value}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-muted/70"
        onBlur={(e) => {
          if (e.target.value.trim() === value) return;
          onSave(e.target.value.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}