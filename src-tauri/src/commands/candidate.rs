use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{Candidate, CandidateInput, CandidateWithJob};
use crate::rows::{like_pattern, new_id, now, row_to_candidate, row_to_candidate_with_job};
use crate::AppState;

pub const CANDIDATE_SELECT: &str = r#"
  SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
         c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
         c.match_score, c.submission_status, c.interview_status, c.client_feedback,
         c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
         c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
         c.placed_at, c.status_history, c.interview_feedback
  FROM candidates c
"#;

pub const CANDIDATE_SELECT_JOIN: &str = r#"
  SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
         c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
         c.match_score, c.submission_status, c.interview_status, c.client_feedback,
         c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
         c.date_added, c.last_updated, c.linkedin_url, c.screening_answers, c.submission_details,
         c.placed_at, c.status_history, c.interview_feedback,
         j.title, j.job_id, cl.name
  FROM candidates c
  JOIN jobs j ON j.id = c.job_id
  JOIN clients cl ON cl.id = j.client_id
"#;

#[tauri::command]
pub fn get_candidates(
    state: State<'_, AppState>,
    job_id: Option<String>,
    status: Option<String>,
    search: Option<String>,
) -> AppResult<Vec<Candidate>> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(jid) = &job_id {
        conditions.push("c.job_id = ?".to_string());
        params.push(Box::new(jid.clone()));
    }
    if let Some(st) = &status {
        conditions.push("c.submission_status = ?".to_string());
        params.push(Box::new(st.clone()));
    }
    if let Some(s) = &search {
        conditions.push(
            "(c.name LIKE ? ESCAPE '\\' OR COALESCE(c.email,'') LIKE ? ESCAPE '\\' OR COALESCE(c.current_company,'') LIKE ? ESCAPE '\\' OR COALESCE(c.current_title,'') LIKE ? ESCAPE '\\' OR COALESCE(c.location,'') LIKE ? ESCAPE '\\')"
                .to_string(),
        );
        let p = like_pattern(s.trim());
        for _ in 0..5 {
            params.push(Box::new(p.clone()));
        }
    }

    let mut sql = CANDIDATE_SELECT.to_string();
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(" ORDER BY c.last_updated DESC");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter().map(|b| b.as_ref())), |row| {
            row_to_candidate(row)
        })?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

#[tauri::command]
pub fn get_candidate(state: State<'_, AppState>, id: String) -> AppResult<Candidate> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let cand = conn.query_row(
        &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
        params![&id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[tauri::command]
pub fn create_candidate(
    state: State<'_, AppState>,
    input: CandidateInput,
) -> AppResult<Candidate> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Candidate name cannot be empty".into());
    }
    let job_id = input.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err("Job assignment is required".into());
    }

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO candidates (id, job_id, name, email, phone, location, current_title,
                                 current_company, experience_years, resume_path, linkedin_url,
                                 recruiter_notes, match_score, submission_status, interview_status,
                                 client_feedback, candidate_status, submitted_at, interview_at,
                                 rejection_reason, screening_answers, submission_details, placed_at,
                                 status_history, interview_feedback, date_added, last_updated)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?26)",
        params![
            id,
            job_id,
            name,
            input.email,
            input.phone,
            input.location,
            input.current_title,
            input.current_company,
            input.experience_years,
            input.resume_path,
            input.linkedin_url,
            input.recruiter_notes,
            input.match_score,
            input.submission_status.unwrap_or_else(|| "sourced".to_string()),
            input.interview_status,
            input.client_feedback,
            input.candidate_status.unwrap_or_else(|| "active".to_string()),
            input.submitted_at,
            input.interview_at,
            input.rejection_reason,
            input.screening_answers.unwrap_or_else(|| "{}".to_string()),
            input.submission_details.unwrap_or_else(|| "{}".to_string()),
            input.placed_at,
            input.status_history.unwrap_or_else(|| "[]".to_string()),
            input.interview_feedback.unwrap_or_else(|| "{}".to_string()),
            ts
        ],
    )?;
    let cand = conn.query_row(
        &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
        params![&id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[tauri::command]
pub fn update_candidate(
    state: State<'_, AppState>,
    id: String,
    input: CandidateInput,
) -> AppResult<Candidate> {
    let name_trimmed = input.name.trim().to_string();
    if name_trimmed.is_empty() {
        return Err("Candidate name cannot be empty".into());
    }
    let job_id_trimmed = input.job_id.trim().to_string();
    if job_id_trimmed.is_empty() {
        return Err("Job assignment is required".into());
    }

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let affected = conn.execute(
        "UPDATE candidates SET job_id = ?1,
                               name = ?2,
                               email = ?3,
                               phone = ?4,
                               location = ?5,
                               current_title = ?6,
                               current_company = ?7,
                               experience_years = ?8,
                               resume_path = ?9,
                               recruiter_notes = ?10,
                               match_score = ?11,
                               submission_status = COALESCE(?12, submission_status),
                               interview_status = ?13,
                               client_feedback = ?14,
                               candidate_status = COALESCE(?15, candidate_status),
                               submitted_at = ?16,
                               interview_at = ?17,
                               rejection_reason = ?18,
                               linkedin_url = ?19,
                               placed_at = ?20,
                               screening_answers = COALESCE(?21, screening_answers),
                               submission_details = COALESCE(?22, submission_details),
                               status_history = COALESCE(?23, status_history),
                               interview_feedback = COALESCE(?24, interview_feedback),
                               last_updated = ?25
         WHERE id = ?26",
        params![
            job_id_trimmed,
            name_trimmed,
            input.email,
            input.phone,
            input.location,
            input.current_title,
            input.current_company,
            input.experience_years,
            input.resume_path,
            input.recruiter_notes,
            input.match_score,
            input.submission_status,
            input.interview_status,
            input.client_feedback,
            input.candidate_status,
            input.submitted_at,
            input.interview_at,
            input.rejection_reason,
            input.linkedin_url,
            input.placed_at,
            input.screening_answers,
            input.submission_details,
            input.status_history,
            input.interview_feedback,
            now(),
            id
        ],
    )?;
    if affected == 0 {
        return Err("Candidate not found".into());
    }
    let cand = conn.query_row(
        &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
        params![&id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CandidatePatch {
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
    pub status_history: Option<String>,
    #[serde(default)]
    pub interview_feedback: Option<String>,
}

#[tauri::command]
pub fn bulk_update_candidates(
    state: State<'_, AppState>,
    ids: Vec<String>,
    patch: CandidatePatch,
) -> AppResult<usize> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    bulk_update_candidates_sql(&conn, &ids, &patch)
}

pub fn bulk_update_candidates_sql(
    conn: &rusqlite::Connection,
    ids: &[String],
    patch: &CandidatePatch,
) -> AppResult<usize> {
    if ids.is_empty() {
        return Ok(0);
    }
    let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "UPDATE candidates SET submission_status = COALESCE(?1, submission_status),
                                interview_status = COALESCE(?2, interview_status),
                                client_feedback = COALESCE(?3, client_feedback),
                                match_score = COALESCE(?4, match_score),
                                candidate_status = COALESCE(?5, candidate_status),
                                submitted_at = CASE
                                    WHEN ?1 = 'submitted' THEN COALESCE(?6, submitted_at)
                                    WHEN ?1 IS NULL AND ?6 IS NOT NULL THEN ?6
                                    ELSE submitted_at
                                END,
                                interview_at = CASE
                                    WHEN ?1 = 'interview' THEN COALESCE(?7, interview_at)
                                    WHEN ?1 IS NULL AND ?7 IS NOT NULL THEN ?7
                                    ELSE interview_at
                                END,
                                rejection_reason = CASE
                                    WHEN ?1 = 'rejected' THEN COALESCE(?8, rejection_reason)
                                    WHEN ?1 IS NULL AND ?8 IS NOT NULL THEN ?8
                                    ELSE rejection_reason
                                END,
                                placed_at = CASE
                                    WHEN ?1 = 'placed' THEN COALESCE(?9, placed_at)
                                    WHEN ?1 IS NULL AND ?9 IS NOT NULL THEN ?9
                                    ELSE placed_at
                                END,
                                status_history = COALESCE(?10, status_history),
                                interview_feedback = COALESCE(?11, interview_feedback),
                                last_updated = ?12
         WHERE id IN ({})",
        placeholders.join(",")
    );
    let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(patch.submission_status.clone()),
        Box::new(patch.interview_status.clone()),
        Box::new(patch.client_feedback.clone()),
        Box::new(patch.match_score),
        Box::new(patch.candidate_status.clone()),
        Box::new(patch.submitted_at.clone()),
        Box::new(patch.interview_at.clone()),
        Box::new(patch.rejection_reason.clone()),
        Box::new(patch.placed_at.clone()),
        Box::new(patch.status_history.clone()),
        Box::new(patch.interview_feedback.clone()),
        Box::new(now()),
    ];
    for id in ids {
        p.push(Box::new(id.clone()));
    }
    let affected = conn.execute(&sql, rusqlite::params_from_iter(p.iter().map(|b| b.as_ref())))?;
    Ok(affected)
}

#[tauri::command]
pub fn delete_candidate(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    conn.execute("DELETE FROM candidates WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn delete_candidates(state: State<'_, AppState>, ids: Vec<String>) -> AppResult<usize> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    if ids.is_empty() {
        return Ok(0);
    }
    let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "DELETE FROM candidates WHERE id IN ({})",
        placeholders.join(",")
    );
    let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    for id in &ids {
        p.push(Box::new(id.clone()));
    }
    let affected =
        conn.execute(&sql, rusqlite::params_from_iter(p.iter().map(|b| b.as_ref())))?;
    Ok(affected)
}

#[tauri::command]
pub fn get_candidates_with_job(
    state: State<'_, AppState>,
    client_id: Option<String>,
    status: Option<String>,
    search: Option<String>,
) -> AppResult<Vec<CandidateWithJob>> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(cid) = &client_id {
        conditions.push("cl.id = ?".to_string());
        params.push(Box::new(cid.clone()));
    }
    if let Some(st) = &status {
        conditions.push("c.submission_status = ?".to_string());
        params.push(Box::new(st.clone()));
    }
    if let Some(s) = &search {
        conditions.push(
            "(c.name LIKE ? ESCAPE '\\' OR COALESCE(c.email,'') LIKE ? ESCAPE '\\' OR COALESCE(c.current_company,'') LIKE ? ESCAPE '\\' OR COALESCE(j.title,'') LIKE ? ESCAPE '\\')"
                .to_string(),
        );
        let p = like_pattern(s.trim());
        for _ in 0..4 {
            params.push(Box::new(p.clone()));
        }
    }

    let mut sql = CANDIDATE_SELECT_JOIN.to_string();
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(" ORDER BY c.last_updated DESC");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter().map(|b| b.as_ref())), |row| {
            row_to_candidate_with_job(row)
        })?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}
