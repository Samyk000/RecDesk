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
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useCreateClient, useUpdateClient } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/utils";
import type { Client, ClientInput } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onCreated?: (client: Client) => void;
}

export function ClientForm({ open, onOpenChange, client, onCreated }: Props) {
  const create = useCreateClient();
  const update = useUpdateClient();
  const isEdit = !!client;

  useEffect(() => {
    if (!open) return;
    const form = document.getElementById("client-form") as HTMLFormElement | null;
    form?.reset();
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: ClientInput = {
      name: (fd.get("name") as string) || "",
      company: client?.company ?? null,
      email: client?.email ?? null,
      hiring_manager: client?.hiring_manager ?? null,
      address: client?.address ?? null,
      notes: client?.notes ?? null,
    };
    if (!input.name.trim()) {
      toast.error("Client name is required");
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: client!.id, input });
        toast.success("Client updated");
      } else {
        const created = await create.mutateAsync(input);
        toast.success("Client added");
        onCreated?.(created);
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
          <DialogTitle>{isEdit ? "Edit client" : "Add client"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this client's details." : "Add a new client to track jobs and candidates."}
          </DialogDescription>
        </DialogHeader>

        <form id="client-form" onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Name *</Label>
            <Input id="client-name" name="name" placeholder="Sarah Mitchell" defaultValue={client?.name} required />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" variant="primary" disabled={create.isPending || update.isPending}>
            {isEdit ? "Save changes" : "Add client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}