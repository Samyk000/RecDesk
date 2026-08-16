import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Textarea } from "../ui/input";
import { useUpdateJob } from "../../hooks/useQueries";
import { useDebounce } from "../../hooks/useDebounce";
import { toJobInput } from "./tabUtils";
import { cn, errorMessage } from "../../lib/utils";
import { toast } from "sonner";
import type { Job } from "../../types";

interface Props {
  job: Job;
  field: "refined_jd" | "candidate_pitch" | "notes";
  placeholder: string;
  mono?: boolean;
  minRows?: number;
  hint?: string;
}

export function JobFieldEditor({ job, field, placeholder, mono, minRows = 12, hint }: Props) {
  const update = useUpdateJob();
  const [draft, setDraft] = useState(job[field] ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounced = useDebounce(draft, 700);
  const initialized = useRef(false);

  useEffect(() => {
    setDraft(job[field] ?? "");
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const server = job[field] ?? "";
    if (debounced === server) return;
    setState("saving");
    update.mutate(
      { id: job.id, input: toJobInput(job, { [field]: debounced.length ? debounced : null }) },
      {
        onSuccess: () => {
          setState("saved");
          setTimeout(() => setState("idle"), 1500);
        },
        onError: (err) => {
          setState("error");
          toast.error(errorMessage(err));
          setTimeout(() => setState("idle"), 2000);
        },
      },
    );
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          minRows={minRows}
          className={cn("resize-y leading-relaxed", mono && "font-mono text-[13px]")}
        />
        <div className="pointer-events-none absolute right-3 top-2.5 flex items-center gap-1.5">
          {state === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {state === "error" && (
            <span className="flex items-center gap-1 text-[11px] text-red-500">Error</span>
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}