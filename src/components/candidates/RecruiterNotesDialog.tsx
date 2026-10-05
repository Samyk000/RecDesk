import { useEffect, useState } from "react";
import { NotePencil, Check, CircleNotch } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { RichTextEditor } from "../common/RichTextEditor";

interface Props {
  candidateName: string;
  notes: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (notes: string | null) => void;
  saving?: boolean;
}

export function RecruiterNotesDialog({
  candidateName,
  notes,
  open,
  onOpenChange,
  onSave,
  saving = false,
}: Props) {
  const [content, setContent] = useState(notes ?? "");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(notes ?? "");
      setHasChanges(false);
    }
  }, [open, notes]);

  const handleChange = (newVal: string) => {
    setContent(newVal);
    setHasChanges(true);
    // Real-time autosave
    onSave(newVal || null);
  };

  const handleClose = () => {
    if (hasChanges) {
      onSave(content || null);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] w-full max-w-[680px] overflow-hidden p-0 flex flex-col shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-surface/80 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <NotePencil className="h-4 w-4" weight="bold" />
            </span>
            <div>
              <DialogTitle className="text-sm font-semibold text-fg">
                Recruiter Notes · {candidateName || "Candidate"}
              </DialogTitle>
              <DialogDescription className="text-xs text-fg-subtle">
                Private notes, intake observations, and background details
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
                <CircleNotch className="h-3 w-3 animate-spin text-primary" />
                Saving…
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          <RichTextEditor
            value={content}
            onChange={handleChange}
            placeholder="Type confidential recruiter notes, compensation expectations, screening takeaways, or call notes here…"
            minHeight={280}
            fill
          />
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-surface/50">
          <p className="text-[11px] text-fg-muted">
            Notes auto-save as you type and remain strictly internal.
          </p>
          <Button
            size="sm"
            onClick={handleClose}
            className="h-8 px-4 text-xs font-medium cursor-pointer"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
