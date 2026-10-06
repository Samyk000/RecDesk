import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClients, apiCandidates, apiDashboard, apiFiles, apiJobs, apiResumeParser } from "../lib/api";
import type {
  CandidateInput,
  CandidatePatch,
  ClientInput,
  JobInput,
} from "../types";

// ---- Clients ----
export function useClients(search?: string) {
  return useQuery({
    queryKey: ["clients", search ?? ""],
    queryFn: () => apiClients.list(search),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: () => apiClients.get(id!),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => apiClients.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClientInput }) =>
      apiClients.update(id, input),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClients.remove(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}


// ---- Jobs ----
export function useJobs(clientId?: string, status?: string, search?: string) {
  return useQuery({
    queryKey: ["jobs", clientId ?? "", status ?? "", search ?? ""],
    queryFn: () => apiJobs.list(clientId, status, search),
  });
}

export function useJob(id: string | null | undefined) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: () => apiJobs.get(id!),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JobInput) => apiJobs.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useUpdateJob(options?: { scoped?: boolean }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: JobInput }) =>
      apiJobs.update(id, input),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["job", job.id] });
      if (!options?.scoped) {
        qc.invalidateQueries({ queryKey: ["jobs"] });
        qc.invalidateQueries({ queryKey: ["clients"] });
        qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["globalSearch"] });
      }
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJobs.remove(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}


export function useBulkUpdateJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiJobs.bulkUpdateStatus(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useBulkDeleteJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiJobs.bulkRemove(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

// ---- Candidates ----
export function useCandidates(jobId?: string, status?: string, search?: string) {
  return useQuery({
    queryKey: ["candidates", jobId ?? "", status ?? "", search ?? ""],
    queryFn: () => apiCandidates.list(jobId, status, search),
  });
}

export function useCandidatesWithJob(search?: string, status?: string) {
  return useQuery({
    queryKey: ["candidatesWithJob", search ?? "", status ?? ""],
    queryFn: () => apiCandidates.withJob(undefined, search, status),
  });
}

export function useInfiniteCandidatesWithJob(
  search?: string,
  status?: string,
  clientId?: string,
  pageSize = 50,
  sortBy?: string,
  sortDir?: string,
) {
  return useInfiniteQuery({
    queryKey: [
      "candidatesWithJob",
      "infinite",
      search ?? "",
      status ?? "",
      clientId ?? "",
      sortBy ?? "",
      sortDir ?? "",
    ],
    queryFn: ({ pageParam = 0 }) =>
      apiCandidates.withJob(
        clientId,
        search,
        status,
        pageSize,
        pageParam as number,
        sortBy,
        sortDir,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return (lastPageParam as number) + pageSize;
    },
  });
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: ["candidate", id],
    queryFn: () => apiCandidates.get(id!),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CandidateInput) => apiCandidates.create(input),
    onSuccess: (cand) => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["job", cand.job_id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useUpdateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CandidateInput }) =>
      apiCandidates.update(id, input),
    onSuccess: (cand, vars) => {
      qc.setQueryData(["candidate", cand.id], cand);

      const affectsMetrics =
        vars.input.submission_status !== undefined ||
        vars.input.interview_status !== undefined ||
        vars.input.submitted_at !== undefined ||
        vars.input.interview_at !== undefined ||
        vars.input.placed_at !== undefined ||
        vars.input.rejection_reason !== undefined ||
        vars.input.candidate_status !== undefined;

      const affectsJob = vars.input.job_id !== undefined;

      if (affectsMetrics || affectsJob) {
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["jobs"] });
        qc.invalidateQueries({ queryKey: ["job", cand.job_id] });
      }

      if (vars.input.name !== undefined || vars.input.current_title !== undefined) {
        qc.invalidateQueries({ queryKey: ["globalSearch"] });
      }

      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
    },
  });
}

export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiCandidates.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["job"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useAttachResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sourcePath }: { id: string; sourcePath: string }) =>
      apiFiles.attachResume(id, sourcePath),
    onSuccess: (cand) => {
      qc.setQueryData(["candidate", cand.id], cand);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["job", cand.job_id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useRemoveResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFiles.removeResume(id),
    onSuccess: (cand) => {
      qc.setQueryData(["candidate", cand.id], cand);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["job", cand.job_id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useRenameResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newFilename }: { id: string; newFilename: string }) =>
      apiFiles.renameResume(id, newFilename),
    onSuccess: (cand) => {
      qc.setQueryData(["candidate", cand.id], cand);
      qc.invalidateQueries({ queryKey: ["candidate", cand.id] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["job", cand.job_id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useBulkUpdateCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: CandidatePatch }) =>
      apiCandidates.bulkUpdate(ids, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["candidate"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

export function useBulkDeleteCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiCandidates.bulkRemove(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidatesWithJob"] });
      qc.invalidateQueries({ queryKey: ["job"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["globalSearch"] });
    },
  });
}

// ---- Dashboard ----
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiDashboard.stats(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

// ---- Local Resume Parsing ----
export function useParseResume() {
  return useMutation({
    mutationFn: (args: string | {
      text: string;
      filename?: string;
      embeddedLinks?: string[];
    }) => {
      if (typeof args === "string") {
        return apiResumeParser.parseResume(args);
      }
      return apiResumeParser.parseResume(
        args.text,
        args.filename,
        args.embeddedLinks,
      );
    },
  });
}




