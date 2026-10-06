use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub id: String,
    #[serde(default)]
    pub job_id: Option<String>,
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
    #[serde(default)]
    pub status_history: Option<String>,
    #[serde(default)]
    pub interview_feedback: Option<String>,
    pub date_added: String,
    pub last_updated: String,
}

/// Sparse update payload: every field is tri-state —
///   key absent -> leave the stored column alone,
///   `null`     -> clear it,
///   value      -> set it.
/// Two partial saves therefore coexist instead of clobbering each other
/// (the old full-row semantics made every save a last-write-wins race).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CandidateInput {
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub email: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub phone: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub location: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub current_title: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub current_company: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub experience_years: Option<Option<i64>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub resume_path: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub linkedin_url: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub recruiter_notes: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub match_score: Option<Option<i64>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub submission_status: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub interview_status: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub client_feedback: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub candidate_status: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub submitted_at: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub interview_at: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub placed_at: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub rejection_reason: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub screening_answers: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub submission_details: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub status_history: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub interview_feedback: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateWithJob {
    #[serde(flatten)]
    pub candidate: Candidate,
    pub job_title: String,
    pub job_id_ref: String,
    pub client_name: String,
}
