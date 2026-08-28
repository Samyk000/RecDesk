use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_category")]
    pub category: String,
    pub due_date: String,
    #[serde(default)]
    pub due_time: Option<String>,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    pub remind_at: String,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(default)]
    pub notify_before_minutes: i64,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub snoozed_until: Option<String>,
    #[serde(default)]
    pub candidate_id: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub meeting_link: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn default_category() -> String {
    "reminder".to_string()
}

fn default_timezone() -> String {
    "UTC".to_string()
}

fn default_priority() -> String {
    "medium".to_string()
}

fn default_status() -> String {
    "pending".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    pub due_date: String,
    #[serde(default)]
    pub due_time: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub remind_at: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub notify_before_minutes: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub snoozed_until: Option<String>,
    #[serde(default)]
    pub candidate_id: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub meeting_link: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderWithContext {
    #[serde(flatten)]
    pub reminder: Reminder,
    #[serde(default)]
    pub candidate_name: Option<String>,
    #[serde(default)]
    pub job_title: Option<String>,
    #[serde(default)]
    pub client_name: Option<String>,
}
