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

pub fn auto_hold_stale_jobs(conn: &rusqlite::Connection) -> AppResult<usize> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE jobs
         SET status = 'on_hold', updated_at = ?1
         WHERE status = 'active'
           AND updated_at < datetime('now', '-14 days')",
        params![ts],
    )?;
    Ok(affected)
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
    sql.push_str(" ORDER BY j.updated_at DESC, j.created_at DESC");

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

fn normalize_status(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "on_hold" => "on_hold".to_string(),
        "closed" => "closed".to_string(),
        _ => "active".to_string(),
    }
}

#[tauri::command]
pub fn create_job(state: State<'_, AppState>, input: JobInput) -> AppResult<JobWithStats> {
    let client_id = input.client_id.unwrap_or_default().trim().to_string();
    if client_id.is_empty() {
        return Err("Client is required".into());
    }
    let job_id = input.job_id.unwrap_or_default().trim().to_string();
    if job_id.is_empty() {
        return Err("Job ID cannot be empty".into());
    }
    let title = input.title.unwrap_or_default().trim().to_string();
    if title.is_empty() {
        return Err("Job title cannot be empty".into());
    }
    let status = normalize_status(input.status.flatten().as_deref().unwrap_or("active"));

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut closed_at = input.closed_at.flatten();
    if status == "closed" && closed_at.is_none() {
        closed_at = Some(now());
    }
    let boolean_strings = input.boolean_strings.unwrap_or_default();
    let screening_questions = input.screening_questions.unwrap_or_default();
    let id = new_id();
    let ts = now();
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
            input.location.flatten(),
            input.work_model.flatten(),
            input.contract_type.flatten(),
            input.bill_rate.flatten(),
            input.pay_rate.flatten(),
            status,
            input.refined_jd.flatten(),
            serialize_bools(&boolean_strings),
            input.candidate_pitch.flatten(),
            serialize_questions(&screening_questions),
            input.notes.flatten(),
            ts,
            closed_at,
            conn.query_row("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM jobs", [], |r| r.get::<_, i64>(0))?
        ],
    )?;
    fetch_job(&conn, &id)
}

#[tauri::command]
pub fn update_job(state: State<'_, AppState>, id: String, input: JobInput) -> AppResult<JobWithStats> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    update_job_in(&conn, &id, &input)?;
    fetch_job(&conn, &id)
}

/// Sparse update: only the keys present in `input` are written, so two
/// concurrent field editors can no longer clobber each other's columns.
pub fn update_job_in(
    conn: &rusqlite::Connection,
    id: &str,
    input: &JobInput,
) -> AppResult<JobWithStats> {
    let mut columns: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    macro_rules! set_if_present {
        ($col:expr, $val:expr) => {
            if let Some(v) = &$val {
                columns.push(format!("{} = ?{}", $col, values.len() + 1));
                values.push(Box::new(v.clone()));
            }
        };
    }

    if let Some(raw) = &input.client_id {
        let v = raw.trim().to_string();
        if v.is_empty() {
            return Err("Client is required".into());
        }
        columns.push(format!("client_id = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(raw) = &input.job_id {
        let v = raw.trim().to_string();
        if v.is_empty() {
            return Err("Job ID cannot be empty".into());
        }
        columns.push(format!("job_id = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(raw) = &input.title {
        let v = raw.trim().to_string();
        if v.is_empty() {
            return Err("Job title cannot be empty".into());
        }
        columns.push(format!("title = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }

    set_if_present!("location", input.location);
    set_if_present!("work_model", input.work_model);
    set_if_present!("contract_type", input.contract_type);
    set_if_present!("bill_rate", input.bill_rate);
    set_if_present!("pay_rate", input.pay_rate);
    set_if_present!("refined_jd", input.refined_jd);
    set_if_present!("candidate_pitch", input.candidate_pitch);
    set_if_present!("notes", input.notes);

    if let Some(b) = &input.boolean_strings {
        columns.push(format!("boolean_strings = ?{}", values.len() + 1));
        values.push(Box::new(serialize_bools(b)));
    }
    if let Some(q) = &input.screening_questions {
        columns.push(format!("screening_questions = ?{}", values.len() + 1));
        values.push(Box::new(serialize_questions(q)));
    }

    // status stays coupled to closed_at: closing stamps it, reopening clears it.
    if let Some(Some(st)) = &input.status {
        let status = normalize_status(st);
        columns.push(format!("status = ?{}", values.len() + 1));
        values.push(Box::new(status.clone()));
        let closed_at: Option<String> = if status == "closed" {
            input.closed_at.clone().and_then(|v| v).or_else(|| Some(now()))
        } else {
            None
        };
        columns.push(format!("closed_at = ?{}", values.len() + 1));
        values.push(Box::new(closed_at));
    } else {
        set_if_present!("closed_at", input.closed_at);
    }

    if columns.is_empty() {
        return Err("No fields to update".into());
    }

    columns.push(format!("updated_at = ?{}", values.len() + 1));
    values.push(Box::new(now()));
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE jobs SET {} WHERE id = ?{}",
        columns.join(", "),
        values.len()
    );
    let affected =
        conn.execute(&sql, rusqlite::params_from_iter(values.iter().map(|b| b.as_ref())))?;
    if affected == 0 {
        return Err("Job not found".into());
    }
    fetch_job(conn, id)
}

#[tauri::command]
pub fn delete_job(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let ts = now();
    // Candidates are preserved as unassigned when their job is deleted
    conn.execute(
        "UPDATE candidates SET job_id = NULL, last_updated = ?1 WHERE job_id = ?2",
        params![ts, id],
    )?;
    conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn bulk_update_jobs(
    state: State<'_, AppState>,
    ids: Vec<String>,
    status: String,
) -> AppResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let status_raw = status.trim().to_lowercase();
    let normalized_status = match status_raw.as_str() {
        "on_hold" => "on_hold",
        "closed" => "closed",
        _ => "active",
    };
    let ts = now();
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "UPDATE jobs SET status = ?1, updated_at = ?2, closed_at = CASE WHEN ?1 = 'closed' THEN COALESCE(closed_at, ?2) ELSE NULL END WHERE id = ?3",
        )?;
        for id in &ids {
            stmt.execute(params![normalized_status, ts, id])?;
        }
    }
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn delete_jobs(state: State<'_, AppState>, ids: Vec<String>) -> AppResult<usize> {
    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    if ids.is_empty() {
        return Ok(0);
    }
    let ts = now();
    let tx = conn.transaction()?;

    // Candidates are preserved as unassigned when jobs are deleted
    for chunk in ids.chunks(500) {
        let placeholders: Vec<String> = chunk.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "UPDATE candidates SET job_id = NULL, last_updated = ?1 WHERE job_id IN ({})",
            placeholders.join(",")
        );
        let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(ts.clone())];
        for id in chunk {
            p.push(Box::new(id.clone()));
        }
        tx.execute(&sql, rusqlite::params_from_iter(p.iter().map(|b| b.as_ref())))?;
    }

    let mut total_affected = 0;
    for chunk in ids.chunks(500) {
        let placeholders: Vec<String> = chunk.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "DELETE FROM jobs WHERE id IN ({})",
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

    Ok(total_affected)
}

#[tauri::command]
pub fn get_stale_jobs_count(state: State<'_, AppState>) -> usize {
    state.stale_jobs_held.swap(0, std::sync::atomic::Ordering::Relaxed)
}
