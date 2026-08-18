import { submissionIcon, submissionPalette } from "../../lib/constants";
import { titleCase } from "../../lib/utils";
import { SelectItem } from "../ui/select";

export function StatusSelectItem({ value }: { value: string }) {
  const StatusIcon = submissionIcon(value);
  return (
    <SelectItem value={value}>
      <span className="flex items-center gap-1.5">
        <StatusIcon className="h-3.5 w-3.5" style={{ color: submissionPalette(value).dot }} />
        {titleCase(value)}
      </span>
    </SelectItem>
  );
}