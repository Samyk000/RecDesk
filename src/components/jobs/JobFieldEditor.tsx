import { useEffect, useRef, useState } from "react";
import { Check, CircleNotch } from "@phosphor-icons/react";
import { RichTextEditor } from "../common/RichTextEditor";
import { useUpdateJob } from "../../hooks/useQueries";
import { useDebounce } from "../../hooks/useDebounce";
import { toJobInput } from "./tabUtils";
import { errorMessage } from "../../lib/utils";
import { toast } from "sonner";
import type { Job } from "../../types";

interface Props {
  job: Job;
  field: "refined_jd" | "candidate_pitch" | "notes";
  placeholder: string;
  mono?: boolean;
  minRows?: number;
  maxHeight?: number;
  fill?: boolean;
  hint?: string;
}

export function JobFieldEditor({ job, field, placeholder, mono, minRows = 12, maxHeight, fill, hint }: Props) {
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

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    return () => {
      const current = draftRef.current;
      const server = jobRef.current[field] ?? "";
      if (current === server || current === undefined) return;
      update.mutate({
        id: jobRef.current.id,
        input: toJobInput(jobRef.current, { [field]: current.length ? current : null }),
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={fill ? "h-full space-y-2" : "space-y-2"}>
      <div className={fill ? "relative h-full" : "relative"}>
        <RichTextEditor
          value={draft}
          onUpdate={(html) => setDraft(html)}
          placeholder={placeholder}
          minHeight={Math.max(minRows * 22, 140)}
          maxHeight={maxHeight}
          fill={fill}
          collapsibleToolbar
          mono={mono}
        />
        <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-1.5">
          {state === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <CircleNotch className="h-3 w-3 animate-spin" /> Saving…
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