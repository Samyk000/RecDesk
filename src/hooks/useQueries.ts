import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClients, apiCandidates, apiDashboard, apiJobs } from "../lib/api";
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
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClients.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
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

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: () => apiJobs.get(id!),
    enabled: !!id,
  });
}

export function useJobCounts() {
  return useQuery({
    queryKey: ["jobCounts"],
    queryFn: () => apiJobs.counts(),
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
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: JobInput }) =>
      apiJobs.update(id, input),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", job.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJobs.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
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
      qc.invalidateQueries({ queryKey: ["job", cand.job_id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CandidateInput }) =>
      apiCandidates.update(id, input),
    onSuccess: (cand) => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidate", cand.id] });
      qc.invalidateQueries({ queryKey: ["job", cand.job_id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiCandidates.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
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
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---- Dashboard ----
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiDashboard.stats(),
  });
}