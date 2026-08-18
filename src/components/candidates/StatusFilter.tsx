import { Funnel, X } from "@phosphor-icons/react";
import { SUBMISSION_STATUSES, submissionIcon, submissionPalette } from "../../lib/constants";
import { cn, titleCase } from "../../lib/utils";
import { Button } from "../ui/button";
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
  filtered: boolean;
  onClear: () => void;
}

export function StatusFilter({ value, onValueChange, filtered, onClear }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 w-40 text-[13px]">
          <Funnel
            className={cn("h-3.5 w-3.5 shrink-0", filtered ? "text-primary" : "text-fg-subtle")}
          />
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width)]">
          <SelectItem value="all">All statuses</SelectItem>
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
      {filtered && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Clear filters"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}