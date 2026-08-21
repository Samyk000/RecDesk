export interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  hiring_manager?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInput {
  name: string;
  company?: string | null;
  email?: string | null;
  hiring_manager?: string | null;
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
  bill_rate?: string | null;
  pay_rate?: string | null;
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
  bill_rate?: string | null;
  pay_rate?: string | null;
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

export interface StatusHistoryEntry {
  id: string;
  from_status: string;
  to_status: string;
  changed_at: string;
  submitted_at?: string | null;
  interview_at?: string | null;
  placed_at?: string | null;
  rejection_reason?: string | null;
}

export interface InterviewFeedback {
  q1_duration_and_vibe?: string;
  q2_topics?: string[];
  q3_scope_and_team?: string;
  q4_availability_to_start?: string;
  q5_competing_interviews_and_rating?: string;
  q6_offer_acceptance_permission?: string;
  q7_decision_timeline?: string;
}

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
  linkedin_url?: string | null;
  recruiter_notes?: string | null;
  match_score?: number | null;
  submission_status: string;
  interview_status?: string | null;
  client_feedback?: string | null;
  candidate_status: string;
  submitted_at?: string | null;
  interview_at?: string | null;
  placed_at?: string | null;
  rejection_reason?: string | null;
  screening_answers?: string | null;
  submission_details?: string | null;
  status_history?: string | null;
  interview_feedback?: string | null;
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
  linkedin_url?: string | null;
  recruiter_notes?: string | null;
  match_score?: number | null;
  submission_status?: string | null;
  interview_status?: string | null;
  client_feedback?: string | null;
  candidate_status?: string | null;
  submitted_at?: string | null;
  interview_at?: string | null;
  placed_at?: string | null;
  rejection_reason?: string | null;
  screening_answers?: string | null;
  submission_details?: string | null;
  status_history?: string | null;
  interview_feedback?: string | null;
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
  submitted_at?: string | null;
  interview_at?: string | null;
  placed_at?: string | null;
  rejection_reason?: string | null;
  screening_answers?: string | null;
  submission_details?: string | null;
  status_history?: string | null;
  interview_feedback?: string | null;
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
  interview_candidates: number;
  placed_candidates: number;
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

export interface ExportEnvelope {
  version: number;
  exported_at: string;
  clients: Client[];
  jobs: Job[];
  candidates: Candidate[];
}

export type CandidateSubmissionStatus =
  | "sourced"
  | "in_touch"
  | "submitted"
  | "interview"
  | "placed"
  | "not_interested"
  | "rejected";

export interface ImportSummary {
  clients: number;
  jobs: number;
  candidates: number;
  replaced: boolean;
}

export type ThemeMode = "light" | "dark" | "system";
export type ThemeName =
  | "blue"
  | "teal"
  | "violet"
  | "sunset"
  | "forest"
  | "rose"
  | "emerald"
  | "amber"
  | "slate";