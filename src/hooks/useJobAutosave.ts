import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUpdateJob } from "./useQueries";
import { useDebounce } from "./useDebounce";
import { errorMessage } from "../lib/utils";
import type { Job, JobInput } from "../types";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

export function useJobAutosave<T>(
  job: Job,
  field: keyof Job,
  toInput: (value: T) => JobInput,
  equals: (a: T, b: T) => boolean,
  debounceMs = 600,
) {
  const update = useUpdateJob();
  const [value, setValue] = useState<T>(job[field] as T);
  const [state, setState] = useState<AutosaveState>("idle");
  const debounced = useDebounce(value, debounceMs);
  const initialized = useRef(false);

  useEffect(() => {
    setValue(job[field] as T);
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (equals(debounced, job[field] as T)) return;
    setState("saving");
    update.mutate(
      { id: job.id, input: toInput(debounced) },
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

  const valueRef = useRef(value);
  valueRef.current = value;
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    return () => {
      const current = valueRef.current;
      if (equals(current, jobRef.current[field] as T)) return;
      update.mutate({ id: jobRef.current.id, input: toInput(current) });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { value, setValue, state };
}