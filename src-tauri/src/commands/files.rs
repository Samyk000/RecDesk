use std::path::PathBuf;

use rusqlite::params;
use tauri::{AppHandle, Manager, State};

use crate::commands::candidate::CANDIDATE_SELECT;
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
        &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
        params![&candidate_id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[tauri::command]
pub fn remove_resume(state: State<'_, AppState>, candidate_id: String) -> AppResult<Candidate> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let path: Option<String> = conn.query_row(
        "SELECT resume_path FROM candidates WHERE id = ?1",
        params![&candidate_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "UPDATE candidates SET resume_path = NULL, last_updated = ?1 WHERE id = ?2",
        params![crate::rows::now(), candidate_id],
    )?;
    if let Some(p) = path {
        let _ = std::fs::remove_file(p);
    }
    let cand = conn.query_row(
        &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
        params![&candidate_id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[tauri::command]
pub fn rename_resume(
    state: State<'_, AppState>,
    candidate_id: String,
    new_filename: String,
) -> AppResult<Candidate> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let old_path_str: Option<String> = conn.query_row(
        "SELECT resume_path FROM candidates WHERE id = ?1",
        params![&candidate_id],
        |r| r.get(0),
    )?;

    let old_path_str = old_path_str
        .ok_or_else(|| AppError::Msg("Candidate does not have an attached resume".into()))?;

    let old_path = PathBuf::from(&old_path_str);
    if !old_path.exists() {
        return Err(format!("Existing resume file not found: {old_path_str}").into());
    }

    let parent_dir = old_path
        .parent()
        .ok_or_else(|| AppError::Msg("Invalid file directory".into()))?;

    let old_ext = old_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();

    // Sanitize new filename: strip invalid filesystem characters
    let mut clean_name = new_filename.trim().to_string();
    clean_name = clean_name.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
    if clean_name.is_empty() {
        return Err("Filename cannot be empty".into());
    }

    // Preserve extension if user did not include it
    let target_filename = if !old_ext.is_empty() && !clean_name.to_lowercase().ends_with(&format!(".{}", old_ext.to_lowercase())) {
        format!("{clean_name}.{old_ext}")
    } else {
        clean_name
    };

    let new_path = parent_dir.join(&target_filename);

    if new_path != old_path {
        if new_path.exists() {
            let _ = std::fs::remove_file(&new_path);
        }
        std::fs::rename(&old_path, &new_path)
            .map_err(|e| AppError::Msg(format!("Failed to rename file on disk: {e}")))?;
    }

    conn.execute(
        "UPDATE candidates SET resume_path = ?1, last_updated = ?2 WHERE id = ?3",
        params![new_path.to_string_lossy().to_string(), crate::rows::now(), candidate_id],
    )?;

    let cand = conn.query_row(
        &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
        params![&candidate_id],
        row_to_candidate,
    )?;
    Ok(cand)
}

#[tauri::command]
pub fn read_resume_bytes(file_path: String) -> AppResult<Vec<u8>> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {file_path}").into());
    }
    let bytes = std::fs::read(&path)
        .map_err(|e| AppError::Msg(format!("Failed to read file: {e}")))?;
    Ok(bytes)
}

#[tauri::command]
pub fn write_resume_bytes(file_path: String, bytes: Vec<u8>) -> AppResult<()> {
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, &bytes)
        .map_err(|e| AppError::Msg(format!("Failed to save resume file: {e}")))?;
    Ok(())
}
