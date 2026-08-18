import { Prohibit } from "@phosphor-icons/react";
import { SUBMISSION_STATUSES, submissionPalette } from "../../lib/constants";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { StatusSelectItem } from "./StatusSelectItem";

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
}

export function SubmissionStatusSelect({ value, onValueChange, triggerClassName }: Props) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={triggerClassName}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue
          className={`min-w-0 flex-1 truncate ${value === "not_interested" ? "text-center text-[10px]" : ""}`}
          title="Not Interested"
        >
          {value === "not_interested" ? (
            <span className="flex items-center justify-center gap-1">
              <Prohibit className="h-3 w-3" style={{ color: submissionPalette("not_interested").dot }} />
              NI
            </span>
          ) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[var(--radix-select-trigger-width)]">
        {SUBMISSION_STATUSES.map((s) => (
          <StatusSelectItem key={s} value={s} />
        ))}
      </SelectContent>
    </Select>
  );
}