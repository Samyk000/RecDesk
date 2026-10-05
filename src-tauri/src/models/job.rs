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
    pub bill_rate: Option<String>,
    #[serde(default)]
    pub pay_rate: Option<String>,
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

/// Partial update payload: a field that is absent is left untouched, `null`
/// clears it, any other value overwrites it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobInput {
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub location: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub work_model: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub contract_type: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub bill_rate: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub pay_rate: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub status: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub refined_jd: Option<Option<String>>,
    #[serde(default)]
    pub boolean_strings: Option<Vec<BooleanString>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub candidate_pitch: Option<Option<String>>,
    #[serde(default)]
    pub screening_questions: Option<Vec<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub notes: Option<Option<String>>,
    #[serde(default, deserialize_with = "super::double_option")]
    pub closed_at: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobWithStats {
    #[serde(flatten)]
    pub job: Job,
    pub candidate_count: i64,
    pub client_name: String,
}
