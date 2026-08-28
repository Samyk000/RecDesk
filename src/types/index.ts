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

export type SubmissionType = "internal" | "client";

export type RejectionOrigin =
  | "internal"
  | "client_screening"
  | "interview"
  | "general"
  | "candidate_withdrew";

export interface InterviewRound {
  id: string;
  round_number: number;
  round_name: string;
  scheduled_at?: string | null;
  interviewer?: string | null;
  meeting_link?: string | null;
  notes?: string | null;
  status: "scheduled" | "completed" | "passed" | "rejected";
}

export interface RejectionDetail {
  origin: RejectionOrigin;
  round_number?: number | null;
  category?: string | null;
  reason?: string | null;
  rejected_at?: string | null;
}

export interface StatusHistoryEntry {
  from_status: string;
  to_status: string;
  timestamp: string;
  sub_stage?: string | null;
  notes?: string | null;
}

export interface ImportSummary {
  clients: number;
  jobs: number;
  candidates: number;
  reminders?: number;
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

export interface ExtractedCandidateProfile {
  name: string;
  email?: string | null;
  phone?: string | null;
  current_role?: string | null;
  experience_years?: number | null;
  skills: string[];
  location?: string | null;
  linkedin_url?: string | null;
  notes_summary?: string | null;
}

export interface AiModelInfo {
  id: string;
  name: string;
  tier: "fast" | "balanced" | "precision" | string;
  size_mb: number;
  description: string;
  filename: string;
  download_url: string;
  is_downloaded: boolean;
  file_path?: string | null;
}

export interface DownloadProgressPayload {
  model_id: string;
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
  is_complete: boolean;
}

export interface OcrModelInfo {
  id: string;
  name: string;
  size_mb: number;
  description: string;
  filename: string;
  download_url: string;
  is_downloaded: boolean;
  file_path?: string | null;
}

export interface OcrDownloadProgressPayload {
  model_id: string;
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
  is_complete: boolean;
}

export type ReminderCategory = "reminder" | "task" | "meeting";
export type ReminderPriority = "low" | "medium" | "high";
export type ReminderStatus = "pending" | "completed" | "snoozed" | "dismissed";

export interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  category: ReminderCategory;
  due_date: string;
  due_time?: string | null;
  timezone: string;
  remind_at: string;
  priority: ReminderPriority;
  notify_before_minutes: number;
  status: ReminderStatus;
  snoozed_until?: string | null;
  candidate_id?: string | null;
  job_id?: string | null;
  client_id?: string | null;
  meeting_link?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderInput {
  title: string;
  description?: string | null;
  category?: ReminderCategory | null;
  due_date: string;
  due_time?: string | null;
  timezone?: string | null;
  remind_at?: string | null;
  priority?: ReminderPriority | null;
  notify_before_minutes?: number | null;
  status?: ReminderStatus | null;
  snoozed_until?: string | null;
  candidate_id?: string | null;
  job_id?: string | null;
  client_id?: string | null;
  meeting_link?: string | null;
}

export interface ReminderWithContext extends Reminder {
  candidate_name?: string | null;
  job_title?: string | null;
  client_name?: string | null;
}
