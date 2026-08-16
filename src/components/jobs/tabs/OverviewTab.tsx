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
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-[13px] font-semibold text-fg">Key details</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
          {fields.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-hover text-fg-muted">
                <f.icon className="h-4 w-4" />
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

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-[13px] font-semibold text-fg">Pipeline</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-fg">
            {job.candidate_count}
          </p>
          <p className="mt-0.5 text-[13px] text-fg-muted">candidates across this job</p>
          <div className="mt-4 space-y-2">
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
      </div>

      {(job.notes || job.refined_jd) && (
        <div className="col-span-3 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-[13px] font-semibold text-fg">Quick snapshot</h3>
          </div>
          <div className="px-5 py-4">
            {job.notes && (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{job.notes}</p>
            )}
            {job.notes && job.refined_jd && <hr className="my-4 border-border" />}
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