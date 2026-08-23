import { invoke } from "@tauri-apps/api/core";
import type {
  Candidate,
  CandidateInput,
  CandidatePatch,
  CandidateWithJob,
  Client,
  ClientInput,
  ClientWithStats,
  DashboardStats,
  ImportSummary,
  JobInput,
  JobWithStats,
  SearchResults,
} from "../types";

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

// ---- Clients ----
export const apiClients = {
  list: (search?: string) => call<ClientWithStats[]>("get_clients", { search }),
  get: (id: string) => call<ClientWithStats>("get_client", { id }),
  create: (input: ClientInput) => call<Client>("create_client", { input }),
  update: (id: string, input: ClientInput) => call<Client>("update_client", { id, input }),
  remove: (id: string) => call<void>("delete_client", { id }),
  move: (id: string, direction: number) => call<void>("move_client", { id, direction }),
};

// ---- Jobs ----
export const apiJobs = {
  list: (clientId?: string, status?: string, search?: string) =>
    call<JobWithStats[]>("get_jobs", { clientId, status, search }),
  get: (id: string) => call<JobWithStats>("get_job", { id }),
  create: (input: JobInput) => call<JobWithStats>("create_job", { input }),
  update: (id: string, input: JobInput) => call<JobWithStats>("update_job", { id, input }),
  remove: (id: string) => call<void>("delete_job", { id }),
  move: (id: string, direction: number) => call<void>("move_job", { id, direction }),
};

// ---- Candidates ----
export const apiCandidates = {
  list: (jobId?: string, status?: string, search?: string) =>
    call<Candidate[]>("get_candidates", { jobId, status, search }),
  get: (id: string) => call<Candidate>("get_candidate", { id }),
  create: (input: CandidateInput) => call<Candidate>("create_candidate", { input }),
  update: (id: string, input: CandidateInput) => call<Candidate>("update_candidate", { id, input }),
  remove: (id: string) => call<void>("delete_candidate", { id }),
  bulkUpdate: (ids: string[], patch: CandidatePatch) =>
    call<number>("bulk_update_candidates", { ids, patch }),
  bulkRemove: (ids: string[]) => call<number>("delete_candidates", { ids }),
  withJob: (clientId?: string, search?: string, status?: string) =>
    call<CandidateWithJob[]>("get_candidates_with_job", { clientId, search, status }),
};

// ---- Dashboard / Search ----
export const apiDashboard = {
  stats: () => call<DashboardStats>("get_dashboard_stats"),
};

export const apiSearch = {
  global: (query: string) => call<SearchResults>("global_search", { query }),
};

// ---- Data ----
export const apiData = {
  export: () => call<string>("export_data"),
  import: (json: string, replace: boolean) => call<ImportSummary>("import_data", { json, replace }),
};

// ---- Files ----
export const apiFiles = {
  attachResume: (candidateId: string, sourcePath: string) =>
    call<Candidate>("attach_resume", { candidateId, sourcePath }),
  removeResume: (candidateId: string) => call<Candidate>("remove_resume", { candidateId }),
  renameResume: (candidateId: string, newFilename: string) =>
    call<Candidate>("rename_resume", { candidateId, newFilename }),
  readResumeBytes: (filePath: string) => call<number[]>("read_resume_bytes", { filePath }),
  writeResumeBytes: (filePath: string, bytes: number[]) =>
    call<void>("write_resume_bytes", { filePath, bytes }),
};

// ---- AI & Model Manager ----
export const apiAi = {
  getModels: () => call<import("../types").AiModelInfo[]>("get_ai_models_status"),
  downloadModel: (modelId: string) => call<string>("download_ai_model", { modelId }),
  cancelDownloadModel: (modelId: string) => call<boolean>("cancel_ai_download", { modelId }),
  deleteModel: (modelId: string) => call<boolean>("delete_ai_model", { modelId }),
  parseResume: (text: string) =>
    call<import("../types").ExtractedCandidateProfile>("parse_resume_text", { text }),
};

// ---- OCR Model Manager ----
export const apiOcr = {
  getStatus: () => call<import("../types").OcrModelInfo>("get_ocr_model_status"),
  downloadModel: (modelId: string) => call<string>("download_ocr_model", { modelId }),
  cancelDownload: (modelId: string) => call<void>("cancel_ocr_download", { modelId }),
  deleteModel: (modelId: string) => call<void>("delete_ocr_model", { modelId }),
};