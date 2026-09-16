import { ArrowUUpLeft } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { titleCase } from "../../lib/utils";

interface Props {
  open: boolean;
  candidateName: string;
  currentStatus: string;
  targetStatus: string;
  onConfirm: (preserveMilestone: boolean) => void;
  onCancel: () => void;
}

export function BackwardStatusConfirmDialog({
  open,
  candidateName,
  currentStatus,
  targetStatus,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-xs p-4 sm:max-w-sm">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ArrowUUpLeft className="h-4 w-4" />
            </span>
            <DialogTitle className="text-sm font-semibold text-fg">
              Move backward to {titleCase(targetStatus)}?
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-fg-muted pt-1">
            <strong className="text-fg font-medium">{candidateName}</strong> is currently{" "}
            <span className="font-medium text-fg">{titleCase(currentStatus)}</span>. Do you want to keep their milestone history for your metrics?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-3 flex-col gap-1.5 sm:flex-col sm:gap-1.5 sm:space-x-0">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onConfirm(true)}
            className="w-full text-xs cursor-pointer justify-center"
          >
            Keep History & Move
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onConfirm(false)}
            className="w-full text-xs text-fg-muted hover:text-red-500 cursor-pointer justify-center"
          >
            Reset Dates & Move
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="w-full text-xs text-fg-subtle hover:text-fg cursor-pointer justify-center"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
