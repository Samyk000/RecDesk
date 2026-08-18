use rusqlite::params;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::SearchResults;
use crate::rows::{like_pattern, row_to_client, row_to_job_with_stats, row_to_candidate_with_job};
use crate::AppState;

#[tauri::command]
pub fn global_search(state: State<'_, AppState>, query: String) -> AppResult<SearchResults> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let q = query.trim();
    if q.is_empty() {
        return Ok(SearchResults {
            clients: vec![],
            jobs: vec![],
            candidates: vec![],
        });
    }
let pattern = like_pattern(q);

    let clients: Vec<_> = {
        let sql = r#"SELECT c.id, c.name, c.company, c.email, c.hiring_manager, c.address, c.notes,
                            c.created_at, c.updated_at, c.sort_order
                     FROM clients c
                     WHERE c.name LIKE ?1 ESCAPE '\' OR COALESCE(c.company,'') LIKE ?1 ESCAPE '\' OR COALESCE(c.email,'') LIKE ?1 ESCAPE '\'
                     ORDER BY c.name LIMIT 8"#;
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt
            .query_map(params![pattern.clone()], |row| row_to_client(row))?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    let jobs: Vec<_> = {
        let sql = r#"SELECT j.id, j.client_id, j.job_id, j.title, j.location, j.work_model, j.contract_type,
                            j.status, j.refined_jd, j.boolean_strings, j.candidate_pitch,
                            j.screening_questions, j.notes, j.created_at, j.updated_at, j.closed_at, j.sort_order,
                            c.name,
                            (SELECT COUNT(*) FROM candidates ca WHERE ca.job_id = j.id)
                     FROM jobs j JOIN clients c ON c.id = j.client_id
                     WHERE j.title LIKE ?1 ESCAPE '\' OR j.job_id LIKE ?1 ESCAPE '\' OR c.name LIKE ?1 ESCAPE '\' OR COALESCE(j.location,'') LIKE ?1 ESCAPE '\'
                     ORDER BY j.updated_at DESC LIMIT 8"#;
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt
            .query_map(params![pattern.clone()], |row| row_to_job_with_stats(row))?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    let candidates: Vec<_> = {
        let sql = r#"SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
                            c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
                            c.match_score, c.submission_status, c.interview_status, c.client_feedback,
                            c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
c.date_added, c.last_updated, c.linkedin_url,
                             j.title, j.job_id, cl.name
                     FROM candidates c
                     JOIN jobs j ON j.id = c.job_id
                     JOIN clients cl ON cl.id = j.client_id
                     WHERE c.name LIKE ?1 ESCAPE '\' OR COALESCE(c.email,'') LIKE ?1 ESCAPE '\' OR COALESCE(c.current_company,'') LIKE ?1 ESCAPE '\' OR COALESCE(c.current_title,'') LIKE ?1 ESCAPE '\'
                     ORDER BY c.last_updated DESC LIMIT 8"#;
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt
            .query_map(params![pattern], |row| row_to_candidate_with_job(row))?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    Ok(SearchResults {
        clients,
        jobs,
        candidates,
    })
}
