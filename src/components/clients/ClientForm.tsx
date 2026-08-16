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
import { useCreateClient, useUpdateClient } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/utils";
import type { Client, ClientInput } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

export function ClientForm({ open, onOpenChange, client }: Props) {
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
      company: (fd.get("company") as string) || null,
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      address: (fd.get("address") as string) || null,
      notes: (fd.get("notes") as string) || null,
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
        await create.mutateAsync(input);
        toast.success("Client added");
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">Name *</Label>
              <Input id="client-name" name="name" placeholder="John Smith" defaultValue={client?.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input name="company" placeholder="Acme Corp" defaultValue={client?.company ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="john@acme.com" defaultValue={client?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" placeholder="+1 (555) 000-0000" defaultValue={client?.phone ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input name="address" placeholder="1 Main St, Boston, MA" defaultValue={client?.address ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" rows={3} placeholder="Client preferences, rate agreement, communication style…" defaultValue={client?.notes ?? ""} />
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