import { Briefcase, Building2, CalendarDays, Clock, FileUser, MapPin } from "lucide-react";
import type { JobWithStats } from "../../../types";
import { formatDate } from "../../../lib/utils";

export function OverviewTab({ job }: { job: JobWithStats }) {
  const fields = [
    {
      icon: Building2,
      label: "Client",
      value: job.client_name,
      to: `/clients/${job.client_id}`,
    },
    { icon: MapPin, label: "Location", value: job.location ?? "—" },
    { icon: Clock, label: "Work model", value: job.work_model ?? "—" },
    { icon: Briefcase, label: "Engagement", value: job.contract_type ?? "—" },
    { icon: FileUser, label: "Candidates", value: String(job.candidate_count) },
    { icon: CalendarDays, label: "Created", value: formatDate(job.created_at) },
  ];

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <h3 className="mb-3 text-[13px] font-semibold text-fg">Key details</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {fields.map((f) => (
            <div key={f.label} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-fg-subtle">
                <f.icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-fg-subtle">{f.label}</p>
                {f.to ? (
                  <a href={f.to} className="text-sm font-medium text-primary hover:underline">
                    {f.value}
                  </a>
                ) : (
                  <p className="truncate text-sm font-medium text-fg">{f.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-2 text-[13px] font-semibold text-fg">Pipeline</h3>
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
          {job.candidate_count}
        </p>
        <p className="text-xs text-fg-muted">candidates across this job</p>
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-fg-muted">Last updated</span>
            <span className="font-medium text-fg">{formatDate(job.updated_at)}</span>
          </div>
          {job.closed_at && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-fg-muted">Closed</span>
              <span className="font-medium text-fg">{formatDate(job.closed_at)}</span>
            </div>
          )}
        </div>
      </div>

      {(job.notes || job.refined_jd) && (
        <div className="col-span-3">
          <h3 className="mb-2 text-[13px] font-semibold text-fg">Quick snapshot</h3>
          <div className="rounded-lg border border-border bg-surface p-4">
            {job.notes && (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{job.notes}</p>
            )}
            {job.notes && job.refined_jd && <hr className="my-3 border-border" />}
            {job.refined_jd && (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted line-clamp-4">
                {job.refined_jd}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}