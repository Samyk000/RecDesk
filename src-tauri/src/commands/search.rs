use rusqlite::params;
use tauri::State;

use crate::commands::candidate::CANDIDATE_SELECT_JOIN;
use crate::commands::client::CLIENT_SELECT;
use crate::commands::job::JOB_SELECT;
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
        let sql = format!(
            "{CLIENT_SELECT} WHERE c.name LIKE ?1 ESCAPE '\\' OR COALESCE(c.company,'') LIKE ?1 ESCAPE '\\' OR COALESCE(c.email,'') LIKE ?1 ESCAPE '\\' ORDER BY c.name LIMIT 8"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map(params![pattern.clone()], row_to_client)?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    let jobs: Vec<_> = {
        let sql = format!(
            "{JOB_SELECT} WHERE j.title LIKE ?1 ESCAPE '\\' OR j.job_id LIKE ?1 ESCAPE '\\' OR c.name LIKE ?1 ESCAPE '\\' OR COALESCE(j.location,'') LIKE ?1 ESCAPE '\\' ORDER BY j.updated_at DESC LIMIT 8"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map(params![pattern.clone()], row_to_job_with_stats)?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    let candidates: Vec<_> = {
        let sql = format!(
            "{CANDIDATE_SELECT_JOIN} WHERE c.name LIKE ?1 ESCAPE '\\' OR COALESCE(c.email,'') LIKE ?1 ESCAPE '\\' OR COALESCE(c.current_company,'') LIKE ?1 ESCAPE '\\' OR COALESCE(c.current_title,'') LIKE ?1 ESCAPE '\\' ORDER BY c.last_updated DESC LIMIT 8"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map(params![pattern], row_to_candidate_with_job)?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    Ok(SearchResults {
        clients,
        jobs,
        candidates,
    })
}
