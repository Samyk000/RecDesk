use rusqlite::params;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{JobInput, JobWithStats};
use crate::rows::{
    like_pattern, new_id, now, row_to_job_with_stats, serialize_bools, serialize_questions,
};
use crate::AppState;

pub const JOB_SELECT: &str = r#"
  SELECT j.id, j.client_id, j.job_id, j.title, j.location, j.work_model, j.contract_type,
         j.status, j.refined_jd, j.boolean_strings, j.candidate_pitch,
         j.screening_questions, j.notes, j.created_at, j.updated_at, j.closed_at, j.sort_order,
         j.bill_rate, j.pay_rate,
         c.name,
         (SELECT COUNT(*) FROM candidates ca WHERE ca.job_id = j.id)
  FROM jobs j JOIN clients c ON c.id = j.client_id
"#;

fn fetch_job(conn: &rusqlite::Connection, id: &str) -> AppResult<JobWithStats> {
    let sql = format!("{JOB_SELECT} WHERE j.id = ?1");
    conn.query_row(&sql, params![id], row_to_job_with_stats)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::Msg("Job not found".into()),
            other => other.into(),
        })
}

#[tauri::command]
pub fn get_jobs(
    state: State<'_, AppState>,
    client_id: Option<String>,
    status: Option<String>,
    search: Option<String>,
) -> AppResult<Vec<JobWithStats>> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(cid) = &client_id {
        conditions.push("j.client_id = ?".to_string());
        params.push(Box::new(cid.clone()));
    }
    if let Some(st) = &status {
        conditions.push("j.status = ?".to_string());
        params.push(Box::new(st.clone()));
    }
    if let Some(s) = &search {
        conditions.push(
            "(j.title LIKE ? ESCAPE '\\' OR j.job_id LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR COALESCE(j.location,'') LIKE ? ESCAPE '\\')"
                .to_string(),
        );
        let p = like_pattern(s.trim());
        for _ in 0..4 {
            params.push(Box::new(p.clone()));
        }
    }

    let mut sql = JOB_SELECT.to_string();
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(" ORDER BY j.sort_order, j.updated_at DESC");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter().map(|b| b.as_ref())), |row| {
            row_to_job_with_stats(row)
        })?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

#[tauri::command]
pub fn get_job(state: State<'_, AppState>, id: String) -> AppResult<JobWithStats> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    fetch_job(&conn, &id)
}

#[tauri::command]
pub fn create_job(state: State<'_, AppState>, input: JobInput) -> AppResult<JobWithStats> {
    let client_id = input.client_id.trim().to_string();
    if client_id.is_empty() {
        return Err("Client is required".into());
    }
    let job_id = input.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err("Job ID cannot be empty".into());
    }
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("Job title cannot be empty".into());
    }
    let status_raw = input.status.as_deref().unwrap_or("active").trim().to_lowercase();
    let status = match status_raw.as_str() {
        "on_hold" => "on_hold".to_string(),
        "closed" => "closed".to_string(),
        _ => "active".to_string(),
    };

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let id = new_id();
    let ts = now();
    let closed_at = if status == "closed" {
        input.closed_at.or_else(|| Some(now()))
    } else {
        input.closed_at
    };
    conn.execute(
        "INSERT INTO jobs (id, client_id, job_id, title, location, work_model, contract_type,
                          bill_rate, pay_rate,
                          status, refined_jd, boolean_strings, candidate_pitch,
                          screening_questions, notes, created_at, updated_at, closed_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16, ?17, ?18)",
        params![
            id,
            client_id,
            job_id,
            title,
            input.location,
            input.work_model,
            input.contract_type,
            input.bill_rate,
            input.pay_rate,
            status,
            input.refined_jd,
            serialize_bools(&input.boolean_strings),
            input.candidate_pitch,
            serialize_questions(&input.screening_questions),
            input.notes,
            ts,
            closed_at,
            conn.query_row("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM jobs", [], |r| r.get::<_, i64>(0))?
        ],
    )?;
    fetch_job(&conn, &id)
}

#[tauri::command]
pub fn update_job(state: State<'_, AppState>, id: String, input: JobInput) -> AppResult<JobWithStats> {
    let client_id = input.client_id.trim().to_string();
    if client_id.is_empty() {
        return Err("Client is required".into());
    }
    let job_id = input.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err("Job ID cannot be empty".into());
    }
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("Job title cannot be empty".into());
    }
    let status_raw = input.status.as_deref().unwrap_or("active").trim().to_lowercase();
    let status = match status_raw.as_str() {
        "on_hold" => "on_hold".to_string(),
        "closed" => "closed".to_string(),
        _ => "active".to_string(),
    };

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let closed_at = if status == "closed" {
        input.closed_at.or_else(|| Some(now()))
    } else {
        None
    };
    let affected = conn.execute(
        "UPDATE jobs SET client_id = ?1, job_id = ?2, title = ?3, location = ?4, work_model = ?5,
                         contract_type = ?6, bill_rate = ?7, pay_rate = ?8, status = ?9,
                         refined_jd = ?10, boolean_strings = ?11,
                         candidate_pitch = ?12, screening_questions = ?13, notes = ?14,
                         updated_at = ?15, closed_at = ?16
         WHERE id = ?17",
        params![
            client_id,
            job_id,
            title,
            input.location,
            input.work_model,
            input.contract_type,
            input.bill_rate,
            input.pay_rate,
            status,
            input.refined_jd,
            serialize_bools(&input.boolean_strings),
            input.candidate_pitch,
            serialize_questions(&input.screening_questions),
            input.notes,
            now(),
            closed_at,
            id
        ],
    )?;
    if affected == 0 {
        return Err("Job not found".into());
    }
    fetch_job(&conn, &id)
}

#[tauri::command]
pub fn delete_job(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn move_job(state: State<'_, AppState>, id: String, direction: i64) -> AppResult<()> {
    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut ids: Vec<String> = conn
        .prepare("SELECT id FROM jobs ORDER BY sort_order, updated_at DESC")?
        .query_map([], |r| r.get(0))?
        .collect::<Result<_, rusqlite::Error>>()?;
    let pos = ids
        .iter()
        .position(|x| *x == id)
        .ok_or_else(|| AppError::Msg("Job not found".into()))?;
    let target = pos as i64 + direction;
    if target < 0 || target >= ids.len() as i64 {
        return Ok(());
    }
    ids.swap(pos, target as usize);
    let tx = conn.transaction()?;
    for (i, jid) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE jobs SET sort_order = ?1 WHERE id = ?2",
            params![i as i64, jid],
        )?;
    }
    tx.commit()?;
    Ok(())
}
