import { ArrowCounterClockwise } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

interface Props {
  open: boolean;
  candidateName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetStatusConfirmDialog({
  open,
  candidateName,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-xs p-4 sm:max-w-sm">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-500">
              <ArrowCounterClockwise className="h-4 w-4" />
            </span>
            <DialogTitle className="text-sm font-semibold text-fg">
              Reset to Sourced?
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-fg-muted pt-1">
            Are you sure you want to reset <strong className="text-fg font-medium">{candidateName}</strong> to Sourced? This will clear active stage dates.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-3 flex-row gap-2 sm:flex-row sm:justify-end sm:space-x-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="flex-1 text-xs text-fg-subtle hover:text-fg cursor-pointer justify-center"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            className="flex-1 text-xs cursor-pointer justify-center"
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
