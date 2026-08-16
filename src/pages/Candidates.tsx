import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUser, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiCandidates } from "../lib/api";
import { useDebounce } from "../hooks/useDebounce";
import { Input } from "../components/ui/input";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";
import { submissionPalette } from "../lib/constants";
import { timeAgo } from "../lib/utils";

export function Candidates() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);

  const { data, isLoading } = useQuery({
    queryKey: ["candidatesWithJob", debounced],
    queryFn: () => apiCandidates.withJob(undefined, debounced || undefined),
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="pl-9"
          />
        </div>
        <span className="ml-auto text-xs text-fg-subtle">
          {data ? `${data.length} candidate${data.length !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {isLoading ? (
        <Spinner className="py-16" />
      ) : !data?.length ? (
        <EmptyState
          icon={<FileUser className="h-5 w-5" />}
          title="No candidates"
          description={
            debounced
              ? "Try a different search."
              : "Candidates appear here when added to jobs."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/40 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Job</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Client</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Match</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Location</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer transition-colors hover:bg-surface-hover"
                  onClick={() => navigate(`/candidates/${c.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          background: `${submissionPalette(c.submission_status).dot}1f`,
                          color: submissionPalette(c.submission_status).dot,
                        }}
                      >
                        {c.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                        {c.email && (
                          <p className="truncate text-[11px] text-fg-subtle">{c.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{c.job_title}</td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{c.client_name}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={c.submission_status} />
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">
                    {c.match_score != null ? c.match_score : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{c.location ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-muted">{timeAgo(c.last_updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
