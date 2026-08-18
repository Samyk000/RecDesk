import { Funnel, X } from "@phosphor-icons/react";
import { SUBMISSION_STATUSES } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { StatusSelectItem } from "./StatusSelectItem";

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
          {SUBMISSION_STATUSES.map((s) => (
            <StatusSelectItem key={s} value={s} />
          ))}
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