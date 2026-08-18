import { useEffect, useRef, useState } from "react";
import { Check, CircleNotch, Plus, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useUpdateJob } from "../../../hooks/useQueries";
import { useDebounce } from "../../../hooks/useDebounce";
import { toJobInput } from "../tabUtils";
import { Button } from "../../ui/button";
import { Input, Textarea } from "../../ui/input";
import { CopyButton } from "../../common/CopyButton";
import { errorMessage } from "../../../lib/utils";
import type { BooleanString, Job } from "../../../types";

export function BooleanTable({ job }: { job: Job }) {
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

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    return () => {
      const current = itemsRef.current;
      if (JSON.stringify(current) === JSON.stringify(jobRef.current.boolean_strings)) return;
      update.mutate({
        id: jobRef.current.id,
        input: toJobInput(jobRef.current, { boolean_strings: current }),
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => setItems([...items, { name: "", query: "" }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<BooleanString>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const copyAll = items.filter((i) => i.query.trim()).map((i) => i.query.trim()).join("\n\n");

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MagnifyingGlass className="h-4 w-4 text-fg-subtle" />
          <h3 className="text-[13px] font-semibold text-fg">Boolean search strings</h3>
        </div>
        <div className="flex items-center gap-2">
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
          {copyAll && <CopyButton text={copyAll} label="Copy all" />}
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            Add string
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-surface/40 px-4 py-6">
          <div>
            <p className="text-[13px] font-medium text-fg">No boolean strings yet</p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Add the search queries you use to source candidates for this role.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            Add your first string
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[200px]" />
              <col />
              <col className="w-[110px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface-hover/40 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Boolean string</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-fg-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, i) => (
                <tr key={i} className="transition-colors focus-within:bg-surface-hover/30">
                  <td className="px-4 py-2.5">
                    <Input
                      value={item.name}
                      onChange={(e) => patch(i, { name: e.target.value })}
                      placeholder={i === 0 ? "Tight" : i === 1 ? "Normal" : i === 2 ? "Broad" : "Name"}
                      className="h-8 text-[12px] font-medium"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Textarea
                      value={item.query}
                      onChange={(e) => patch(i, { query: e.target.value })}
                      placeholder='("Senior Java Developer" OR "Java Engineer") AND (Spring Boot OR microservices) AND Boston'
                      minRows={1}
                      className="py-1.5 font-mono text-[12px] leading-relaxed"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <CopyButton text={item.query} label="Copy" />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-fg-subtle hover:text-red-500"
                        onClick={() => remove(i)}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}