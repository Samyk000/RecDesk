use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::commands::job::JOB_SELECT;
use crate::error::{AppError, AppResult};
use crate::models::{Candidate, JobWithStats, ReminderWithContext};
use crate::rows::{like_pattern, row_to_candidate, row_to_job_with_stats, row_to_reminder_with_context};
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatSource {
    pub id: String,
    pub entity_type: String, // "candidate" | "job" | "client" | "reminder" | "system"
    pub title: String,
    pub subtitle: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProposedAction {
    pub id: String,
    pub action_type: String, // "update_candidate_status" | "create_reminder" | "create_job" | "create_candidate"
    pub title: String,
    pub description: String,
    pub payload_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatContextPayload {
    pub query: String,
    pub intent_type: String, // "casual" | "ai_model_info" | "action_proposal" | "draft_email" | "interview_questions" | "list_jobs" | "list_candidates" | "list_reminders" | "entity_lookup" | "general_recruiting" | "workspace_summary"
    pub context_markdown: String,
    pub matched_entity_count: usize,
    pub sources: Vec<AiChatSource>,
    pub suggested_followups: Vec<String>,
    pub proposed_action: Option<AiProposedAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateDossier {
    pub candidate_id: String,
    pub name: String,
    pub markdown_dossier: String,
    pub source: AiChatSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceOverview {
    pub total_candidates: usize,
    pub active_jobs_count: usize,
    pub pending_reminders_count: usize,
    pub upcoming_interviews_count: usize,
    pub markdown_summary: String,
}

/// Strips HTML tags and unescapes common entities from rich text fields
fn clean_html_for_chat(raw: &str) -> String {
    let s = raw
        .replace("<p>", "")
        .replace("</p>", " ")
        .replace("<br>", " ")
        .replace("<br/>", " ")
        .replace("<br />", " ")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("<strong>", "**")
        .replace("</strong>", "**")
        .replace("<em>", "*")
        .replace("</em>", "*");

    let mut clean = String::new();
    let mut inside_tag = false;
    for c in s.chars() {
        if c == '<' {
            inside_tag = true;
        } else if c == '>' {
            inside_tag = false;
        } else if !inside_tag {
            clean.push(c);
        }
    }
    clean.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Formats pipeline stage with friendly emoji badge
fn format_stage_badge(stage: &str) -> &'static str {
    match stage.to_lowercase().as_str() {
        "interview" | "interviewing" => "📅 Interview",
        "submitted" => "🎯 Submitted",
        "in_touch" | "in touch" => "💬 In Touch",
        "placed" => "✨ Placed",
        "rejected" => "❌ Rejected",
        "not_interested" => "⛔ Not Interested",
        "sourced" => "🔍 Sourced",
        _ => "📌 Active",
    }
}

/// Analyzes user natural language queries, detects executable action intents, copilot drafting tasks,
/// job status filters, and strictly isolates pipeline stage lookups.
#[tauri::command]
pub fn get_ai_chat_context(state: State<'_, AppState>, query: String) -> AppResult<AiChatContextPayload> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let q_raw = query.trim();
    let q_lower = q_raw.to_lowercase();

    // ==========================================
    // INTENT 1: Generative Copilot Tasks (Draft Emails, Interview Prep, Summary)
    // ==========================================
    let is_draft_email = q_lower.contains("draft")
        || q_lower.contains("write an email")
        || q_lower.contains("write email")
        || q_lower.contains("prep email")
        || q_lower.contains("outreach email")
        || q_lower.contains("rejection email")
        || q_lower.contains("interview prep email")
        || q_lower.contains("compose email")
        || q_lower.contains("send email");

    let is_interview_questions = q_lower.contains("interview question")
        || q_lower.contains("interview questions")
        || q_lower.contains("prep questions")
        || q_lower.contains("screening questions");

    if is_draft_email || is_interview_questions {
        // Extract candidate name if present
        let stop_words = [
            "draft", "an", "a", "the", "email", "interview", "prep", "for", "write", "to", "candidate",
            "outreach", "rejection", "questions", "generate", "create", "please", "can", "you", "compose"
        ];
        let name_tokens: Vec<&str> = q_raw.split_whitespace()
            .filter(|w| {
                let cleaned = w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
                !stop_words.contains(&cleaned.as_str()) && cleaned.len() > 1
            })
            .collect();

        let search_name = name_tokens.join(" ");
        let mut matched_cand: Option<Candidate> = None;

        if !search_name.trim().is_empty() {
            let pat = like_pattern(search_name.trim());
            let mut stmt = conn.prepare(r#"
                SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                       c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                       c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                       c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
                       c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
                       c.placed_at, c.status_history, c.interview_feedback
                FROM candidates c
                WHERE c.name LIKE ?1 ESCAPE '\'
                ORDER BY c.last_updated DESC
                LIMIT 1
            "#)?;
            matched_cand = stmt.query_row(params![pat], row_to_candidate).ok();
        }

        if let Some(cand) = matched_cand {
            let cand_role = cand.current_title.as_deref().unwrap_or("Candidate");
            let cand_loc = cand.location.as_deref().unwrap_or("Not specified");
            let cand_email = cand.email.as_deref().unwrap_or("candidate@email.com");
            let cand_phone = cand.phone.as_deref().unwrap_or("N/A");
            let stage_b = format_stage_badge(&cand.submission_status);

            let mut notes_text = String::new();
            if let Some(ref n) = cand.recruiter_notes {
                let clean = clean_html_for_chat(n);
                if !clean.is_empty() && clean != "none" {
                    notes_text = clean;
                }
            }

            let generated_content = if is_draft_email {
                format!(
                    "### ✉️ Interview Prep Email for **{}**\n\n**To:** `{}`\n**Subject:** Next Steps & Interview Preparation — {}\n\n---\n\nHi {},\n\nThank you for speaking with our recruiting team. We are pleased to help you prepare for the next round of discussions regarding the **{}** opportunity.\n\n### 📋 Interview Details & Profile Summary:\n- 👤 **Candidate:** **{}**\n- 💼 **Position:** {}\n- 📍 **Location:** {}\n- 📞 **Contact:** `{}` • `{}`\n- 📌 **Current Stage:** {}\n{}\n\n### 💡 Key Preparation Tips:\n1. **Core Experience:** Be prepared to walk through your relevant background and key project deliverables.\n2. **Technical & Scenario Discussions:** Be ready to give structured examples (STAR method: Situation, Task, Action, Result) highlighting your problem-solving approaches.\n3. **Questions for the Interviewer:** Have 2-3 thoughtful questions prepared about team goals, culture, and project milestones.\n\nPlease feel free to reach out if you have any questions before the meeting. Best of luck!\n\nBest regards,\n**RecDesk Talent Team**",
                    cand.name,
                    cand_email,
                    cand_role,
                    cand.name.split_whitespace().next().unwrap_or(&cand.name),
                    cand_role,
                    cand.name,
                    cand_role,
                    cand_loc,
                    cand_email,
                    cand_phone,
                    stage_b,
                    if !notes_text.is_empty() { format!("- 📝 **Recruiter Notes:** *\"{}\"*", notes_text) } else { "".into() }
                )
            } else {
                format!(
                    "### 🎯 Interview Questions for **{}** ({})\n\n**Candidate Context:** {}\n\n#### 1. Role & Background Exploration\n- *Can you walk us through your most impactful project as a **{}**, and how you managed stakeholder requirements?*\n- *What technologies and methodologies do you consider your core strengths, and where have you applied them recently?*\n\n#### 2. Scenario & Problem Solving\n- *Describe a situation where project priorities suddenly changed. How did you adapt your timeline and deliverables?*\n- *Tell us about a challenging technical or operational roadblock you encountered and how you resolved it.*\n\n#### 3. Culture & Team Collaboration\n- *How do you approach cross-functional communication between engineering, product, and leadership teams?*",
                    cand.name, cand_role, stage_b, cand_role
                )
            };

            return Ok(AiChatContextPayload {
                query: query.clone(),
                intent_type: "draft_email".into(),
                context_markdown: generated_content,
                matched_entity_count: 1,
                sources: vec![AiChatSource {
                    id: cand.id.clone(),
                    entity_type: "candidate".into(),
                    title: cand.name.clone(),
                    subtitle: cand.current_title.clone(),
                    metadata: Some(format!("{stage_b} • {cand_loc}")),
                }],
                suggested_followups: vec![
                    format!("Create a reminder to follow up with {}", cand.name),
                    format!("Move {} to Interview stage", cand.name),
                    "Show all open job requisitions".into(),
                ],
                proposed_action: None,
            });
        }
    }

    // ==========================================
    // INTENT 2: Action Proposal — Candidate Status Update
    // ==========================================
    let is_status_action = (q_lower.starts_with("move ")
        || q_lower.starts_with("change ")
        || q_lower.starts_with("update ")
        || q_lower.starts_with("set ")
        || q_lower.starts_with("mark ")
        || q_lower.starts_with("reject ")
        || q_lower.starts_with("place "))
        && (q_lower.contains("interview")
            || q_lower.contains("submitted")
            || q_lower.contains("placed")
            || q_lower.contains("rejected")
            || q_lower.contains("in touch")
            || q_lower.contains("in_touch")
            || q_lower.contains("sourced")
            || q_lower.starts_with("reject ")
            || q_lower.starts_with("place "));

    if is_status_action {
        let target_stage = if q_lower.contains("interview") {
            "interview"
        } else if q_lower.contains("submitted") || q_lower.contains("submit") {
            "submitted"
        } else if q_lower.contains("placed") || q_lower.starts_with("place ") || q_lower.contains("hire") {
            "placed"
        } else if q_lower.contains("rejected") || q_lower.starts_with("reject ") {
            "rejected"
        } else if q_lower.contains("in touch") || q_lower.contains("in_touch") {
            "in_touch"
        } else if q_lower.contains("sourced") {
            "sourced"
        } else {
            "interview"
        };

        let action_stopwords = [
            "move", "change", "update", "set", "mark", "reject", "place", "status", "to", "stage",
            "of", "candidate", "as", "the", "please", "can", "you", "interview", "submitted", "placed",
            "rejected", "in_touch", "in touch", "sourced", "for", "'s"
        ];

        let name_tokens: Vec<&str> = q_raw.split_whitespace()
            .filter(|w| {
                let cleaned = w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
                !action_stopwords.contains(&cleaned.as_str()) && cleaned.len() > 1
            })
            .collect();

        let search_name = name_tokens.join(" ");
        if !search_name.trim().is_empty() {
            let pat = like_pattern(search_name.trim());
            let mut stmt = conn.prepare(r#"
                SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                       c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                       c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                       c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
                       c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
                       c.placed_at, c.status_history, c.interview_feedback
                FROM candidates c
                WHERE c.name LIKE ?1 ESCAPE '\'
                ORDER BY c.last_updated DESC
                LIMIT 1
            "#)?;

            let matched_cand = stmt.query_row(params![pat], row_to_candidate).ok();
            if let Some(cand) = matched_cand {
                let from_badge = format_stage_badge(&cand.submission_status);
                let to_badge = format_stage_badge(target_stage);

                let action_payload = json!({
                    "candidate_id": cand.id,
                    "candidate_name": cand.name,
                    "from_status": cand.submission_status,
                    "to_status": target_stage,
                });

                let proposed = AiProposedAction {
                    id: format!("act-status-{}", cand.id),
                    action_type: "update_candidate_status".into(),
                    title: format!("Move {} to {}", cand.name, to_badge),
                    description: format!("Update pipeline stage from {} to {}", from_badge, to_badge),
                    payload_json: action_payload.to_string(),
                };

                let context_md = format!(
                    "### Proposed Action: Update Pipeline Stage\n\nI found candidate **{}** currently in the **{}** stage. Confirm below to update their status in your database.\n\n- **Candidate:** **{}**\n- **Current Role:** {}\n- **Location:** {}\n- **Pipeline Transition:** {} ➔ {}",
                    cand.name,
                    from_badge,
                    cand.name,
                    cand.current_title.as_deref().unwrap_or("N/A"),
                    cand.location.as_deref().unwrap_or("N/A"),
                    from_badge,
                    to_badge
                );

                return Ok(AiChatContextPayload {
                    query: query.clone(),
                    intent_type: "action_proposal".into(),
                    context_markdown: context_md,
                    matched_entity_count: 1,
                    sources: vec![AiChatSource {
                        id: cand.id.clone(),
                        entity_type: "candidate".into(),
                        title: cand.name.clone(),
                        subtitle: cand.current_title.clone(),
                        metadata: Some(format!("Stage: {from_badge} ➔ {to_badge}")),
                    }],
                    suggested_followups: vec![
                        format!("Who else is in {} stage?", to_badge),
                        "Show all open job requisitions".into(),
                    ],
                    proposed_action: Some(proposed),
                });
            }
        }
    }

    // ==========================================
    // INTENT 3: Action Proposal — Reminder / Task Creation
    // Resilient to "create a reminder", "create reminder", "set a reminder", "remind me to...", etc.
    // ==========================================
    let is_reminder_action = q_lower.starts_with("create a reminder")
        || q_lower.starts_with("create reminder")
        || q_lower.starts_with("add a reminder")
        || q_lower.starts_with("add reminder")
        || q_lower.starts_with("set a reminder")
        || q_lower.starts_with("set reminder")
        || q_lower.starts_with("schedule a reminder")
        || q_lower.starts_with("schedule reminder")
        || q_lower.starts_with("remind me")
        || q_lower.starts_with("add a task")
        || q_lower.starts_with("add task")
        || q_lower.starts_with("create a task")
        || q_lower.starts_with("create task")
        || (q_lower.contains("reminder") && (q_lower.contains("tomorrow") || q_lower.contains("today") || q_lower.contains("at ")));

    if is_reminder_action {
        let now = chrono::Local::now();
        let (due_date, due_display) = if q_lower.contains("tomorrow") {
            let tom = now + chrono::Duration::days(1);
            (tom.format("%Y-%m-%d").to_string(), "Tomorrow")
        } else if q_lower.contains("next week") {
            let next_w = now + chrono::Duration::days(7);
            (next_w.format("%Y-%m-%d").to_string(), "Next week")
        } else {
            (now.format("%Y-%m-%d").to_string(), "Today")
        };

        let due_time = if q_lower.contains("10am") || q_lower.contains("10:00 am") || q_lower.contains("10 am") {
            "10:00".to_string()
        } else if q_lower.contains("9am") || q_lower.contains("9:00 am") || q_lower.contains("9 am") {
            "09:00".to_string()
        } else if q_lower.contains("11am") || q_lower.contains("11:00 am") || q_lower.contains("11 am") {
            "11:00".to_string()
        } else if q_lower.contains("2pm") || q_lower.contains("2:00 pm") || q_lower.contains("2 pm") {
            "14:00".to_string()
        } else if q_lower.contains("3pm") || q_lower.contains("3:00 pm") || q_lower.contains("3 pm") {
            "15:00".to_string()
        } else if q_lower.contains("4pm") || q_lower.contains("4:00 pm") || q_lower.contains("4 pm") {
            "16:00".to_string()
        } else {
            "09:00".to_string()
        };

        let mut clean_title = q_raw.to_string();
        for prefix in &[
            "create a reminder to ", "create a reminder for ", "create a reminder ",
            "create reminder to ", "create reminder for ", "create reminder ",
            "add a reminder to ", "add a reminder for ", "add a reminder ",
            "add reminder to ", "add reminder for ", "add reminder ",
            "set a reminder to ", "set a reminder for ", "set a reminder ",
            "set reminder to ", "set reminder for ", "set reminder ",
            "schedule a reminder to ", "schedule a reminder for ", "schedule a reminder ",
            "schedule reminder to ", "schedule reminder for ", "schedule reminder ",
            "remind me to ", "remind me for ", "remind me ",
            "create a task to ", "create a task for ", "create a task ",
            "create task to ", "create task for ", "create task ",
            "add a task to ", "add a task for ", "add a task ",
            "add task to ", "add task for ", "add task "
        ] {
            if clean_title.to_lowercase().starts_with(prefix) {
                clean_title = clean_title[prefix.len()..].trim().to_string();
                break;
            }
        }

        // Clean time/date markers from title
        clean_title = clean_title
            .replace(" tomorrow", "")
            .replace(" Tomorrow", "")
            .replace(" today", "")
            .replace(" Today", "")
            .replace(" at 10am", "")
            .replace(" at 10:00 am", "")
            .replace(" at 10 am", "")
            .replace(" at 9am", "")
            .replace(" at 9:00 am", "")
            .replace(" at 9 am", "")
            .replace(" at 11am", "")
            .replace(" at 2pm", "")
            .replace(" at 3pm", "")
            .replace(" at 4pm", "")
            .trim()
            .to_string();

        if clean_title.is_empty() {
            clean_title = "Follow up task".to_string();
        }

        // Check if a candidate name is mentioned inside the reminder title (e.g. "call Rob")
        let mut candidate_id: Option<String> = None;
        let mut candidate_name: Option<String> = None;
        let title_words: Vec<&str> = clean_title.split_whitespace().collect();
        for word in title_words {
            if word.len() >= 3 && !["call", "email", "meet", "with", "interview", "review", "follow", "up", "send"].contains(&word.to_lowercase().as_str()) {
                let pat = like_pattern(word);
                let cand_opt: Option<(String, String)> = conn.query_row(
                    "SELECT id, name FROM candidates WHERE name LIKE ?1 ESCAPE '\\' LIMIT 1",
                    params![pat],
                    |r| Ok((r.get(0)?, r.get(1)?))
                ).ok();
                if let Some((cid, cname)) = cand_opt {
                    candidate_id = Some(cid);
                    candidate_name = Some(cname);
                    break;
                }
            }
        }

        let action_payload = json!({
            "title": clean_title,
            "due_date": due_date,
            "due_time": due_time,
            "priority": "high",
            "category": "reminder",
            "candidate_id": candidate_id,
        });

        let proposed = AiProposedAction {
            id: format!("act-rem-{}", now.timestamp_millis()),
            action_type: "create_reminder".into(),
            title: format!("Create Reminder: {}", clean_title),
            description: format!("Due on {} ({}) at {}", due_date, due_display, due_time),
            payload_json: action_payload.to_string(),
        };

        let mut context_md = format!(
            "### Proposed Action: Create New Reminder\n\nI've drafted a new reminder for your calendar. Confirm below to save it.\n\n- 📝 **Title:** **{}**\n- 📅 **Due Date:** `{}` ({})\n- ⏰ **Time:** `{}`\n- ⚡ **Priority:** `High`",
            clean_title, due_date, due_display, due_time
        );
        if let Some(ref cname) = candidate_name {
            context_md.push_str(&format!("\n- 👤 **Linked Candidate:** **{}**", cname));
        }

        return Ok(AiChatContextPayload {
            query: query.clone(),
            intent_type: "action_proposal".into(),
            context_markdown: context_md,
            matched_entity_count: 1,
            sources: vec![AiChatSource {
                id: "new-reminder".into(),
                entity_type: "reminder".into(),
                title: clean_title,
                subtitle: Some(format!("Due: {due_date} {due_time}")),
                metadata: Some("Scheduled Task".into()),
            }],
            suggested_followups: vec![
                "What other reminders are scheduled?".into(),
                "Show all open job requisitions".into(),
            ],
            proposed_action: Some(proposed),
        });
    }

    // ==========================================
    // INTENT 4: AI Model Information
    // ==========================================
    let model_keywords = [
        "which ai model", "what model", "which model", "what ai", "current model",
        "model are you using", "model is being used", "model using", "active model"
    ];
    if model_keywords.iter().any(|k| q_lower.contains(k)) {
        return Ok(AiChatContextPayload {
            query: query.clone(),
            intent_type: "ai_model_info".into(),
            context_markdown: "User is inquiring about the active AI model. Explain that RecDesk supports both Local Models (Qwen 2.5 1.5B Instruct for balanced speed, Qwen 2.5 3B Instruct for precision) and OpenRouter Cloud (Llama 3.3 70B, Gemini 2.0 Flash, Mistral 24B, DeepSeek R1). The active model is chosen via the top-right model dropdown in this chat drawer or in Settings.".into(),
            matched_entity_count: 1,
            sources: vec![AiChatSource {
                id: "ai-system-info".into(),
                entity_type: "system".into(),
                title: "RecDesk AI Engine".into(),
                subtitle: Some("Local GGUF + OpenRouter".into()),
                metadata: Some("Offline & Cloud Hybrid".into()),
            }],
            suggested_followups: vec![
                "How do I switch to a local AI model?".into(),
                "Show all open jobs".into(),
                "Who are all candidates in interview stage?".into(),
            ],
            proposed_action: None,
        });
    }

    // ==========================================
    // INTENT 5: Casual Greeting
    // ==========================================
    let casual_greetings = [
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "howdy", "sup", "what's up", "who are you", "what can you do", "help me", "test"
    ];
    if casual_greetings.iter().any(|g| q_lower == *g || q_lower.starts_with(&format!("{g} "))) && q_raw.len() < 25 {
        return Ok(AiChatContextPayload {
            query: query.clone(),
            intent_type: "casual".into(),
            context_markdown: "User is initiating a greeting or asking for general assistance. Answer warmly, introduce yourself as RecDesk AI Assistant, and briefly offer help with finding candidates, reviewing jobs, checking interview notes, or general recruiting tasks.".into(),
            matched_entity_count: 0,
            sources: vec![],
            suggested_followups: vec![
                "Who are all candidates in interview stage?".into(),
                "Show all open job requisitions".into(),
                "List 5 candidates from TX".into(),
            ],
            proposed_action: None,
        });
    }

    let mut sources = Vec::new();
    let mut context_sections = Vec::new();
    let mut matched_candidates: Vec<Candidate> = Vec::new();

    // Extract quantity limit if specified (e.g. "List 5 candidates...", "Show 3 jobs...")
    let mut query_limit: usize = 15;
    let tokens: Vec<&str> = q_raw.split_whitespace().collect();
    for i in 0..tokens.len() {
        if let Ok(num) = tokens[i].parse::<usize>() {
            if num > 0 && num <= 50 {
                query_limit = num;
            }
        }
    }

    // Location / US State patterns
    let state_abbreviations = [
        ("tx", "Texas"), ("ca", "California"), ("ny", "New York"), ("fl", "Florida"),
        ("wa", "Washington"), ("il", "Illinois"), ("ma", "Massachusetts"), ("ga", "Georgia"),
        ("nc", "North Carolina"), ("co", "Colorado"), ("az", "Arizona"), ("va", "Virginia"),
        ("oh", "Ohio"), ("pa", "Pennsylvania"), ("mi", "Michigan"), ("tn", "Tennessee"),
        ("nj", "New Jersey"), ("or", "Oregon"), ("ut", "Utah"), ("mn", "Minnesota"),
    ];

    let mut location_filter: Option<String> = None;
    for (abbr, full_name) in &state_abbreviations {
        let has_abbr = q_lower.split(|c: char| !c.is_alphanumeric()).any(|w| w == *abbr);
        let has_full = q_lower.contains(&full_name.to_lowercase());
        if has_abbr || has_full {
            location_filter = Some(abbr.to_uppercase());
            break;
        }
    }

    if location_filter.is_none() {
        for city in &["austin", "dallas", "houston", "san francisco", "seattle", "chicago", "new york", "boston", "atlanta", "denver", "remote"] {
            if q_lower.contains(city) {
                location_filter = Some(city.to_string());
                break;
            }
        }
    }

    // ==========================================
    // INTENT 6: Pipeline Stage Query (Strict candidate stage filtering)
    // Only triggers if explicitly asking about candidates in a stage!
    // ==========================================
    let is_stage_candidate_query = (q_lower.contains("candidate") || q_lower.contains("who") || q_lower.contains("list") || q_lower.contains("show"))
        && (q_lower.contains("stage") || q_lower.contains("status") || q_lower.contains("interview") || q_lower.contains("submitted") || q_lower.contains("placed") || q_lower.contains("rejected") || q_lower.contains("in touch") || q_lower.contains("sourced"));

    let mut stage_filter: Option<&'static str> = None;
    if is_stage_candidate_query {
        if q_lower.contains("interview") || q_lower.contains("interviewing") {
            stage_filter = Some("interview");
        } else if q_lower.contains("submitted") || q_lower.contains("submission") {
            stage_filter = Some("submitted");
        } else if q_lower.contains("placed") || q_lower.contains("hired") {
            stage_filter = Some("placed");
        } else if q_lower.contains("in touch") || q_lower.contains("in_touch") || q_lower.contains("contacted") {
            stage_filter = Some("in_touch");
        } else if q_lower.contains("rejected") || q_lower.contains("declined") {
            stage_filter = Some("rejected");
        } else if q_lower.contains("sourced") {
            stage_filter = Some("sourced");
        }
    }

    // ==========================================
    // INTENT 7: Job Requisition Status Query (Hold, Active/Open, Closed, Lead, All)
    // ==========================================
    let is_job_query = (q_lower.contains("job") || q_lower.contains("requisition") || q_lower.contains("reqs"))
        && !is_stage_candidate_query;

    let job_status_filter: Option<&str> = if is_job_query {
        if q_lower.contains("hold") || q_lower.contains("on hold") {
            Some("hold")
        } else if q_lower.contains("closed") || q_lower.contains("close") {
            Some("closed")
        } else if q_lower.contains("lead") {
            Some("lead")
        } else if q_lower.contains("active") || q_lower.contains("open") {
            Some("active")
        } else if q_lower.contains("all") {
            None // No status filter -> all statuses
        } else {
            Some("active") // Default to active jobs
        }
    } else {
        None
    };

    let is_all_cands_query = (q_lower.contains("all candidate") || q_lower.contains("list candidate") || q_lower.contains("show candidate") || q_lower.contains("my candidate") || (location_filter.is_some() && q_lower.contains("candidate"))) && stage_filter.is_none() && !is_job_query;
    let is_reminder_lookup = (q_lower.contains("reminder") || q_lower.contains("calendar") || q_lower.contains("schedule") || q_lower.contains("task")) && !is_job_query && stage_filter.is_none();

    // A. Query Candidates by Strict Stage
    if let Some(stage) = stage_filter {
        let mut stage_stmt = conn.prepare(r#"
            SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                   c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                   c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                   c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
                   c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
                   c.placed_at, c.status_history, c.interview_feedback
            FROM candidates c
            WHERE c.submission_status = ?1
            ORDER BY c.last_updated DESC
            LIMIT ?2
        "#)?;

        let stage_cands = stage_stmt
            .query_map(params![stage, query_limit as i64], row_to_candidate)?
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>();

        for c in stage_cands {
            matched_candidates.push(c);
        }
    } else if let Some(ref loc) = location_filter {
        let loc_pat = format!("%{loc}%");
        let mut loc_stmt = conn.prepare(r#"
            SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                   c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                   c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                   c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
                   c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
                   c.placed_at, c.status_history, c.interview_feedback
            FROM candidates c
            WHERE c.location LIKE ?1 ESCAPE '\'
            ORDER BY c.last_updated DESC
            LIMIT ?2
        "#)?;

        let loc_cands = loc_stmt
            .query_map(params![loc_pat, query_limit as i64], row_to_candidate)?
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>();

        for c in loc_cands {
            matched_candidates.push(c);
        }
    } else if is_all_cands_query {
        let mut all_cands_stmt = conn.prepare(r#"
            SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                   c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                   c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                   c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
                   c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
                   c.placed_at, c.status_history, c.interview_feedback
            FROM candidates c
            ORDER BY c.last_updated DESC
            LIMIT ?1
        "#)?;

        let all_cands = all_cands_stmt
            .query_map(params![query_limit as i64], row_to_candidate)?
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>();

        for c in all_cands {
            matched_candidates.push(c);
        }
    } else if !is_job_query {
        // Direct candidate keyword / skill / name search
        let stop_words = [
            "list", "all", "show", "me", "find", "get", "give", "who", "what", "which", "are", "is",
            "the", "my", "from", "in", "with", "for", "tell", "about", "search", "please", "can", "you",
            "candidate", "candidates", "job", "jobs", "requisition", "requisitions", "stage"
        ];
        let search_terms: Vec<&str> = tokens.iter()
            .map(|t| t.trim())
            .filter(|t| !t.is_empty() && !stop_words.contains(&t.to_lowercase().as_str()) && t.len() > 1)
            .collect();

        let clean_search = search_terms.join(" ");
        if !clean_search.trim().is_empty() {
            let search_pattern = like_pattern(clean_search.trim());
            let mut cand_stmt = conn.prepare(r#"
                SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                       c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                       c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                       c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
                       c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
                       c.placed_at, c.status_history, c.interview_feedback
                FROM candidates c
                WHERE c.name LIKE ?1 ESCAPE '\'
                   OR COALESCE(c.email, '') LIKE ?1 ESCAPE '\'
                   OR COALESCE(c.current_title, '') LIKE ?1 ESCAPE '\'
                   OR COALESCE(c.current_company, '') LIKE ?1 ESCAPE '\'
                   OR COALESCE(c.location, '') LIKE ?1 ESCAPE '\'
                   OR COALESCE(c.recruiter_notes, '') LIKE ?1 ESCAPE '\'
                ORDER BY c.last_updated DESC
                LIMIT 10
            "#)?;

            let direct_candidates = cand_stmt
                .query_map(params![search_pattern], row_to_candidate)?
                .filter_map(|r| r.ok())
                .collect::<Vec<_>>();

            for c in direct_candidates {
                if !matched_candidates.iter().any(|existing| existing.id == c.id) {
                    matched_candidates.push(c);
                }
            }

            for term in &search_terms {
                if term.len() >= 3 && matched_candidates.len() < 5 {
                    let term_pattern = like_pattern(term);
                    let mut term_stmt = conn.prepare(r#"
                        SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                               c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                               c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                               c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
                               c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
                               c.placed_at, c.status_history, c.interview_feedback
                        FROM candidates c
                        WHERE c.name LIKE ?1 ESCAPE '\'
                           OR COALESCE(c.current_title, '') LIKE ?1 ESCAPE '\'
                        ORDER BY c.last_updated DESC
                        LIMIT 5
                    "#)?;
                    let token_matches = term_stmt
                        .query_map(params![term_pattern], row_to_candidate)?
                        .filter_map(|r| r.ok())
                        .collect::<Vec<_>>();

                    for c in token_matches {
                        if !matched_candidates.iter().any(|existing| existing.id == c.id) {
                            matched_candidates.push(c);
                        }
                    }
                }
            }
        }
    }

    // Format Candidate Results
    if !matched_candidates.is_empty() {
        let title_header = if let Some(stage) = stage_filter {
            let badge = format_stage_badge(stage);
            format!("### Candidates in {badge} Stage ({} found):\n\n", matched_candidates.len())
        } else if let Some(ref loc) = location_filter {
            format!("### Candidates Located in **{loc}** ({} found):\n\n", matched_candidates.len())
        } else {
            format!("### Candidate Records ({} found):\n\n", matched_candidates.len())
        };

        let mut cand_md = title_header;
        for (idx, c) in matched_candidates.iter().enumerate() {
            let badge = format_stage_badge(&c.submission_status);
            sources.push(AiChatSource {
                id: c.id.clone(),
                entity_type: "candidate".into(),
                title: c.name.clone(),
                subtitle: c.current_title.clone(),
                metadata: Some(format!("{badge} | {}", c.location.as_deref().unwrap_or("N/A"))),
            });

            let role_display = match (&c.current_title, &c.current_company) {
                (Some(title), Some(comp)) if !title.trim().is_empty() && !comp.trim().is_empty() && comp != "Not specified" => {
                    format!("{title} at {comp}")
                }
                (Some(title), _) if !title.trim().is_empty() && title != "Not specified" => title.clone(),
                _ => "Candidate Profile".to_string(),
            };

            cand_md.push_str(&format!(
                "{}. **{}** — `{}`\n",
                idx + 1,
                c.name,
                role_display
            ));

            let mut details = Vec::new();
            if let Some(ref loc) = c.location {
                if !loc.trim().is_empty() && loc != "Not specified" {
                    details.push(format!("📍 Location: **{}**", loc.trim()));
                }
            }
            if let Some(exp) = c.experience_years {
                if exp > 0 {
                    details.push(format!("⏱️ Exp: **{} yrs**", exp));
                }
            }
            details.push(format!("📌 Stage: **{}**", badge));

            if !details.is_empty() {
                cand_md.push_str(&format!("   - {}\n", details.join(" • ")));
            }

            let mut contact = Vec::new();
            if let Some(ref em) = c.email {
                if !em.trim().is_empty() && em != "Not specified" {
                    contact.push(format!("✉️ `{em}`"));
                }
            }
            if let Some(ref ph) = c.phone {
                if !ph.trim().is_empty() && ph != "Not specified" {
                    contact.push(format!("📞 `{ph}`"));
                }
            }
            if !contact.is_empty() {
                cand_md.push_str(&format!("   - {}\n", contact.join(" • ")));
            }

            if let Some(ref notes) = c.recruiter_notes {
                let clean_n = clean_html_for_chat(notes);
                if !clean_n.is_empty() && clean_n != "none" {
                    cand_md.push_str(&format!("   - 📝 *Notes:* \"{}\"\n", clean_n));
                }
            }

            if let Some(ref fb) = c.client_feedback {
                let clean_f = clean_html_for_chat(fb);
                if !clean_f.is_empty() && clean_f != "internal" && clean_f != "none" {
                    cand_md.push_str(&format!("   - 💬 *Client Feedback:* \"{}\"\n", clean_f));
                }
            }

            cand_md.push('\n');
        }
        context_sections.push(cand_md);
    } else if let Some(stage) = stage_filter {
        let total_cands: i64 = conn.query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0)).unwrap_or(0);
        let badge = format_stage_badge(stage);
        context_sections.push(format!(
            "### Candidates in {badge} Stage:\nNo candidates are currently in the **{stage}** stage.\n\n*(Your workspace has {total_cands} total candidates in other pipeline stages.)*"
        ));
    }

    // B. Query Jobs with Accurate Status Filtering (Hold, Active, Closed, Lead, All)
    if is_job_query {
        let (sql_jobs, job_params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match job_status_filter {
            Some(status_val) => (
                format!("{JOB_SELECT} WHERE j.status = ?1 ORDER BY j.updated_at DESC LIMIT ?2"),
                vec![Box::new(status_val.to_string()), Box::new(query_limit as i64)],
            ),
            None => (
                format!("{JOB_SELECT} ORDER BY j.updated_at DESC LIMIT ?1"),
                vec![Box::new(query_limit as i64)],
            ),
        };

        let mut job_stmt = conn.prepare(&sql_jobs)?;
        let matched_jobs: Vec<JobWithStats> = job_stmt
            .query_map(rusqlite::params_from_iter(job_params.iter().map(|b| b.as_ref())), row_to_job_with_stats)?
            .filter_map(|r| r.ok())
            .collect();

        let status_label = match job_status_filter {
            Some("hold") => "On-Hold",
            Some("closed") => "Closed",
            Some("lead") => "Lead",
            Some("active") => "Active Open",
            _ => "All",
        };

        if !matched_jobs.is_empty() {
            let mut jobs_md = format!("### {status_label} Job Requisitions ({} found):\n\n", matched_jobs.len());
            for (idx, j) in matched_jobs.iter().enumerate() {
                sources.push(AiChatSource {
                    id: j.job.id.clone(),
                    entity_type: "job".into(),
                    title: j.job.title.clone(),
                    subtitle: Some(format!("Client: {} | ID: {}", j.client_name, j.job.job_id)),
                    metadata: Some(format!("Status: {} | Candidates: {}", j.job.status, j.candidate_count)),
                });

                jobs_md.push_str(&format!(
                    "{}. **{}** — Req ID: `{}`\n",
                    idx + 1,
                    j.job.title,
                    j.job.job_id
                ));

                let mut job_details = Vec::new();
                job_details.push(format!("🏢 Client: **{}**", j.client_name));
                job_details.push(format!("📌 Status: **`{}`**", j.job.status));
                if let Some(ref loc) = j.job.location {
                    if !loc.trim().is_empty() {
                        job_details.push(format!("📍 Location: **{}**", loc.trim()));
                    }
                }
                job_details.push(format!("👥 Pipeline: **{} candidates**", j.candidate_count));

                jobs_md.push_str(&format!("   - {}\n", job_details.join(" • ")));

                let mut rate_info = Vec::new();
                if let Some(ref br) = j.job.bill_rate {
                    if !br.trim().is_empty() && br != "N/A" {
                        rate_info.push(format!("Bill Rate: `{br}`"));
                    }
                }
                if let Some(ref pr) = j.job.pay_rate {
                    if !pr.trim().is_empty() && pr != "N/A" {
                        rate_info.push(format!("Pay Rate: `{pr}`"));
                    }
                }
                if let Some(ref ct) = j.job.contract_type {
                    if !ct.trim().is_empty() {
                        rate_info.push(format!("Contract: `{ct}`"));
                    }
                }
                if !rate_info.is_empty() {
                    jobs_md.push_str(&format!("   - 💵 {}\n", rate_info.join(" • ")));
                }

                jobs_md.push('\n');
            }
            context_sections.push(jobs_md);
        } else {
            let total_jobs: i64 = conn.query_row("SELECT COUNT(*) FROM jobs", [], |r| r.get(0)).unwrap_or(0);
            context_sections.push(format!(
                "### {status_label} Job Requisitions:\nNo job requisitions are currently marked as **{}**.\n\n*(Your workspace has {} total job requisitions on file.)*",
                status_label, total_jobs
            ));
        }
    }

    // C. Query Reminders & Scheduled Interviews
    if is_reminder_lookup {
        let mut rem_stmt = conn.prepare(r#"
            SELECT r.id, r.title, r.description, r.category, r.due_date, r.due_time,
                   r.timezone, r.remind_at, r.priority, r.notify_before_minutes,
                   r.status, r.snoozed_until, r.candidate_id, r.job_id, r.client_id,
                   r.meeting_link, r.created_at, r.updated_at,
                   c.name as candidate_name,
                   j.title as job_title,
                   cl.name as client_name
            FROM reminders r
            LEFT JOIN candidates c ON r.candidate_id = c.id
            LEFT JOIN jobs j ON r.job_id = j.id
            LEFT JOIN clients cl ON r.client_id = cl.id
            WHERE r.status = 'pending'
            ORDER BY r.remind_at ASC
            LIMIT 8
        "#)?;

        let matched_reminders: Vec<ReminderWithContext> = rem_stmt
            .query_map([], row_to_reminder_with_context)?
            .filter_map(|r| r.ok())
            .collect();

        if !matched_reminders.is_empty() {
            let mut rem_md = format!("### Scheduled Interviews & Pending Reminders ({} found):\n\n", matched_reminders.len());
            for (idx, r) in matched_reminders.iter().enumerate() {
                sources.push(AiChatSource {
                    id: r.reminder.id.clone(),
                    entity_type: "reminder".into(),
                    title: r.reminder.title.clone(),
                    subtitle: r.candidate_name.clone().or_else(|| r.job_title.clone()),
                    metadata: Some(format!("Due: {} {} ({})", r.reminder.due_date, r.reminder.due_time.as_deref().unwrap_or(""), r.reminder.category)),
                });

                rem_md.push_str(&format!(
                    "{}. **{}** (`{}`)\n",
                    idx + 1,
                    r.reminder.title,
                    r.reminder.category
                ));

                let mut r_details = Vec::new();
                r_details.push(format!("⏰ Due: **{} {}**", r.reminder.due_date, r.reminder.due_time.as_deref().unwrap_or("All day")));
                r_details.push(format!("⚡ Priority: **{}**", r.reminder.priority));
                rem_md.push_str(&format!("   - {}\n", r_details.join(" • ")));

                if let Some(ref cand) = r.candidate_name {
                    rem_md.push_str(&format!("   - 👤 Candidate: **{cand}**\n"));
                }
                if let Some(ref j_title) = r.job_title {
                    rem_md.push_str(&format!("   - 💼 Job: **{j_title}**\n"));
                }
                rem_md.push('\n');
            }
            context_sections.push(rem_md);
        }
    }

    // D. Fallback Snapshot if nothing matched
    let matched_entity_count = sources.len();
    if matched_entity_count == 0 && context_sections.is_empty() {
        let total_cands: i64 = conn.query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0)).unwrap_or(0);
        let active_jobs: i64 = conn.query_row("SELECT COUNT(*) FROM jobs WHERE status = 'active'", [], |r| r.get(0)).unwrap_or(0);
        let total_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0)).unwrap_or(0);
        let pending_tasks: i64 = conn.query_row("SELECT COUNT(*) FROM reminders WHERE status = 'pending'", [], |r| r.get(0)).unwrap_or(0);

        context_sections.push(format!(
            "### RecDesk Workspace Summary Snapshot:\n- **Total Candidates on file:** {}\n- **Active Open Jobs:** {}\n- **Total Clients:** {}\n- **Pending Reminders & Tasks:** {}\n\n*(No direct records matched query \"{}\".)*",
            total_cands, active_jobs, total_clients, pending_tasks, q_raw
        ));
    }

    // Suggested Followups
    let mut suggested_followups = Vec::new();
    if is_job_query {
        suggested_followups.push("Who are all candidates in interview stage?".into());
        suggested_followups.push("List all open job requisitions".into());
        suggested_followups.push("List all hold job requisitions".into());
    } else if stage_filter.is_some() {
        suggested_followups.push("Who are all submitted candidates?".into());
        suggested_followups.push("List all open job requisitions".into());
        suggested_followups.push("What reminders are scheduled for this week?".into());
    } else if let Some(first_cand) = matched_candidates.first() {
        suggested_followups.push(format!("Draft an interview prep email for {}", first_cand.name));
        suggested_followups.push(format!("Move {} to Interview stage", first_cand.name));
        suggested_followups.push(format!("Create a reminder to follow up with {}", first_cand.name));
    } else {
        suggested_followups.push("Who are all candidates in interview stage?".into());
        suggested_followups.push("List all open job requisitions".into());
        suggested_followups.push("List 5 candidates from TX".into());
    }

    let intent_type = if stage_filter.is_some() || is_all_cands_query || location_filter.is_some() {
        "list_candidates".into()
    } else if is_job_query {
        "list_jobs".into()
    } else if is_reminder_lookup {
        "list_reminders".into()
    } else if matched_entity_count > 0 {
        "entity_lookup".into()
    } else {
        "general_recruiting".into()
    };

    Ok(AiChatContextPayload {
        query: query.clone(),
        intent_type,
        context_markdown: context_sections.join("\n\n"),
        matched_entity_count,
        sources,
        suggested_followups,
        proposed_action: None,
    })
}

/// Retrieves a complete, rich Markdown dossier for a specific candidate.
#[tauri::command]
pub fn get_candidate_ai_dossier(state: State<'_, AppState>, candidate_id: String) -> AppResult<CandidateDossier> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;

    let mut stmt = conn.prepare(r#"
        SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
               c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
               c.match_score, c.submission_status, c.interview_status, c.client_feedback,
               c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
               c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
               c.placed_at, c.status_history, c.interview_feedback,
               j.title as job_title, j.job_id as req_id, cl.name as client_name
        FROM candidates c
        JOIN jobs j ON j.id = c.job_id
        JOIN clients cl ON cl.id = j.client_id
        WHERE c.id = ?1
    "#)?;

    let dossier = stmt.query_row(params![candidate_id], |row| {
        let id: String = row.get(0)?;
        let name: String = row.get(2)?;
        let email: Option<String> = row.get(3)?;
        let phone: Option<String> = row.get(4)?;
        let location: Option<String> = row.get(5)?;
        let current_title: Option<String> = row.get(6)?;
        let current_company: Option<String> = row.get(7)?;
        let experience_years: Option<i64> = row.get(8)?;
        let recruiter_notes: Option<String> = row.get(10)?;
        let submission_status: String = row.get(12)?;
        let client_feedback: Option<String> = row.get(14)?;
        let linkedin_url: Option<String> = row.get(21)?;
        let screening_answers: Option<String> = row.get(22)?;
        let interview_feedback: Option<String> = row.get(26)?;
        let job_title: String = row.get(27)?;
        let req_id: String = row.get(28)?;
        let client_name: String = row.get(29)?;

        let badge = format_stage_badge(&submission_status);

        let mut md = format!(
            "### Candidate Profile: **{}**\n\n",
            name
        );
        md.push_str(&format!("- 💼 **Job Application:** {} (Req ID: `{}` | Client: **{}**)\n", job_title, req_id, client_name));
        md.push_str(&format!("- 🏢 **Current Role:** {}\n", current_title.as_deref().unwrap_or("N/A")));
        if let Some(ref comp) = current_company {
            if comp != "Not specified" && !comp.trim().is_empty() {
                md.push_str(&format!("- 🏢 **Company:** {}\n", comp));
            }
        }
        if let Some(ref loc) = location {
            if loc != "Not specified" && !loc.trim().is_empty() {
                md.push_str(&format!("- 📍 **Location:** {}\n", loc));
            }
        }
        md.push_str(&format!("- ✉️ **Contact:** Email: `{}` • Phone: `{}`\n", email.as_deref().unwrap_or("N/A"), phone.as_deref().unwrap_or("N/A")));
        if let Some(ref li) = linkedin_url {
            md.push_str(&format!("- 🔗 **LinkedIn:** {}\n", li));
        }
        if let Some(exp) = experience_years {
            if exp > 0 {
                md.push_str(&format!("- ⏱️ **Experience:** {} years\n", exp));
            }
        }
        md.push_str(&format!("- 📌 **Pipeline Stage:** {}\n\n", badge));

        if let Some(ref notes) = recruiter_notes {
            let clean_n = clean_html_for_chat(notes);
            if !clean_n.is_empty() {
                md.push_str(&format!("#### Recruiter Notes:\n> {}\n\n", clean_n));
            }
        }

        if let Some(ref fb) = client_feedback {
            let clean_f = clean_html_for_chat(fb);
            if !clean_f.is_empty() && clean_f != "internal" {
                md.push_str(&format!("#### Client Feedback:\n> {}\n\n", clean_f));
            }
        }

        if let Some(ref sa) = screening_answers {
            if !sa.trim().is_empty() && sa != "{}" {
                md.push_str(&format!("#### Screening Q&A Details:\n```json\n{}\n```\n\n", sa));
            }
        }

        if let Some(ref ifb) = interview_feedback {
            if !ifb.trim().is_empty() && ifb != "{}" {
                md.push_str(&format!("#### Interview Feedback:\n```json\n{}\n```\n\n", ifb));
            }
        }

        Ok(CandidateDossier {
            candidate_id: id.clone(),
            name: name.clone(),
            markdown_dossier: md,
            source: AiChatSource {
                id,
                entity_type: "candidate".into(),
                title: name,
                subtitle: current_title,
                metadata: Some(format!("Job: {} | Stage: {}", job_title, submission_status)),
            },
        })
    }).map_err(|e| AppError::Msg(format!("Failed to retrieve candidate dossier: {e}")))?;

    Ok(dossier)
}

/// Returns a high-level statistical snapshot of the recruiter's active workspace.
#[tauri::command]
pub fn get_workspace_ai_overview(state: State<'_, AppState>) -> AppResult<WorkspaceOverview> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;

    let total_candidates: i64 = conn.query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0)).unwrap_or(0);
    let active_jobs_count: i64 = conn.query_row("SELECT COUNT(*) FROM jobs WHERE status = 'active'", [], |r| r.get(0)).unwrap_or(0);
    let pending_reminders_count: i64 = conn.query_row("SELECT COUNT(*) FROM reminders WHERE status = 'pending'", [], |r| r.get(0)).unwrap_or(0);
    let upcoming_interviews_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM candidates WHERE submission_status = 'interview'",
        [],
        |r| r.get(0)
    ).unwrap_or(0);

    let markdown_summary = format!(
        "### RecDesk Workspace Overview:\n- **Total Candidates:** {}\n- **Active Job Openings:** {}\n- **Upcoming / Active Interviews:** {}\n- **Pending Reminders & Tasks:** {}\n",
        total_candidates, active_jobs_count, upcoming_interviews_count, pending_reminders_count
    );

    Ok(WorkspaceOverview {
        total_candidates: total_candidates as usize,
        active_jobs_count: active_jobs_count as usize,
        pending_reminders_count: pending_reminders_count as usize,
        upcoming_interviews_count: upcoming_interviews_count as usize,
        markdown_summary,
    })
}
