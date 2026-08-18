use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BooleanString {
    pub name: String,
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub client_id: String,
    pub job_id: String,
    pub title: String,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub work_model: Option<String>,
    #[serde(default)]
    pub contract_type: Option<String>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub refined_jd: Option<String>,
    #[serde(default)]
    pub boolean_strings: Vec<BooleanString>,
    #[serde(default)]
    pub candidate_pitch: Option<String>,
    #[serde(default)]
    pub screening_questions: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub closed_at: Option<String>,
    #[serde(default)]
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobInput {
    pub client_id: String,
    pub job_id: String,
    pub title: String,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub work_model: Option<String>,
    #[serde(default)]
    pub contract_type: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub refined_jd: Option<String>,
    #[serde(default)]
    pub boolean_strings: Vec<BooleanString>,
    #[serde(default)]
    pub candidate_pitch: Option<String>,
    #[serde(default)]
    pub screening_questions: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub closed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobWithStats {
    #[serde(flatten)]
    pub job: Job,
    pub candidate_count: i64,
    pub client_name: String,
}
