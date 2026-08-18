use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub hiring_manager: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInput {
    pub name: String,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub hiring_manager: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientWithStats {
    #[serde(flatten)]
    pub client: Client,
    pub jobs_count: i64,
    pub candidates_count: i64,
}
