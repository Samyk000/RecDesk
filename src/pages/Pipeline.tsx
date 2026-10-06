import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowsLeftRight,
  BookmarksSimple,
  IdentificationCard,
  ListChecks,
  Plus,
  Tag,
  Trash,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  useBulkUpdateCandidates,
  useBulkDeleteCandidates,
  useInfiniteCandidatesWithJob,
  useDeleteCandidate,
} from "../hooks/useQueries";
import { InfiniteScrollTrigger } from "../components/common/InfiniteScrollTrigger";
import { useDebounce } from "../hooks/useDebounce";
import { useSelection } from "../hooks/useSelection";
import { useTableSort, SortIcon } from "../hooks/useTableSort";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/common/EmptyState";
import { SearchInput } from "../components/common/SearchInput";
import { PageLoader } from "../components/common/Spinner";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { CandidateForm } from "../components/candidates/CandidateForm";
import { StatusChangeDialog } from "../components/candidates/StatusChangeDialog";
import { SubmissionStatusSelect } from "../components/candidates/SubmissionStatusSelect";
import { CandidateDetailPanel } from "../components/candidates/CandidateDetailPanel";
import { DetailDrawer } from "../components/common/DetailDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown";
import { ChangeJobDialog } from "../components/candidates/ChangeJobDialog";
import { apiCandidates } from "../lib/api";
import {
  getCandidateSkills,
  type CandidateSortKey,
} from "../lib/candidateUtils";
import { BULK_STATUSES, submissionPalette } from "../lib/constants";
import { cn, errorMessage, nameInitials, timeAgo, titleCase } from "../lib/utils";
import type { Candidate, CandidateWithJob } from "../types";

const DETAIL_STATUSES = new Set(["submitted", "interview", "placed", "rejected"]);

export function Pipeline() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const { sortKey, sortDir, toggleSort } = useTableSort<CandidateSortKey>("last_updated");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [matchCandidateTarget, setMatchCandidateTarget] = useState<Candidate | null>(null);
  const [statusDialog, setStatusDialog] = useState<{
    candidate: CandidateWithJob;
    status: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<CandidateWithJob | null>(null);

  const bulkUpdate = useBulkUpdateCandidates();
  const bulkDelete = useBulkDeleteCandidates();
  const deleteCandidate = useDeleteCandidate();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteCandidatesWithJob(
    debounced || undefined,
    "pipeline",
    undefined,
    50,
    sortKey,
    sortDir,
  );

  const allLoadedCandidates = useMemo(() => {
    return data?.pages.flatMap((page) => page) ?? [];
  }, [data]);

  // Extract all unique skills across loaded pipelined candidates (case-insensitive deduplication)
  const availableSkills = useMemo(() => {
    const counts = new Map<string, { display: string; count: number }>();
    for (const c of allLoadedCandidates) {
      const skills = getCandidateSkills(c);
      for (const s of skills) {
        const lower = s.toLowerCase();
        const existing = counts.get(lower);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(lower, { display: s, count: 1 });
        }
      }
    }
    return Array.from(counts.values())
      .map((entry) => [entry.display, entry.count] as [string, number])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [allLoadedCandidates]);

  // Filter candidates by multiple selected skills
  const filteredCandidates = useMemo(() => {
    return allLoadedCandidates.filter((c) => {
      if (selectedSkills.length > 0) {
        const candidateSkills = getCandidateSkills(c);
        const matchesAll = selectedSkills.every((req) =>
          candidateSkills.some((s) => s.toLowerCase() === req.toLowerCase()),
        );
        if (!matchesAll) return false;
      }
      return true;
    });
  }, [allLoadedCandidates, selectedSkills]);

  const displayedCandidates = filteredCandidates;

  const selection = useSelection(
    displayedCandidates.map((c) => c.id),
    `${selectedSkills.join(",")}|${debounced}|${selectMode}`,
  );

  function handleToggleSkill(skill: string) {
    setSelectedSkills((prev) => {
      if (prev.some((s) => s.toLowerCase() === skill.toLowerCase())) {
        return prev.filter((s) => s.toLowerCase() !== skill.toLowerCase());
      }
      return [...prev, skill];
    });
  }

  function handleStatusChange(candidate: CandidateWithJob, nextStatus: string) {
    if (DETAIL_STATUSES.has(nextStatus)) {
      setStatusDialog({ candidate, status: nextStatus });
      return;
    }
    bulkUpdate.mutate(
      { ids: [candidate.id], patch: { submission_status: nextStatus } },
      {
        onSuccess: () => toast.success(`${candidate.name} marked ${titleCase(nextStatus)}`),
        onError: () => toast.error("Failed to update status"),
      },
    );
  }

  function handleBulkStatus(value: string) {
    if (!selection.selected.size) return;
    const ids = Array.from(selection.selected);
    bulkUpdate.mutate(
      { ids, patch: { submission_status: value } },
      {
        onSuccess: () => {
          toast.success(`Updated ${ids.length} candidate(s) to ${titleCase(value)}`);
          selection.clear();
        },
        onError: () => toast.error("Failed to update candidates"),
      },
    );
  }

  function handleBulkDelete() {
    if (!selection.selected.size) return;
    const ids = Array.from(selection.selected);
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        toast.success(`Deleted ${ids.length} candidate(s)`);
        selection.clear();
        setBulkDeleteOpen(false);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  function handleDelete() {
    if (!deleting) return;
    deleteCandidate.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`Deleted ${deleting.name}`);
        setDeleting(null);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  const handleOpenMatchDialog = async (e: React.MouseEvent, c: CandidateWithJob) => {
    e.stopPropagation();
    try {
      const fullCand = await apiCandidates.get(c.id);
      setMatchCandidateTarget(fullCand);
    } catch {
      toast.error("Failed to load candidate details for job match");
    }
  };

  const filtered = selectedSkills.length > 0 || search.length > 0;

  function clearFilters() {
    setSearch("");
    setSelectedSkills([]);
  }

  function openPanel(id: string) {
    const next = new URLSearchParams(params);
    next.set("candidate", id);
    setParams(next, { replace: true });
  }

  function closePanel() {
    const next = new URLSearchParams(params);
    next.delete("candidate");
    setParams(next, { replace: true });
  }

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Pipeline
            <span className="rounded-md bg-surface-active px-2 py-0.5 text-[13px] font-medium text-fg-muted">
              {displayedCandidates.length}
            </span>
          </span>
        }
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Candidate
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search pipeline…"
          className="w-full max-w-xs"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer transition-all",
                selectedSkills.length > 0
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border text-fg-subtle hover:bg-surface-hover hover:text-fg",
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>
                {selectedSkills.length === 0
                  ? "Skills"
                  : `${selectedSkills.length} skill${selectedSkills.length > 1 ? "s" : ""}`}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto p-1 scrollbar-thin">
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted px-2 py-1">
              Filter by skills
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableSkills.length === 0 ? (
              <div className="px-2 py-2 text-xs text-fg-muted italic text-center">No skills found</div>
            ) : (
              availableSkills.map(([skill, count]) => {
                const isSelected = selectedSkills.some(
                  (s) => s.toLowerCase() === skill.toLowerCase(),
                );
                return (
                  <DropdownMenuItem
                    key={skill}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleToggleSkill(skill);
                    }}
                    className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                      <span className="truncate">{skill}</span>
                    </div>
                    <span className="text-[10px] text-fg-subtle tabular-nums">{count}</span>
                  </DropdownMenuItem>
                );
              })
            )}
            {selectedSkills.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setSelectedSkills([])}
                  className="justify-center text-xs text-red-500 font-medium py-1.5 focus:text-red-600 cursor-pointer"
                >
                  Clear skills ({selectedSkills.length})
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Selected Skill Tags */}
        {selectedSkills.map((sk) => (
          <span
            key={sk}
            className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary border border-primary/20"
          >
            <span>{sk}</span>
            <button
              type="button"
              onClick={() => handleToggleSkill(sk)}
              className="text-primary hover:text-red-500 cursor-pointer"
              aria-label={`Remove ${sk} filter`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {filtered && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-fg-subtle hover:text-fg"
            title="Clear filters"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

        <div className="ml-auto">
          <Button
            size="icon"
            variant="ghost"
            title={selectMode ? "Exit select mode" : "Select candidates"}
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) selection.clear();
            }}
            className={selectMode ? "bg-surface-active text-fg" : "text-fg-muted"}
          >
            <ListChecks className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectMode && selection.selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs">
          <span className="font-medium text-fg">{selection.selected.size} selected</span>
          <div className="mx-2 h-4 w-px bg-border" />
          <Select onValueChange={handleBulkStatus}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {BULK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: submissionPalette(s).dot }} />
                    {titleCase(s)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={selection.clear}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <PageLoader state="solving" label="Loading pipeline candidates…" />
        ) : !displayedCandidates.length ? (
          <EmptyState
            icon={
              filtered ? (
                <IdentificationCard className="h-5 w-5" />
              ) : (
                <BookmarksSimple className="h-5 w-5 text-indigo-500" />
              )
            }
            title={filtered ? "No candidates found" : "No candidates in pipeline"}
            description={
              filtered
                ? "Try adjusting your search or filters."
                : "Candidates saved to your pipeline appear here."
            }
            action={
              filtered ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs"
                >
                  Clear Filters
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Candidate
                </Button>
              )
            }
          />
        ) : (
          <div className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left">
                    {selectMode && (
                      <th className="sticky top-0 z-10 w-10 bg-surface px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selection.allSelected}
                          onChange={selection.toggleAll}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                        />
                      </th>
                    )}
                    <th className="sticky top-0 z-10 w-[230px] max-w-[250px] bg-surface px-4 py-2">
                      <button
                        onClick={() => toggleSort("candidate_title")}
                        className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                      >
                        Candidate &amp; Role <SortIcon active={sortKey === "candidate_title"} dir={sortDir} />
                      </button>
                    </th>
                    <th className="sticky top-0 z-10 w-[85px] whitespace-nowrap bg-surface px-3 py-2">
                      <button
                        onClick={() => toggleSort("experience_years")}
                        className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                      >
                        Exp <SortIcon active={sortKey === "experience_years"} dir={sortDir} />
                      </button>
                    </th>
                    <th className="sticky top-0 z-10 min-w-[150px] max-w-[200px] whitespace-nowrap bg-surface px-3 py-2 text-xs font-semibold text-fg-muted">
                      Skills &amp; Tech
                    </th>
                    <th className="sticky top-0 z-10 max-w-[170px] bg-surface px-3 py-2">
                      <button
                        onClick={() => toggleSort("job_title")}
                        className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                      >
                        Job <SortIcon active={sortKey === "job_title"} dir={sortDir} />
                      </button>
                    </th>
                    <th className="sticky top-0 z-10 max-w-[130px] bg-surface px-3 py-2">
                      <button
                        onClick={() => toggleSort("client_name")}
                        className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                      >
                        Client <SortIcon active={sortKey === "client_name"} dir={sortDir} />
                      </button>
                    </th>
                    <th className="sticky top-0 z-10 min-w-[155px] whitespace-nowrap bg-surface px-4 py-2 text-xs font-semibold text-fg-muted">
                      Status
                    </th>
                    <th className="sticky top-0 z-10 min-w-[120px] whitespace-nowrap bg-surface px-3 py-2">
                      <button
                        onClick={() => toggleSort("location")}
                        className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                      >
                        Location <SortIcon active={sortKey === "location"} dir={sortDir} />
                      </button>
                    </th>
                    <th className="sticky top-0 z-10 whitespace-nowrap bg-surface px-3 py-2">
                      <button
                        onClick={() => toggleSort("last_updated")}
                        className="group inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
                      >
                        Updated <SortIcon active={sortKey === "last_updated"} dir={sortDir} />
                      </button>
                    </th>
                    <th className="sticky top-0 z-10 w-20 bg-surface px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedCandidates.map((c) => {
                    const skills = getCandidateSkills(c);

                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "group cursor-pointer transition-colors hover:bg-surface-hover",
                          selection.selected.has(c.id) && "bg-primary/5 hover:bg-primary/5",
                        )}
                        onClick={() => (selectMode ? selection.toggle(c.id) : openPanel(c.id))}
                      >
                        {selectMode && (
                          <td className="w-10 px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selection.selected.has(c.id)}
                              onChange={() => selection.toggle(c.id)}
                              className="h-3.5 w-3.5 rounded border-border accent-primary"
                            />
                          </td>
                        )}
                        <td className="w-[230px] max-w-[250px] px-4 py-1.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                              style={{
                                background: `${submissionPalette(c.submission_status).dot}1f`,
                                color: submissionPalette(c.submission_status).dot,
                              }}
                            >
                              {nameInitials(c.name)}
                            </span>
                            <div className="min-w-0 max-w-[185px]">
                              <p className="truncate text-[13px] font-semibold text-fg transition-colors duration-150 group-hover:text-primary">
                                {c.name}
                              </p>
                              {c.current_title ? (
                                <p className="truncate text-[10.5px] text-zinc-600 dark:text-zinc-300 font-normal" title={c.current_title}>
                                  {c.current_title}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="w-[85px] whitespace-nowrap px-3 py-1.5 text-[11.5px] tabular-nums">
                          {c.experience_years != null ? (
                            <span className="inline-flex items-center rounded bg-surface-hover px-1.5 py-0.5 border border-border/70 font-medium text-fg">
                              {c.experience_years} yrs
                            </span>
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </td>
                        <td className="min-w-[150px] max-w-[200px] px-3 py-1.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {(() => {
                              if (!skills || skills.length === 0) {
                                return <span className="text-[11px] text-fg-muted">—</span>;
                              }
                              const displaySkills = skills.slice(0, 2);
                              const remainder = skills.slice(2);
                              return (
                                <>
                                  {displaySkills.map((sk) => (
                                    <span
                                      key={sk}
                                      className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 truncate max-w-[85px]"
                                      title={sk}
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                  {remainder.length > 0 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center rounded px-1 py-0.2 text-[9.5px] font-medium bg-surface-hover text-fg-subtle border border-border cursor-default hover:border-primary/40 hover:text-primary transition-colors">
                                          +{remainder.length}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-[260px] p-2 bg-surface text-fg border border-border shadow-xl rounded-lg z-50 text-left"
                                      >
                                        <div className="mb-1.5 flex items-center justify-between border-b border-border/60 pb-1">
                                          <span className="text-[10.5px] font-semibold text-fg-subtle">
                                            Additional Skills (+{remainder.length})
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 max-h-[160px] overflow-y-auto [scrollbar-width:thin]">
                                          {remainder.map((sk) => (
                                            <span
                                              key={sk}
                                              className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary border border-primary/20"
                                            >
                                              {sk}
                                            </span>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="max-w-[170px] px-3 py-1.5 text-[12px] font-medium text-zinc-800 dark:text-zinc-200" title={c.job_title}>
                          <p className="truncate">{c.job_title}</p>
                        </td>
                        <td className="max-w-[130px] px-3 py-1.5 text-[12px] font-medium text-zinc-800 dark:text-zinc-200" title={c.client_name}>
                          <p className="truncate">{c.client_name}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <SubmissionStatusSelect
                              value={c.submission_status}
                              triggerClassName="h-7 w-[116px] text-[11px]"
                              onValueChange={(v) => {
                                if (v === c.submission_status) return;
                                handleStatusChange(c, v);
                              }}
                            />
                          </div>
                        </td>
                        <td className="min-w-[120px] whitespace-nowrap px-3 py-1.5 text-[12px] text-zinc-700 dark:text-zinc-300">
                          {c.location ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-zinc-600 dark:text-zinc-300 tabular-nums">
                          {timeAgo(c.last_updated)}
                        </td>
                        <td className="w-20 px-3 py-1.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-fg-subtle hover:text-indigo-600 hover:bg-indigo-500/10 cursor-pointer"
                                  onClick={(e) => handleOpenMatchDialog(e, c)}
                                >
                                  <ArrowsLeftRight className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Match to Job</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-fg-subtle hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleting(c);
                                  }}
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <InfiniteScrollTrigger
                onIntersect={() => fetchNextPage()}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border bg-surface-hover/40 px-4 py-2 text-xs text-fg-subtle">
              <div>
                {displayedCandidates.length === 0
                  ? "0 candidates"
                  : `Showing ${displayedCandidates.length} candidate${displayedCandidates.length !== 1 ? "s" : ""}${hasNextPage ? " · Scroll down for more" : " · All loaded"}`}
              </div>
              {hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                  className="h-6 px-2 text-xs font-normal"
                >
                  {isFetchingNextPage ? "Streaming..." : "Load More"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <CandidateForm open={formOpen} onOpenChange={setFormOpen} />

      {params.get("candidate") && (
        <DetailDrawer onClose={closePanel}>
          <CandidateDetailPanel candidateId={params.get("candidate")!} onClose={closePanel} />
        </DetailDrawer>
      )}

      {statusDialog && (
        <StatusChangeDialog
          candidate={statusDialog.candidate}
          initialStatus={statusDialog.status}
          onClose={() => setStatusDialog(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete candidate"
          description={`Are you sure you want to delete ${deleting.name}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          title="Delete candidates"
          description={`Are you sure you want to delete ${selection.selected.size} candidate(s)? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleBulkDelete}
        />
      )}

      {matchCandidateTarget && (
        <ChangeJobDialog
          candidate={matchCandidateTarget}
          open={!!matchCandidateTarget}
          onOpenChange={(open) => {
            if (!open) setMatchCandidateTarget(null);
          }}
          initialMode="move"
          onSuccess={() => {
            setMatchCandidateTarget(null);
            toast.success("Candidate matched to job!");
          }}
        />
      )}
    </div>
  );
}
