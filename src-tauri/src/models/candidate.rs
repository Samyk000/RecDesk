use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub id: String,
    pub job_id: String,
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub current_title: Option<String>,
    #[serde(default)]
    pub current_company: Option<String>,
    #[serde(default)]
    pub experience_years: Option<i64>,
    #[serde(default)]
    pub resume_path: Option<String>,
    #[serde(default)]
    pub linkedin_url: Option<String>,
    #[serde(default)]
    pub recruiter_notes: Option<String>,
    #[serde(default)]
    pub match_score: Option<i64>,
    #[serde(default)]
    pub submission_status: String,
    #[serde(default)]
    pub interview_status: Option<String>,
    #[serde(default)]
    pub client_feedback: Option<String>,
    #[serde(default)]
    pub candidate_status: String,
    #[serde(default)]
    pub submitted_at: Option<String>,
    #[serde(default)]
    pub interview_at: Option<String>,
    #[serde(default)]
    pub placed_at: Option<String>,
    #[serde(default)]
    pub rejection_reason: Option<String>,
    #[serde(default)]
    pub screening_answers: Option<String>,
    #[serde(default)]
    pub submission_details: Option<String>,
    pub date_added: String,
    pub last_updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateInput {
    pub job_id: String,
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub current_title: Option<String>,
    #[serde(default)]
    pub current_company: Option<String>,
    #[serde(default)]
    pub experience_years: Option<i64>,
    #[serde(default)]
    pub resume_path: Option<String>,
    #[serde(default)]
    pub linkedin_url: Option<String>,
    #[serde(default)]
    pub recruiter_notes: Option<String>,
    #[serde(default)]
    pub match_score: Option<i64>,
    #[serde(default)]
    pub submission_status: Option<String>,
    #[serde(default)]
    pub interview_status: Option<String>,
    #[serde(default)]
    pub client_feedback: Option<String>,
    #[serde(default)]
    pub candidate_status: Option<String>,
    #[serde(default)]
    pub submitted_at: Option<String>,
    #[serde(default)]
    pub interview_at: Option<String>,
    #[serde(default)]
    pub placed_at: Option<String>,
    #[serde(default)]
    pub rejection_reason: Option<String>,
    #[serde(default)]
    pub screening_answers: Option<String>,
    #[serde(default)]
    pub submission_details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateWithJob {
    #[serde(flatten)]
    pub candidate: Candidate,
    pub job_title: String,
    pub job_id_ref: String,
    pub client_name: String,
}
