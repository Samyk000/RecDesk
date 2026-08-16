use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{Candidate, CandidateInput, CandidateWithJob};
use crate::rows::{new_id, now, row_to_candidate, row_to_candidate_with_job};
use crate::AppState;

const CANDIDATE_SELECT: &str = r#"
  SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
         c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
         c.match_score, c.submission_status, c.interview_status, c.client_feedback,
         c.candidate_status, c.date_added, c.last_updated
  FROM candidates c
"#;

const CANDIDATE_SELECT_JOIN: &str = r#"
  SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
         c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
         c.match_score, c.submission_status, c.interview_status, c.client_feedback,
         c.candidate_status, c.date_added, c.last_updated,
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
            "(c.name LIKE ? OR COALESCE(c.email,'') LIKE ? OR COALESCE(c.current_company,'') LIKE ? OR COALESCE(c.current_title,'') LIKE ? OR COALESCE(c.location,'') LIKE ?)"
                .to_string(),
        );
        let p = format!("%{}%", s.trim());
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
    let sql = format!("{CANDIDATE_SELECT} WHERE c.id = ?1");
    conn.query_row(&sql, params![id], row_to_candidate)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::Msg("Candidate not found".into()),
            other => other.into(),
        })
}

#[tauri::command]
pub fn create_candidate(
    state: State<'_, AppState>,
    input: CandidateInput,
) -> AppResult<Candidate> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO candidates (id, job_id, name, email, phone, location, current_title,
                                 current_company, experience_years, resume_path, recruiter_notes,
                                 match_score, submission_status, interview_status, client_feedback,
                                 candidate_status, date_added, last_updated)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17)",
        params![
            id,
            input.job_id,
            input.name,
            input.email,
            input.phone,
            input.location,
            input.current_title,
            input.current_company,
            input.experience_years,
            input.resume_path,
            input.recruiter_notes,
            input.match_score,
            input.submission_status.unwrap_or_else(|| "new".to_string()),
            input.interview_status,
            input.client_feedback,
            input.candidate_status.unwrap_or_else(|| "active".to_string()),
            ts
        ],
    )?;
    let cand = conn.query_row(
        "SELECT id, job_id, name, email, phone, location, current_title, current_company,
                experience_years, resume_path, recruiter_notes, match_score, submission_status,
                interview_status, client_feedback, candidate_status, date_added, last_updated
         FROM candidates WHERE id = ?1",
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
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let affected = conn.execute(
        "UPDATE candidates SET job_id = ?1, name = ?2, email = ?3, phone = ?4, location = ?5,
                               current_title = ?6, current_company = ?7, experience_years = ?8,
                               resume_path = ?9, recruiter_notes = ?10, match_score = ?11,
                               submission_status = ?12, interview_status = ?13,
                               client_feedback = ?14, candidate_status = ?15, last_updated = ?16
         WHERE id = ?17",
        params![
            input.job_id,
            input.name,
            input.email,
            input.phone,
            input.location,
            input.current_title,
            input.current_company,
            input.experience_years,
            input.resume_path,
            input.recruiter_notes,
            input.match_score,
            input.submission_status.unwrap_or_else(|| "new".to_string()),
            input.interview_status,
            input.client_feedback,
            input.candidate_status.unwrap_or_else(|| "active".to_string()),
            now(),
            id
        ],
    )?;
    if affected == 0 {
        return Err("Candidate not found".into());
    }
    let cand = conn.query_row(
        "SELECT id, job_id, name, email, phone, location, current_title, current_company,
                experience_years, resume_path, recruiter_notes, match_score, submission_status,
                interview_status, client_feedback, candidate_status, date_added, last_updated
         FROM candidates WHERE id = ?1",
        params![&id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CandidatePatch {
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
}

#[tauri::command]
pub fn bulk_update_candidates(
    state: State<'_, AppState>,
    ids: Vec<String>,
    patch: CandidatePatch,
) -> AppResult<usize> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
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
                                last_updated = ?6
         WHERE id IN ({})",
        placeholders.join(",")
    );
    let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(patch.submission_status),
        Box::new(patch.interview_status),
        Box::new(patch.client_feedback),
        Box::new(patch.match_score),
        Box::new(patch.candidate_status),
        Box::new(now()),
    ];
    for id in &ids {
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
pub fn get_candidates_with_job(
    state: State<'_, AppState>,
    client_id: Option<String>,
    search: Option<String>,
) -> AppResult<Vec<CandidateWithJob>> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(cid) = &client_id {
        conditions.push("cl.id = ?".to_string());
        params.push(Box::new(cid.clone()));
    }
    if let Some(s) = &search {
        conditions.push(
            "(c.name LIKE ? OR COALESCE(c.email,'') LIKE ? OR COALESCE(c.current_company,'') LIKE ? OR COALESCE(j.title,'') LIKE ?)"
                .to_string(),
        );
        let p = format!("%{}%", s.trim());
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
