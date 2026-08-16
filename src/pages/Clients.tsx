import { useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Building2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useClients, useDeleteClient } from "../hooks/useQueries";
import { useDebounce } from "../hooks/useDebounce";
import { PageLoader } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ClientForm } from "../components/clients/ClientForm";
import { errorMessage, timeAgo } from "../lib/utils";
import type { ClientWithStats } from "../types";

export function Clients() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWithStats | null>(null);
  const [deleting, setDeleting] = useState<ClientWithStats | null>(null);
  const deleteClient = useDeleteClient();
  const { data, isLoading } = useClients(debounced || undefined);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteClient.mutateAsync(deleting.id);
      toast.success("Client deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="Clients"
        subtitle={`${data?.length ?? 0} clients`}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Client
          </Button>
        }
      />

      <div className="mb-4 relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="No clients found"
          description={search ? "Try a different search." : "Add your first client to start recruiting."}
          action={
            !search ? (
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                New Client
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((client) => (
            <div
              key={client.id}
              className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/clients/${client.id}`} className="block">
                    <p className="truncate text-sm font-semibold text-fg hover:underline">{client.name}</p>
                  </Link>
                  {client.company && <p className="truncate text-xs text-fg-subtle">{client.company}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(client);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-fg-subtle hover:text-red-500"
                    onClick={() => setDeleting(client)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-6 border-t border-border pt-3.5">
                <Link to={`/clients/${client.id}`} className="group/stats flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-fg-subtle" />
                  <span className="text-sm font-semibold tabular-nums text-fg">{client.jobs_count}</span>
                  <span className="text-[11px] text-fg-subtle group-hover/stats:text-fg">
                    job{client.jobs_count !== 1 ? "s" : ""}
                  </span>
                </Link>
                <Link to={`/clients/${client.id}`} className="group/stats flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-fg-subtle" />
                  <span className="text-sm font-semibold tabular-nums text-fg">{client.candidates_count}</span>
                  <span className="text-[11px] text-fg-subtle group-hover/stats:text-fg">
                    candidate{client.candidates_count !== 1 ? "s" : ""}
                  </span>
                </Link>
                <span className="ml-auto text-[11px] text-fg-subtle">Updated {timeAgo(client.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editing ? { ...editing } : null}
        key={editing?.id ?? "new"}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete client?"
        description={`This will permanently delete "${deleting?.name}" and all of its jobs and candidates. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}