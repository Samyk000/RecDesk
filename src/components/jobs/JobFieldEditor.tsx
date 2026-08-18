import { Check, CircleNotch } from "@phosphor-icons/react";
import { RichTextEditor } from "../common/RichTextEditor";
import { toJobInput } from "./tabUtils";
import { useJobAutosave } from "../../hooks/useJobAutosave";
import type { Job } from "../../types";

interface Props {
  job: Job;
  field: "refined_jd" | "candidate_pitch" | "notes";
  placeholder: string;
  mono?: boolean;
  minRows?: number;
  maxHeight?: number;
  fill?: boolean;
}

export function JobFieldEditor({ job, field, placeholder, mono, minRows = 12, maxHeight, fill }: Props) {
  const { value: draft, setValue: setDraft, state } = useJobAutosave(
    job,
    field,
    (value: string) => toJobInput(job, { [field]: value.length ? value : null }),
    (a, b) => a === b,
    700,
  );

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
    </div>
  );
}