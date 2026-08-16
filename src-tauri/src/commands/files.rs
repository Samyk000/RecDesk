use std::path::PathBuf;

use rusqlite::params;
use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::models::Candidate;
use crate::rows::row_to_candidate;
use crate::AppState;

fn resumes_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Msg(e.to_string()))?
        .join("resumes");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

#[tauri::command]
pub fn attach_resume(
    app: AppHandle,
    state: State<'_, AppState>,
    candidate_id: String,
    source_path: String,
) -> AppResult<Candidate> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {source_path}").into());
    }

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let job_id: String = conn.query_row(
        "SELECT job_id FROM candidates WHERE id = ?1",
        params![&candidate_id],
        |r| r.get(0),
    )?;
    drop(conn);

    let filename = source
        .file_name()
        .ok_or_else(|| AppError::Msg("Invalid file name".into()))?
        .to_string_lossy()
        .to_string();

    let safe_candidate = candidate_id.replace(|c: char| !c.is_ascii_alphanumeric() && c != '_', "_");
    let job_dir = resumes_dir(&app)?.join(&job_id);
    std::fs::create_dir_all(&job_dir)?;
    let dest = job_dir.join(format!("{safe_candidate}_{filename}"));

    if dest.exists() {
        std::fs::remove_file(&dest)?;
    }
    std::fs::copy(&source, &dest)?;

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    conn.execute(
        "UPDATE candidates SET resume_path = ?1, last_updated = ?2 WHERE id = ?3",
        params![dest.to_string_lossy().to_string(), crate::rows::now(), candidate_id],
    )?;
    let cand = conn.query_row(
        "SELECT id, job_id, name, email, phone, location, current_title, current_company,
                experience_years, resume_path, recruiter_notes, match_score, submission_status,
                interview_status, client_feedback, candidate_status, submitted_at, interview_at,
                rejection_reason, date_added, last_updated
         FROM candidates WHERE id = ?1",
        params![&candidate_id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[tauri::command]
pub fn remove_resume(state: State<'_, AppState>, candidate_id: String) -> AppResult<Candidate> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    conn.execute(
        "UPDATE candidates SET resume_path = NULL, last_updated = ?1 WHERE id = ?2",
        params![crate::rows::now(), candidate_id],
    )?;
    let cand = conn.query_row(
        "SELECT id, job_id, name, email, phone, location, current_title, current_company,
                experience_years, resume_path, recruiter_notes, match_score, submission_status,
                interview_status, client_feedback, candidate_status, submitted_at, interview_at,
                rejection_reason, date_added, last_updated
         FROM candidates WHERE id = ?1",
        params![&candidate_id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[tauri::command]
pub fn resume_exists(_state: State<'_, AppState>, path: String) -> AppResult<bool> {
    Ok(PathBuf::from(path).exists())
}
