import { BookOpen, CalendarDays, FileUser, NotebookPen, RefreshCcw } from "lucide-react";
import { JobFieldEditor } from "../JobFieldEditor";
import { BooleanTable } from "./BooleanTable";
import type { JobWithStats } from "../../../types";
import { formatDate } from "../../../lib/utils";

export function OverviewTab({ job }: { job: JobWithStats }) {
  const details = [
    { icon: FileUser, label: "Candidates", value: String(job.candidate_count) },
    { icon: CalendarDays, label: "Created", value: formatDate(job.created_at) },
    { icon: RefreshCcw, label: "Updated", value: formatDate(job.updated_at) },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 items-stretch gap-6">
        <div className="col-span-2 flex min-h-[300px] flex-col">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold text-fg">Job description</h3>
          </div>
          <div className="flex-1">
            <JobFieldEditor
              job={job}
              field="refined_jd"
              placeholder="Paste or write the refined job description used for recruiting…"
              minRows={12}
              fill
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-3 text-[13px] font-semibold text-fg">Key details</h3>
            <div className="space-y-3">
              {details.map((d) => (
                <div key={d.label} className="flex items-center gap-2.5">
                  <span className="mt-0.5 text-fg-subtle">
                    <d.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-fg-subtle">{d.label}</p>
                    <p className="truncate text-sm font-medium text-fg">{d.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-[180px] flex-1 flex-col">
            <div className="mb-3 flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-fg-subtle" />
              <h3 className="text-[13px] font-semibold text-fg">Quick notes</h3>
            </div>
            <div className="flex-1">
              <JobFieldEditor
                job={job}
                field="notes"
                placeholder="Free-form recruiting notes… (rates, timelines, client preferences, follow-ups)"
                minRows={4}
                fill
              />
            </div>
          </div>
        </div>
      </div>

      <BooleanTable job={job} />
    </div>
  );
}