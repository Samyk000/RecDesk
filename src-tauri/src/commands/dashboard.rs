use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{Candidate, DashboardStats, JobWithStats, StatusCount};
use crate::rows::row_to_candidate;
use crate::AppState;

const CANDIDATE_SELECT: &str = r#"
  SELECT c.id, c.job_id, c.name, c.email, c.phone, c.location, c.current_title,
         c.current_company, c.experience_years, c.resume_path, c.recruiter_notes,
         c.match_score, c.submission_status, c.interview_status, c.client_feedback,
         c.candidate_status, c.submitted_at, c.interview_at, c.rejection_reason,
         c.date_added, c.last_updated, c.linkedin_url
  FROM candidates c
"#;

fn status_counts(conn: &rusqlite::Connection, table: &str, status_col: &str) -> AppResult<Vec<StatusCount>> {
    let sql = format!(
        "SELECT {status_col} AS status, COUNT(*) AS count FROM {table} GROUP BY {status_col} ORDER BY count DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
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
    let on_hold_jobs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM jobs WHERE status = 'on_hold'",
        [],
        |r| r.get(0),
    )?;

    let candidates_by_status = status_counts(&conn, "candidates", "submission_status")?;
    let jobs_by_status = status_counts(&conn, "jobs", "status")?;

    let recent_jobs: Vec<JobWithStats> = {
        let mut stmt = conn.prepare(
            r#"SELECT j.id, j.client_id, j.job_id, j.title, j.location, j.work_model, j.contract_type,
                  j.status, j.refined_jd, j.boolean_strings, j.candidate_pitch,
                  j.screening_questions, j.notes, j.created_at, j.updated_at, j.closed_at, j.sort_order,
                  j.bill_rate, j.pay_rate,
                  c.name,
                  (SELECT COUNT(*) FROM candidates ca WHERE ca.job_id = j.id)
               FROM jobs j JOIN clients c ON c.id = j.client_id
               ORDER BY j.updated_at DESC LIMIT 8"#,
        )?;
        let rows = stmt
            .query_map([], |row| Ok(crate::rows::row_to_job_with_stats(row)?))?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    let recent_candidates: Vec<Candidate> = {
        let mut stmt = conn.prepare(
            &format!("{CANDIDATE_SELECT} ORDER BY c.last_updated DESC LIMIT 8"),
        )?;
        let rows = stmt
            .query_map([], |row| row_to_candidate(row))?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    Ok(DashboardStats {
        active_jobs,
        total_jobs,
        total_candidates,
        total_clients,
        candidates_needing_action,
        on_hold_jobs,
        candidates_by_status,
        jobs_by_status,
        recent_jobs,
        recent_candidates,
    })
}
