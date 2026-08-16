export interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInput {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface ClientWithStats extends Client {
  jobs_count: number;
  candidates_count: number;
}

export interface BooleanString {
  name: string;
  query: string;
}

export interface Job {
  id: string;
  client_id: string;
  job_id: string;
  title: string;
  location?: string | null;
  work_model?: string | null;
  contract_type?: string | null;
  status: string;
  refined_jd?: string | null;
  boolean_strings: BooleanString[];
  candidate_pitch?: string | null;
  screening_questions: string[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
}

export interface JobInput {
  client_id: string;
  job_id: string;
  title: string;
  location?: string | null;
  work_model?: string | null;
  contract_type?: string | null;
  status?: string | null;
  refined_jd?: string | null;
  boolean_strings: BooleanString[];
  candidate_pitch?: string | null;
  screening_questions: string[];
  notes?: string | null;
  closed_at?: string | null;
}

export interface JobWithStats extends Job {
  candidate_count: number;
  client_name: string;
}

export interface JobCounts {
  total: number;
  active: number;
  closed: number;
  on_hold: number;
}

export type SubmissionStatus =
  | "new"
  | "submitted"
  | "interviewing"
  | "offer"
  | "hired"
  | "rejected";

export type CandidateStatus = "active" | "inactive" | "archived";

export interface Candidate {
  id: string;
  job_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  current_title?: string | null;
  current_company?: string | null;
  experience_years?: number | null;
  resume_path?: string | null;
  recruiter_notes?: string | null;
  match_score?: number | null;
  submission_status: string;
  interview_status?: string | null;
  client_feedback?: string | null;
  candidate_status: string;
  date_added: string;
  last_updated: string;
}

export interface CandidateInput {
  job_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  current_title?: string | null;
  current_company?: string | null;
  experience_years?: number | null;
  resume_path?: string | null;
  recruiter_notes?: string | null;
  match_score?: number | null;
  submission_status?: string | null;
  interview_status?: string | null;
  client_feedback?: string | null;
  candidate_status?: string | null;
}

export interface CandidateWithJob extends Candidate {
  job_title: string;
  job_id_ref: string;
  client_name: string;
}

export interface CandidatePatch {
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  current_title?: string | null;
  current_company?: string | null;
  experience_years?: number | null;
  recruiter_notes?: string | null;
  match_score?: number | null;
  submission_status?: string | null;
  interview_status?: string | null;
  client_feedback?: string | null;
  candidate_status?: string | null;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardStats {
  active_jobs: number;
  total_jobs: number;
  total_candidates: number;
  total_clients: number;
  candidates_needing_action: number;
  on_hold_jobs: number;
  candidates_by_status: StatusCount[];
  jobs_by_status: StatusCount[];
  recent_jobs: JobWithStats[];
  recent_candidates: Candidate[];
}

export interface SearchResults {
  clients: Client[];
  jobs: JobWithStats[];
  candidates: CandidateWithJob[];
}

export interface ImportSummary {
  clients: number;
  jobs: number;
  candidates: number;
  replaced: boolean;
}

export type ThemeMode = "light" | "dark" | "system";