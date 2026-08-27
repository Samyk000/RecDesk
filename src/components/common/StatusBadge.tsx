import { cn, titleCase } from "../../lib/utils";
import { candidatePalette, jobPalette, submissionPalette } from "../../lib/constants";

interface Props {
  status: string;
  kind?: "submission" | "job" | "candidate";
  dot?: boolean;
  subStage?: string | null;
  className?: string;
}

export function StatusBadge({ status, kind = "submission", dot = true, subStage, className }: Props) {
  const palette =
    kind === "job" ? jobPalette(status) : kind === "candidate" ? candidatePalette(status) : submissionPalette(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", palette.badgeText, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.dot }} />}
      <span>{titleCase(status)}</span>
      {subStage && (
        <span className="opacity-85 text-[10.5px] font-normal">
          · {subStage}
        </span>
      )}
    </span>
  );
}