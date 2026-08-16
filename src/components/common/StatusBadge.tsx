import { cn, titleCase } from "../../lib/utils";
import { candidatePalette, jobPalette, submissionPalette } from "../../lib/constants";

interface Props {
  status: string;
  kind?: "submission" | "job" | "candidate";
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ status, kind = "submission", dot = true, className }: Props) {
  const palette =
    kind === "job" ? jobPalette(status) : kind === "candidate" ? candidatePalette(status) : submissionPalette(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        palette.badge,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.dot }} />}
      {titleCase(status)}
    </span>
  );
}

export function StatusChip({ status, kind = "submission", className }: Props) {
  const palette =
    kind === "job" ? jobPalette(status) : kind === "candidate" ? candidatePalette(status) : submissionPalette(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        palette.chip,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.dot }} />
      {titleCase(status)}
    </span>
  );
}