use std::path::{Component, Path, PathBuf};

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
    validate_safe_path(&app, &source, false)?;

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
    let safe_job = job_id.replace(|c: char| !c.is_ascii_alphanumeric() && c != '_', "_");
    let job_dir = resumes_dir(&app)?.join(&safe_job);
    std::fs::create_dir_all(&job_dir)?;
    let dest = job_dir.join(format!("{safe_candidate}_{filename}"));

    if dest.exists() {
        std::fs::remove_file(&dest)?;
    }
    std::fs::copy(&source, &dest)?;

    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let affected = conn.execute(
        "UPDATE candidates SET resume_path = ?1, last_updated = ?2 WHERE id = ?3",
        params![dest.to_string_lossy().to_string(), crate::rows::now(), candidate_id],
    )?;
    if affected == 0 {
        // Candidate vanished between the lookup and the write — don't leave an orphan file.
        let _ = std::fs::remove_file(&dest);
        return Err("Candidate no longer exists".into());
    }
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
        let other_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM candidates WHERE resume_path = ?1 AND id != ?2",
                params![&p, &candidate_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if other_count == 0 {
            let _ = std::fs::remove_file(p);
        }
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
    rename_resume_in(&conn, &candidate_id, &new_filename)
}

pub fn rename_resume_in(
    conn: &rusqlite::Connection,
    candidate_id: &str,
    new_filename: &str,
) -> AppResult<Candidate> {
    let old_path_str: Option<String> = conn.query_row(
        "SELECT resume_path FROM candidates WHERE id = ?1",
        params![candidate_id],
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
    if clean_name.is_empty() || clean_name == "." || clean_name == ".." {
        return Err("Filename cannot be empty".into());
    }

    // Preserve extension if user did not include it
    let target_filename = if !old_ext.is_empty() && !clean_name.to_lowercase().ends_with(&format!(".{}", old_ext.to_lowercase())) {
        format!("{clean_name}.{old_ext}")
    } else {
        clean_name.clone()
    };

    let mut new_path = parent_dir.join(&target_filename);

    if new_path == old_path {
        // File already has this exact target path; no rename needed
        let cand = conn.query_row(
            &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
            params![&candidate_id],
            row_to_candidate,
        )?;
        return Ok(cand);
    }

    if new_path.exists() {
        let new_path_str = new_path.to_string_lossy().to_string();
        let in_use_by_other: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM candidates WHERE resume_path = ?1 AND id != ?2",
                params![&new_path_str, &candidate_id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        if in_use_by_other == 0 {
            // It's an orphan or leftover file not owned by any active candidate. Safe to replace!
            let _ = std::fs::remove_file(&new_path);
        } else {
            // Another active candidate is genuinely using this filename; auto-disambiguate with a counter
            let stem = if !old_ext.is_empty()
                && clean_name.to_lowercase().ends_with(&format!(".{}", old_ext.to_lowercase()))
            {
                clean_name[..clean_name.len() - old_ext.len() - 1].to_string()
            } else {
                clean_name.clone()
            };

            let mut counter = 1;
            loop {
                let disambiguated_name = if old_ext.is_empty() {
                    format!("{stem} ({counter})")
                } else {
                    format!("{stem} ({counter}).{old_ext}")
                };
                let candidate_path = parent_dir.join(&disambiguated_name);
                let cand_str = candidate_path.to_string_lossy().to_string();
                let other_active: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM candidates WHERE resume_path = ?1 AND id != ?2",
                        params![&cand_str, &candidate_id],
                        |r| r.get(0),
                    )
                    .unwrap_or(0);

                if other_active == 0 {
                    if candidate_path.exists() {
                        let _ = std::fs::remove_file(&candidate_path);
                    }
                    new_path = candidate_path;
                    break;
                }
                counter += 1;
            }
        }
    }

    std::fs::rename(&old_path, &new_path)
        .map_err(|e| AppError::Msg(format!("Failed to rename file on disk: {e}")))?;

    if let Err(e) = conn.execute(
        "UPDATE candidates SET resume_path = ?1, last_updated = ?2 WHERE id = ?3",
        params![new_path.to_string_lossy().to_string(), crate::rows::now(), candidate_id],
    ) {
        // Roll the on-disk rename back so DB and disk never disagree.
        let _ = std::fs::rename(&new_path, &old_path);
        return Err(e.into());
    }

    let cand = conn.query_row(
        &format!("{CANDIDATE_SELECT} WHERE c.id = ?1"),
        params![&candidate_id],
        row_to_candidate,
    )?;
    Ok(cand)
}

/// Allowlist of document types that may cross the webview boundary.
/// Only documents: no executables, scripts, or extension-less files (e.g. SSH keys).
const ALLOWED_EXTENSIONS: &[&str] = &[
    "pdf", "doc", "docx", "txt", "rtf", "md", "html", "htm", "csv", "json", "xlsx", "odt",
];

/// Drop `.` / `..` components lexically so traversal cannot dodge the root check.
fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in path.components() {
        match c {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Component-wise prefix check, case-insensitive (Windows paths are).
fn starts_with_ci(path: &Path, root: &Path) -> bool {
    let mut parts = path.components();
    for r in root.components() {
        match parts.next() {
            Some(p) if p.as_os_str().to_string_lossy().eq_ignore_ascii_case(&r.as_os_str().to_string_lossy()) => {}
            _ => return false,
        }
    }
    true
}

/// Pure containment/extension rule — `root` is the allowed tree (user home).
/// Reads are canonicalized first, so symlinks cannot escape either.
pub fn check_path(root: &Path, path: &Path, is_write: bool) -> AppResult<()> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!(
            "Access to '.{ext}' files is prohibited. Allowed document formats: {}",
            ALLOWED_EXTENSIONS.join(", ")
        )
        .into());
    }

    if is_write {
        // Target may not exist yet, so check the normalized path lexically.
        if !starts_with_ci(&normalize(path), root) {
            return Err(format!(
                "Access denied: writes are limited to files under {}",
                root.display()
            )
            .into());
        }
    } else {
        let canonical = path
            .canonicalize()
            .map_err(|e| AppError::Msg(format!("Cannot access file: {e}")))?;
        let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        if !starts_with_ci(&canonical, &root) {
            return Err(format!(
                "Access denied: reads are limited to files under {}",
                root.display()
            )
            .into());
        }
    }

    Ok(())
}

/// The webview may only touch files inside the user's home tree (covers
/// app data, Documents, Desktop, Downloads) and only document types.
fn validate_safe_path(app: &AppHandle, path: &Path, is_write: bool) -> AppResult<()> {
    let root = app
        .path()
        .home_dir()
        .map_err(|e| AppError::Msg(e.to_string()))?;
    check_path(&root, path, is_write)
}

#[tauri::command]
pub fn read_resume_bytes(app: AppHandle, file_path: String) -> AppResult<Vec<u8>> {
    let path = PathBuf::from(&file_path);
    validate_safe_path(&app, &path, false)?;
    let bytes = std::fs::read(&path)
        .map_err(|e| AppError::Msg(format!("Failed to read file: {e}")))?;
    Ok(bytes)
}

#[tauri::command]
pub fn write_resume_bytes(app: AppHandle, file_path: String, bytes: Vec<u8>) -> AppResult<()> {
    let path = PathBuf::from(&file_path);
    validate_safe_path(&app, &path, true)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, &bytes)
        .map_err(|e| AppError::Msg(format!("Failed to save resume file: {e}")))?;
    Ok(())
}
