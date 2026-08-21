use tauri::State;

use crate::commands::candidate::CANDIDATE_SELECT;
use crate::commands::job::JOB_SELECT;
use crate::error::{AppError, AppResult};
use crate::models::{Candidate, DashboardStats, JobWithStats, StatusCount};
use crate::rows::row_to_candidate;
use crate::AppState;

enum StatusTarget {
    CandidatesBySubmissionStatus,
    JobsByStatus,
}

fn status_counts(conn: &rusqlite::Connection, target: StatusTarget) -> AppResult<Vec<StatusCount>> {
    let sql = match target {
        StatusTarget::CandidatesBySubmissionStatus => {
            "SELECT submission_status AS status, COUNT(*) AS count FROM candidates GROUP BY submission_status ORDER BY count DESC"
        }
        StatusTarget::JobsByStatus => {
            "SELECT status AS status, COUNT(*) AS count FROM jobs GROUP BY status ORDER BY count DESC"
        }
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(StatusCount {
                status: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

#[tauri::command]
pub fn get_dashboard_stats(state: State<'_, AppState>) -> AppResult<DashboardStats> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;

    let active_jobs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM jobs WHERE status = 'active'",
        [],
        |r| r.get(0),
    )?;
    let total_jobs: i64 = conn.query_row("SELECT COUNT(*) FROM jobs", [], |r| r.get(0))?;
    let total_candidates: i64 = conn.query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0))?;
    let total_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0))?;
    let candidates_needing_action: i64 = conn.query_row(
        "SELECT COUNT(*) FROM candidates WHERE submission_status IN ('in_touch','submitted','interview') AND candidate_status = 'active'",
        [],
        |r| r.get(0),
    )?;
    let interview_candidates: i64 = conn.query_row(
        "SELECT COUNT(*) FROM candidates WHERE submission_status = 'interview'",
        [],
        |r| r.get(0),
    )?;
    let placed_candidates: i64 = conn.query_row(
        "SELECT COUNT(*) FROM candidates WHERE submission_status = 'placed'",
        [],
        |r| r.get(0),
    )?;
    let on_hold_jobs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM jobs WHERE status = 'on_hold'",
        [],
        |r| r.get(0),
    )?;

    let candidates_by_status = status_counts(&conn, StatusTarget::CandidatesBySubmissionStatus)?;
    let jobs_by_status = status_counts(&conn, StatusTarget::JobsByStatus)?;

    let recent_jobs: Vec<JobWithStats> = {
        let mut stmt = conn.prepare(&format!("{JOB_SELECT} WHERE j.status = 'active' ORDER BY j.updated_at DESC LIMIT 8"))?;
        let rows = stmt
            .query_map([], crate::rows::row_to_job_with_stats)?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    let recent_candidates: Vec<Candidate> = {
        let mut stmt = conn.prepare(
            &format!("{CANDIDATE_SELECT} WHERE c.submission_status NOT IN ('not_interested', 'rejected') ORDER BY c.last_updated DESC LIMIT 8"),
        )?;
        let rows = stmt
            .query_map([], row_to_candidate)?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    Ok(DashboardStats {
        active_jobs,
        total_jobs,
        total_candidates,
        total_clients,
        candidates_needing_action,
        interview_candidates,
        placed_candidates,
        on_hold_jobs,
        candidates_by_status,
        jobs_by_status,
        recent_jobs,
        recent_candidates,
    })
}
