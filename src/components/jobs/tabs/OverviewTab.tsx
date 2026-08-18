import { ArrowClockwise, BookOpen, CurrencyDollar, NotePencil } from "@phosphor-icons/react";
import { JobFieldEditor } from "../JobFieldEditor";
import { BooleanTable } from "./BooleanTable";
import type { JobWithStats } from "../../../types";
import { formatDate } from "../../../lib/utils";

export function OverviewTab({ job }: { job: JobWithStats }) {
  const details = [
    { icon: ArrowClockwise, label: "Updated", value: formatDate(job.updated_at) },
    { icon: CurrencyDollar, label: "Bill rate", value: job.bill_rate ?? "-" },
    { icon: CurrencyDollar, label: "Pay rate", value: job.pay_rate ?? "-" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 items-stretch gap-6">
        <div className="col-span-2 flex flex-col">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold text-fg">Job description</h3>
          </div>
          <div className="relative min-h-[264px] flex-1">
            <div className="absolute inset-0">
              <JobFieldEditor
                job={job}
                field="refined_jd"
                placeholder="Paste or write the refined job description used for recruiting…"
                minRows={12}
                fill
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-3 text-[13px] font-semibold text-fg">Key details</h3>
            <div className="grid grid-cols-3 gap-3">
              {details.map((d) => (
                <div key={d.label} className="min-w-0">
                  <p className="flex items-center gap-1 text-[11px] text-fg-subtle">
                    <d.icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{d.label}</span>
                  </p>
                  <p className="mt-1 truncate text-[13px] font-medium tabular-nums text-fg">{d.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-[180px] flex-1 flex-col">
            <div className="mb-3 flex items-center gap-2">
              <NotePencil className="h-4 w-4 text-fg-subtle" />
              <h3 className="text-[13px] font-semibold text-fg">Quick notes</h3>
            </div>
            <div className="relative flex-1">
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