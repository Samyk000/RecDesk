import { Prohibit } from "@phosphor-icons/react";
import { SUBMISSION_STATUSES, submissionIcon, submissionPalette } from "../../lib/constants";
import { titleCase } from "../../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

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
      <SelectContent>
        {SUBMISSION_STATUSES.map((s) => {
          const StatusIcon = submissionIcon(s);
          return (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-1.5">
                <StatusIcon className="h-3.5 w-3.5" style={{ color: submissionPalette(s).dot }} />
                {titleCase(s)}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}