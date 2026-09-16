import { submissionIcon, submissionPalette } from "../../lib/constants";
import { titleCase } from "../../lib/utils";
import { SelectItem } from "../ui/select";

export function StatusSelectItem({ value }: { value: string }) {
  const StatusIcon = submissionIcon(value);
  return (
    <SelectItem value={value}>
      <span className="flex items-center gap-1.5 min-w-0">
        <StatusIcon className="h-3.5 w-3.5 shrink-0" style={{ color: submissionPalette(value).dot }} />
        <span className="truncate">{titleCase(value)}</span>
      </span>
    </SelectItem>
  );
}