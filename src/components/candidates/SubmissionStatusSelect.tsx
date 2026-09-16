import { Prohibit } from "@phosphor-icons/react";
import { SUBMISSION_STATUSES, submissionIcon, submissionPalette } from "../../lib/constants";
import { cn, titleCase } from "../../lib/utils";
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
  const StatusIcon = submissionIcon(value);
  const palette = submissionPalette(value);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn("px-2 gap-1.5", triggerClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue
          className={`min-w-0 flex-1 truncate ${value === "not_interested" ? "text-center text-[10px]" : ""}`}
          title={value === "not_interested" ? "Not Interested" : titleCase(value)}
        >
          {value === "not_interested" ? (
            <span className="flex items-center justify-center gap-1">
              <Prohibit className="h-3 w-3 shrink-0" style={{ color: palette.dot }} />
              NI
            </span>
          ) : (
            <span className="flex items-center gap-1.5 min-w-0">
              <StatusIcon className="h-3.5 w-3.5 shrink-0" style={{ color: palette.dot }} />
              <span className="truncate">{titleCase(value)}</span>
            </span>
          )}
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