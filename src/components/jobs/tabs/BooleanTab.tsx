import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUpdateJob } from "../../../hooks/useQueries";
import { useDebounce } from "../../../hooks/useDebounce";
import { toJobInput } from "../tabUtils";
import { Button } from "../../ui/button";
import { Input, Textarea } from "../../ui/input";
import { CopyButton } from "../../common/CopyButton";
import { EmptyState } from "../../common/EmptyState";
import { errorMessage } from "../../../lib/utils";
import type { BooleanString, Job } from "../../../types";

export function BooleanTab({ job }: { job: Job }) {
  const update = useUpdateJob();
  const [items, setItems] = useState<BooleanString[]>(job.boolean_strings);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const debounced = useDebounce(items, 600);

  useEffect(() => {
    setItems(job.boolean_strings);
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (JSON.stringify(debounced) === JSON.stringify(job.boolean_strings)) return;
    setState("saving");
    update.mutate(
      { id: job.id, input: toJobInput(job, { boolean_strings: debounced }) },
      {
        onSuccess: () => {
          setState("saved");
          setTimeout(() => setState("idle"), 1500);
        },
        onError: (err) => {
          toast.error(errorMessage(err));
          setState("idle");
        },
      },
    );
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => setItems([...items, { name: "", query: "" }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<BooleanString>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const copyAll = items.filter((i) => i.query.trim()).map((i) => i.query.trim()).join("\n\n");

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fg">Boolean search strings</h3>
          <p className="text-xs text-fg-subtle">
            Multiple saved queries for sourcing — tight, normal, broad, location-specific.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          {copyAll && <CopyButton text={copyAll} label="Copy all" />}
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            Add string
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Plus className="h-5 w-5" />}
          title="No boolean strings yet"
          description="Add the search queries you use to source candidates for this role."
          action={
            <Button variant="primary" size="sm" onClick={add}>
              <Plus className="h-4 w-4" />
              Add your first string
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-3 transition-colors focus-within:border-primary/50"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  placeholder={i === 0 ? "Tight" : i === 1 ? "Normal" : i === 2 ? "Broad" : "Name"}
                  className="h-8 w-44 text-[13px] font-medium"
                />
                <div className="ml-auto flex items-center gap-1">
                  <CopyButton text={item.query} label="Copy" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-fg-subtle hover:text-red-500"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={item.query}
                onChange={(e) => patch(i, { query: e.target.value })}
                placeholder='("Senior Java Developer" OR "Java Engineer") AND (Spring Boot OR microservices) AND Boston'
                minRows={2}
                className="mt-2 font-mono text-[13px] leading-relaxed"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}