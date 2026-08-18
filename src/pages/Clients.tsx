import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Building, PencilSimple, Plus, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useClients, useDeleteClient, useMoveClient } from "../hooks/useQueries";
import { useDebounce } from "../hooks/useDebounce";
import { useFlipList } from "../hooks/useFlipList";
import { PageLoader } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ClientForm } from "../components/clients/ClientForm";
import { cn, errorMessage, timeAgo } from "../lib/utils";
import type { ClientWithStats } from "../types";

const COLS = "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_64px_90px_110px_auto]";

export function Clients() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWithStats | null>(null);
  const [deleting, setDeleting] = useState<ClientWithStats | null>(null);
  const deleteClient = useDeleteClient();
  const moveClient = useMoveClient();
  const flipRef = useFlipList();
  const { data, isLoading } = useClients(debounced || undefined);
  const canReorder = !debounced;

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
    <div className="px-6 pt-4">
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
        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
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
          icon={<Building className="h-5 w-5" />}
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
        <div ref={flipRef} className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className={cn("grid items-center border-b border-border bg-surface-hover/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted", COLS)}>
            <span>Name</span>
            <span>Company</span>
            <span>Jobs</span>
            <span>Candidates</span>
            <span>Updated</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {data.map((client, i) => {
              return (
                <div
                  key={client.id}
                  data-flip-id={client.id}
                  className={cn("group grid items-center px-4 py-2.5 transition-all duration-150 hover:bg-surface-hover active:bg-surface-active", COLS)}
                >
                  <div>
                    <Link to={`/clients/${client.id}`} className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-active text-fg-muted transition-transform duration-150 group-hover:scale-110">
                        <Building className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[13px] font-medium text-fg transition-colors duration-150 group-hover:text-primary">
                        {client.name}
                      </span>
                    </Link>
                  </div>
                  <div className="text-[13px] text-fg-muted">{client.company ?? "-"}</div>
                  <div className="text-[13px] tabular-nums text-fg">{client.jobs_count}</div>
                  <div className="text-[13px] tabular-nums text-fg">{client.candidates_count}</div>
                  <div className="text-xs text-fg-muted">{timeAgo(client.updated_at)}</div>
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Move up"
                      disabled={!canReorder || i === 0 || moveClient.isPending}
                      onClick={() => moveClient.mutate({ id: client.id, direction: -1 })}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Move down"
                      disabled={!canReorder || i === data.length - 1 || moveClient.isPending}
                      onClick={() => moveClient.mutate({ id: client.id, direction: 1 })}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditing(client);
                        setFormOpen(true);
                      }}
                    >
                      <PencilSimple className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-fg-subtle hover:text-red-500"
                      onClick={() => setDeleting(client)}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
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