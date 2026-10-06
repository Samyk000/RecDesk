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

// List projection: same column order as CANDIDATE_SELECT so row_to_candidate works,
// but the four JSON blobs read as NULL. Detail views fetch the full row.
pub const CANDIDATE_SELECT_SLIM: &str = r#"
  SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
         c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
         c.match_score, c.submission_status, c.interview_status, c.client_feedback,
         c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
         c.date_added, c.last_updated, c.linkedin_url, NULL, NULL,
         c.placed_at, NULL, NULL
  FROM candidates c
"#;

pub const CANDIDATE_SELECT_JOIN: &str = r#"
  SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
         c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
         c.match_score, c.submission_status, c.interview_status, c.client_feedback,
         c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
         c.date_added, c.last_updated, c.linkedin_url, NULL, c.submission_details,
         c.placed_at, NULL, NULL,
         COALESCE(j.title, 'Unassigned'), COALESCE(j.job_id, '—'), COALESCE(cl.name, '—')
  FROM candidates c
  LEFT JOIN jobs j ON j.id = c.job_id
  LEFT JOIN clients cl ON cl.id = j.client_id
"#;

fn apply_status_condition(
    st: &str,
    conditions: &mut Vec<String>,
    params: &mut Vec<Box<dyn rusqlite::types::ToSql>>,
) {
    if st == "interview" {
        conditions.push(
            "(c.submission_status IN ('interview', 'placed') 
             OR (c.interview_at IS NOT NULL AND TRIM(c.interview_at) != '') 
             OR (c.submission_status = 'rejected' AND (
                 c.rejection_reason LIKE '%\"interview\"%' 
                 OR (c.interview_at IS NOT NULL AND TRIM(c.interview_at) != '')
             )))".to_string(),
        );
    } else if st == "submitted" {
        conditions.push(
            "(c.submission_status IN ('submitted', 'interview', 'placed') 
             OR (c.submission_status = 'rejected' AND (
                 c.rejection_reason LIKE '%\"client_screening\"%' 
                 OR c.rejection_reason LIKE '%\"interview\"%' 
                 OR (c.submitted_at IS NOT NULL AND TRIM(c.submitted_at) != '')
             )))".to_string(),
        );
    } else {
        conditions.push("c.submission_status = ?".to_string());
        params.push(Box::new(st.to_string()));
    }
}

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
        apply_status_condition(st, &mut conditions, &mut params);
    }
    if let Some(s) = &search {
        conditions.push(
            "(c.name LIKE ? ESCAPE '\\' OR COALESCE(c.email,'') LIKE ? ESCAPE '\\' OR COALESCE(c.current_company,'') LIKE ? ESCAPE '\\' OR COALESCE(c.current_title,'') LIKE ? ESCAPE '\\' OR COALESCE(c.location,'') LIKE ? ESCAPE '\\' OR COALESCE(c.submission_details,'') LIKE ? ESCAPE '\\')"
                .to_string(),
        );
        let p = like_pattern(s.trim());
        for _ in 0..6 {
            params.push(Box::new(p.clone()));
        }
    }

    let mut sql = CANDIDATE_SELECT_SLIM.to_string();
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
    let name = input.name.as_deref().unwrap_or_default().trim().to_string();
    if name.is_empty() {
        return Err("Candidate name cannot be empty".into());
    }
    let job_id = input.job_id.as_deref().unwrap_or_default().trim().to_string();
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
            input.email.flatten(),
            input.phone.flatten(),
            input.location.flatten(),
            input.current_title.flatten(),
            input.current_company.flatten(),
            input.experience_years.flatten(),
            input.resume_path.flatten(),
            input.linkedin_url.flatten(),
            input.recruiter_notes.flatten(),
            input.match_score.flatten(),
            input
                .submission_status
                .flatten()
                .unwrap_or_else(|| "sourced".to_string()),
            input.interview_status.flatten(),
            input.client_feedback.flatten(),
            input
                .candidate_status
                .flatten()
                .unwrap_or_else(|| "active".to_string()),
            input.submitted_at.flatten(),
            input.interview_at.flatten(),
            input.rejection_reason.flatten(),
            input
                .screening_answers
                .flatten()
                .unwrap_or_else(|| "{}".to_string()),
            input
                .submission_details
                .flatten()
                .unwrap_or_else(|| "{}".to_string()),
            input.placed_at.flatten(),
            input.status_history.flatten().unwrap_or_else(|| "[]".to_string()),
            input
                .interview_feedback
                .flatten()
                .unwrap_or_else(|| "{}".to_string()),
            ts
        ],
    )?;
    let _ = conn.execute(
        "UPDATE jobs SET updated_at = ?1 WHERE id = ?2",
        params![&ts, &job_id],
    );
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
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    update_candidate_in(&conn, &id, &input)
}

/// Production update path, kept free of Tauri state so tests exercise the real SQL.
/// Sparse by construction: only fields present in `input` land in the SET clause,
/// so two partial saves can never overwrite each other's columns.
pub fn update_candidate_in(
    conn: &rusqlite::Connection,
    id: &str,
    input: &CandidateInput,
) -> AppResult<Candidate> {
    let mut columns: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    // `col = ?n` for every key the client actually sent; absent keys are skipped.
    macro_rules! set_if_present {
        ($col:expr, $val:expr) => {
            if let Some(v) = &$val {
                columns.push(format!("{} = ?{}", $col, values.len() + 1));
                values.push(Box::new(v.clone()));
            }
        };
    }

    if let Some(raw) = &input.name {
        let v = raw.trim().to_string();
        if v.is_empty() {
            return Err("Candidate name cannot be empty".into());
        }
        columns.push(format!("name = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    let target_job_id: Option<String> = if let Some(raw) = &input.job_id {
        let v = raw.trim().to_string();
        if v.is_empty() {
            return Err("Job assignment is required".into());
        }
        columns.push(format!("job_id = ?{}", values.len() + 1));
        values.push(Box::new(v.clone()));
        Some(v)
    } else {
        None
    };

    set_if_present!("email", input.email);
    set_if_present!("phone", input.phone);
    set_if_present!("location", input.location);
    set_if_present!("current_title", input.current_title);
    set_if_present!("current_company", input.current_company);
    set_if_present!("experience_years", input.experience_years);
    set_if_present!("resume_path", input.resume_path);
    set_if_present!("linkedin_url", input.linkedin_url);
    set_if_present!("recruiter_notes", input.recruiter_notes);
    set_if_present!("match_score", input.match_score);
    set_if_present!("submission_status", input.submission_status);
    set_if_present!("interview_status", input.interview_status);
    set_if_present!("client_feedback", input.client_feedback);
    set_if_present!("candidate_status", input.candidate_status);
    set_if_present!("submitted_at", input.submitted_at);
    set_if_present!("interview_at", input.interview_at);
    set_if_present!("rejection_reason", input.rejection_reason);
    set_if_present!("placed_at", input.placed_at);
    set_if_present!("screening_answers", input.screening_answers);
    set_if_present!("submission_details", input.submission_details);
    set_if_present!("status_history", input.status_history);
    set_if_present!("interview_feedback", input.interview_feedback);

    if columns.is_empty() {
        return Err("No fields to update".into());
    }

    columns.push(format!("last_updated = ?{}", values.len() + 1));
    values.push(Box::new(now()));
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE candidates SET {} WHERE id = ?{}",
        columns.join(", "),
        values.len()
    );
    let affected =
        conn.execute(&sql, rusqlite::params_from_iter(values.iter().map(|b| b.as_ref())))?;
    if affected == 0 {
        return Err("Candidate not found".into());
    }

    if let Some(jid) = target_job_id {
        let _ = conn.execute(
            "UPDATE jobs SET updated_at = ?1 WHERE id = ?2",
            params![now(), &jid],
        );
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
    let now_str = now();
    let mut total_affected = 0;
    for chunk in ids.chunks(500) {
        let placeholders: Vec<String> = chunk.iter().map(|_| "?".to_string()).collect();
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
            Box::new(now_str.clone()),
        ];
        for id in chunk {
            p.push(Box::new(id.clone()));
        }
        total_affected +=
            conn.execute(&sql, rusqlite::params_from_iter(p.iter().map(|b| b.as_ref())))?;
    }
    Ok(total_affected)
}

#[tauri::command]
pub fn delete_candidate(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let path: Option<String> = conn
        .query_row(
            "SELECT resume_path FROM candidates WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .ok();

    conn.execute("DELETE FROM candidates WHERE id = ?1", params![id])?;

    if let Some(p) = path {
        let other_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM candidates WHERE resume_path = ?1",
                params![&p],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if other_count == 0 {
            if let Err(e) = std::fs::remove_file(&p) {
                eprintln!("recdesk: failed to remove unreferenced resume {p}: {e}");
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_candidates(state: State<'_, AppState>, ids: Vec<String>) -> AppResult<usize> {
    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    if ids.is_empty() {
        return Ok(0);
    }

    // Collect resume paths for candidates being deleted
    let mut paths_to_check: Vec<String> = Vec::new();
    for chunk in ids.chunks(500) {
        let placeholders: Vec<String> = chunk.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "SELECT resume_path FROM candidates WHERE id IN ({}) AND resume_path IS NOT NULL",
            placeholders.join(",")
        );
        let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        for id in chunk {
            p.push(Box::new(id.clone()));
        }
        if let Ok(mut stmt) = conn.prepare(&sql) {
            if let Ok(rows) = stmt.query_map(
                rusqlite::params_from_iter(p.iter().map(|b| b.as_ref())),
                |r| r.get::<_, String>(0),
            ) {
                for path in rows.flatten() {
                    paths_to_check.push(path);
                }
            }
        }
    }

    let tx = conn.transaction()?;
    let mut total_affected = 0;
    for chunk in ids.chunks(500) {
        let placeholders: Vec<String> = chunk.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "DELETE FROM candidates WHERE id IN ({})",
            placeholders.join(",")
        );
        let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        for id in chunk {
            p.push(Box::new(id.clone()));
        }
        total_affected +=
            tx.execute(&sql, rusqlite::params_from_iter(p.iter().map(|b| b.as_ref())))?;
    }
    tx.commit()?;

    clean_unreferenced_resumes(&conn, &paths_to_check);

    Ok(total_affected)
}

pub fn clean_unreferenced_resumes(conn: &rusqlite::Connection, paths: &[String]) {
    for p in paths {
        let other_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM candidates WHERE resume_path = ?1",
                params![p],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if other_count == 0 {
            if let Err(e) = std::fs::remove_file(p) {
                eprintln!("recdesk: failed to remove unreferenced resume {p}: {e}");
            }
        }
    }
}

#[tauri::command]
pub fn get_candidates_with_job(
    state: State<'_, AppState>,
    client_id: Option<String>,
    status: Option<String>,
    search: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> AppResult<Vec<CandidateWithJob>> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(cid) = &client_id {
        conditions.push("cl.id = ?".to_string());
        params.push(Box::new(cid.clone()));
    }
    if let Some(st) = &status {
        apply_status_condition(st, &mut conditions, &mut params);
    }
    if let Some(s) = &search {
        conditions.push(
            "(c.name LIKE ? ESCAPE '\\' OR COALESCE(c.email,'') LIKE ? ESCAPE '\\' OR COALESCE(c.current_company,'') LIKE ? ESCAPE '\\' OR COALESCE(c.current_title,'') LIKE ? ESCAPE '\\' OR COALESCE(c.location,'') LIKE ? ESCAPE '\\' OR COALESCE(j.title,'') LIKE ? ESCAPE '\\' OR COALESCE(c.submission_details,'') LIKE ? ESCAPE '\\')"
                .to_string(),
        );
        let p = like_pattern(s.trim());
        for _ in 0..7 {
            params.push(Box::new(p.clone()));
        }
    }

    let mut sql = CANDIDATE_SELECT_JOIN.to_string();
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    let order_col = match sort_by.as_deref() {
        Some("name") => "c.name",
        Some("candidate_title") => "COALESCE(c.current_title, '')",
        Some("experience_years") => "COALESCE(c.experience_years, -1)",
        Some("job_title") => "COALESCE(j.title, 'Unassigned')",
        Some("client_name") => "COALESCE(cl.name, '—')",
        Some("location") => "COALESCE(c.location, '')",
        Some("date_added") => "c.date_added",
        Some("last_updated") => "c.last_updated",
        _ => "c.last_updated",
    };
    let dir = if sort_dir.as_deref() == Some("asc") { "ASC" } else { "DESC" };
    sql.push_str(&format!(" ORDER BY {} {}, c.last_updated DESC", order_col, dir));

    // SQLite requires a LIMIT clause for OFFSET to take effect.
    if let Some(lim) = limit {
        sql.push_str(" LIMIT ?");
        params.push(Box::new(lim));
    } else if offset.is_some() {
        sql.push_str(" LIMIT -1");
    }
    if let Some(off) = offset {
        sql.push_str(" OFFSET ?");
        params.push(Box::new(off));
    }

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter().map(|b| b.as_ref())), |row| {
            row_to_candidate_with_job(row)
        })?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}
