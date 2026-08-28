use serde::{Deserialize, Serialize};

use super::{Candidate, CandidateWithJob, JobWithStats};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub active_jobs: i64,
    pub total_jobs: i64,
    pub total_candidates: i64,
    pub total_clients: i64,
    pub candidates_needing_action: i64,
    pub interview_candidates: i64,
    pub placed_candidates: i64,
    pub on_hold_jobs: i64,
    pub candidates_by_status: Vec<StatusCount>,
    pub jobs_by_status: Vec<StatusCount>,
    pub recent_jobs: Vec<JobWithStats>,
    pub recent_candidates: Vec<Candidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResults {
    pub clients: Vec<super::client::Client>,
    pub jobs: Vec<JobWithStats>,
    pub candidates: Vec<CandidateWithJob>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSummary {
    pub clients: usize,
    pub jobs: usize,
    pub candidates: usize,
    #[serde(default)]
    pub reminders: usize,
    pub replaced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportEnvelope {
    pub version: i64,
    pub exported_at: String,
    pub clients: Vec<crate::models::client::Client>,
    pub jobs: Vec<crate::models::job::Job>,
    pub candidates: Vec<crate::models::candidate::Candidate>,
    #[serde(default)]
    pub reminders: Option<Vec<crate::models::reminder::Reminder>>,
}
