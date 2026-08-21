use rusqlite::params;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{Candidate, Client, ExportEnvelope, ImportSummary, Job};
use crate::rows::{
    now, row_to_candidate, row_to_client, row_to_job, serialize_bools, serialize_questions,
};
use crate::AppState;

const RAW_CLIENT_SELECT: &str = r#"
  SELECT id, name, company, email, hiring_manager, address, notes,
         created_at, updated_at, sort_order
  FROM clients ORDER BY sort_order, name
"#;

const RAW_JOB_SELECT: &str = r#"
  SELECT id, client_id, job_id, title, location, work_model, contract_type,
         status, refined_jd, boolean_strings, candidate_pitch,
         screening_questions, notes, created_at, updated_at, closed_at, sort_order,
         bill_rate, pay_rate
  FROM jobs ORDER BY sort_order, updated_at DESC
"#;

const RAW_CANDIDATE_SELECT: &str = r#"
  SELECT id, job_id, name, email, phone, location, current_title,
         current_company, experience_years, resume_path, recruiter_notes,
         match_score, submission_status, interview_status, client_feedback,
         candidate_status, submitted_at, interview_at, rejection_reason,
         date_added, last_updated, linkedin_url, screening_answers, submission_details,
         placed_at, status_history, interview_feedback
  FROM candidates ORDER BY last_updated DESC
"#;

fn collect_clients(conn: &rusqlite::Connection) -> AppResult<Vec<Client>> {
    let mut stmt = conn.prepare(RAW_CLIENT_SELECT)?;
    let rows = stmt
        .query_map([], row_to_client)?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

fn collect_jobs(conn: &rusqlite::Connection) -> AppResult<Vec<Job>> {
    let mut stmt = conn.prepare(RAW_JOB_SELECT)?;
    let rows = stmt
        .query_map([], row_to_job)?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

fn collect_candidates(conn: &rusqlite::Connection) -> AppResult<Vec<Candidate>> {
    let mut stmt = conn.prepare(RAW_CANDIDATE_SELECT)?;
    let rows = stmt
        .query_map([], row_to_candidate)?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

pub fn export_json(conn: &rusqlite::Connection) -> AppResult<String> {
    let envelope = ExportEnvelope {
        version: 1,
        exported_at: now(),
        clients: collect_clients(conn)?,
        jobs: collect_jobs(conn)?,
        candidates: collect_candidates(conn)?,
    };
    serde_json::to_string_pretty(&envelope).map_err(AppError::from)
}

pub fn import_json(
    conn: &mut rusqlite::Connection,
    json: &str,
    replace: bool,
) -> AppResult<ImportSummary> {
    let envelope: ExportEnvelope = serde_json::from_str(json)
        .map_err(|e| AppError::Msg(format!("Invalid export file: {e}")))?;
    if envelope.version != 1 {
        return Err(format!(
            "Unsupported export version: {} (expected 1)",
            envelope.version
        )
        .into());
    }

    let tx = conn.transaction()?;

    if replace {
        tx.execute("DELETE FROM candidates", [])?;
        tx.execute("DELETE FROM jobs", [])?;
        tx.execute("DELETE FROM clients", [])?;
    }

    for client in &envelope.clients {
        tx.execute(
            "INSERT OR IGNORE INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                client.id, client.name, client.company, client.email, client.hiring_manager,
                client.address, client.notes, client.created_at, client.updated_at,
                client.sort_order
            ],
        )?;
    }

    for job in &envelope.jobs {
        tx.execute(
            "INSERT OR IGNORE INTO jobs (id, client_id, job_id, title, location, work_model, contract_type,
                bill_rate, pay_rate, status, refined_jd, boolean_strings, candidate_pitch, screening_questions, notes,
                created_at, updated_at, closed_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
            params![
                job.id, job.client_id, job.job_id, job.title, job.location, job.work_model,
                job.contract_type, job.bill_rate, job.pay_rate, job.status, job.refined_jd,
                serialize_bools(&job.boolean_strings), job.candidate_pitch,
                serialize_questions(&job.screening_questions), job.notes,
                job.created_at, job.updated_at, job.closed_at, job.sort_order
            ],
        )?;
    }

    for candidate in &envelope.candidates {
        tx.execute(
            "INSERT OR IGNORE INTO candidates (id, job_id, name, email, phone, location, current_title,
                current_company, experience_years, resume_path, linkedin_url, recruiter_notes, match_score,
                submission_status, interview_status, client_feedback, candidate_status,
                submitted_at, interview_at, rejection_reason, placed_at, screening_answers, submission_details,
                status_history, interview_feedback, date_added, last_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27)",
            params![
                candidate.id, candidate.job_id, candidate.name, candidate.email, candidate.phone,
                candidate.location, candidate.current_title, candidate.current_company,
                candidate.experience_years, candidate.resume_path, candidate.linkedin_url,
                candidate.recruiter_notes, candidate.match_score, candidate.submission_status,
                candidate.interview_status, candidate.client_feedback, candidate.candidate_status,
                candidate.submitted_at, candidate.interview_at, candidate.rejection_reason,
                candidate.placed_at,
                candidate.screening_answers.as_deref().unwrap_or("{}"),
                candidate.submission_details.as_deref().unwrap_or("{}"),
                candidate.status_history.as_deref().unwrap_or("[]"),
                candidate.interview_feedback.as_deref().unwrap_or("{}"),
                candidate.date_added, candidate.last_updated
            ],
        )?;
    }

    tx.commit()?;

    Ok(ImportSummary {
        clients: envelope.clients.len(),
        jobs: envelope.jobs.len(),
        candidates: envelope.candidates.len(),
        replaced: replace,
    })
}

#[tauri::command]
pub fn export_data(state: State<'_, AppState>) -> AppResult<String> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    export_json(&conn)
}

#[tauri::command]
pub fn import_data(
    state: State<'_, AppState>,
    json: String,
    replace: bool,
) -> AppResult<ImportSummary> {
    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    import_json(&mut conn, &json, replace)
}

