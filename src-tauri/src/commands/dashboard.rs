use tauri::State;

use std::collections::HashMap;

use crate::commands::candidate::CANDIDATE_SELECT_SLIM;
use crate::commands::job::JOB_SELECT;
use crate::error::{AppError, AppResult};
use crate::models::{Candidate, DashboardStats, JobWithStats, MetricTrend, StatusCount};
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
    let interview_candidates: i64 = {
        let mut stmt = conn.prepare(
            "SELECT interview_status, interview_at, submission_status, rejection_reason FROM candidates",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, Option<String>>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })?;

        let mut count: i64 = 0;
        for row in rows {
            let (int_status, int_at, sub_status, rej_reason) = row?;
            let has_int_at = int_at.as_deref().map(|s| !s.trim().is_empty()).unwrap_or(false);
            let rej = rej_reason.as_deref().unwrap_or("");
            let is_interview_candidate = matches!(sub_status.as_str(), "interview" | "placed")
                || has_int_at
                || (sub_status == "rejected" && rej.contains("\"interview\""));

            if !is_interview_candidate {
                continue;
            }

            if let Some(raw) = int_status.as_deref() {
                if let Ok(serde_json::Value::Array(arr)) = serde_json::from_str::<serde_json::Value>(raw) {
                    if !arr.is_empty() {
                        count += arr.len() as i64;
                        continue;
                    }
                }
            }
            count += 1;
        }
        count
    };
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
    let external_submissions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM candidates 
         WHERE submission_status IN ('submitted', 'interview', 'placed')
            OR (submission_status = 'rejected' AND (
                rejection_reason LIKE '%\"client_screening\"%' 
                OR rejection_reason LIKE '%\"interview\"%'
                OR (submitted_at IS NOT NULL AND TRIM(submitted_at) != '')
            ))",
        [],
        |r| r.get(0),
    )?;

    let candidates_by_status = status_counts(&conn, StatusTarget::CandidatesBySubmissionStatus)?;
    let jobs_by_status = status_counts(&conn, StatusTarget::JobsByStatus)?;

    let (candidates_trend, submissions_trend, interviews_trend, placed_trend) =
        compute_all_trends(&conn)?;

    let recent_jobs: Vec<JobWithStats> = {
        let mut stmt = conn.prepare(&format!("{JOB_SELECT} WHERE j.status = 'active' ORDER BY j.created_at DESC, j.updated_at DESC LIMIT 8"))?;
        let rows = stmt
            .query_map([], crate::rows::row_to_job_with_stats)?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?;
        rows
    };

    let recent_candidates: Vec<Candidate> = {
        let mut stmt = conn.prepare(
            &format!("{CANDIDATE_SELECT_SLIM} WHERE c.submission_status NOT IN ('not_interested', 'rejected', 'pipeline') ORDER BY c.last_updated DESC LIMIT 8"),
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
        external_submissions,
        candidates_by_status,
        jobs_by_status,
        recent_jobs,
        recent_candidates,
        candidates_trend,
        submissions_trend,
        interviews_trend,
        placed_trend,
    })
}

/// One table scan feeds all four trends. The previous version ran four
/// separate `substr()` full scans with expression WHERE clauses no index
/// could serve.
pub(crate) fn compute_all_trends(
    conn: &rusqlite::Connection,
) -> AppResult<(MetricTrend, MetricTrend, MetricTrend, MetricTrend)> {
    let mut stmt = conn.prepare(
        "SELECT date_added, last_updated, submitted_at, interview_at, placed_at,
                submission_status, rejection_reason, interview_status
         FROM candidates",
    )?;

    let mut cand_counts: HashMap<String, i64> = HashMap::new();
    let mut sub_counts: HashMap<String, i64> = HashMap::new();
    let mut int_counts: HashMap<String, i64> = HashMap::new();
    let mut plac_counts: HashMap<String, i64> = HashMap::new();

    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, Option<String>>(0)?,
            r.get::<_, Option<String>>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, Option<String>>(3)?,
            r.get::<_, Option<String>>(4)?,
            r.get::<_, String>(5)?,
            r.get::<_, Option<String>>(6)?,
            r.get::<_, Option<String>>(7)?,
        ))
    })?;

    for row in rows {
        let (date_added, last_updated, submitted_at, interview_at, placed_at, status, rej_raw, int_status) =
            row?;
        let rej = rej_raw.as_deref().unwrap_or("");
        let submitted_ne = nonempty(submitted_at.as_deref()).is_some();
        let interview_ne = nonempty(interview_at.as_deref()).is_some();
        let status = status.as_str();

        bump(
            &mut cand_counts,
            &trend_day(date_added.as_deref(), last_updated.as_deref(), None),
        );

        if matches!(status, "submitted" | "interview" | "placed")
            || (status == "rejected"
                && (rej.contains("\"client_screening\"")
                    || rej.contains("\"interview\"")
                    || submitted_ne))
        {
            bump(
                &mut sub_counts,
                &trend_day(submitted_at.as_deref(), date_added.as_deref(), None),
            );
        }

        if matches!(status, "interview" | "placed")
            || interview_ne
            || (status == "rejected" && rej.contains("\"interview\""))
        {
            let mut bumped_round = false;
            if let Some(raw) = int_status.as_deref() {
                if let Ok(serde_json::Value::Array(arr)) = serde_json::from_str::<serde_json::Value>(raw) {
                    for item in arr {
                        if let Some(sched) = item.get("scheduled_at").and_then(|v| v.as_str()) {
                            if !sched.trim().is_empty() {
                                bump(
                                    &mut int_counts,
                                    &trend_day(
                                        Some(sched),
                                        submitted_at.as_deref(),
                                        date_added.as_deref(),
                                    ),
                                );
                                bumped_round = true;
                            }
                        }
                    }
                }
            }

            if !bumped_round {
                bump(
                    &mut int_counts,
                    &trend_day(
                        interview_at.as_deref(),
                        submitted_at.as_deref(),
                        date_added.as_deref(),
                    ),
                );
            }
        }

        if status == "placed" {
            bump(
                &mut plac_counts,
                &trend_day(
                    placed_at.as_deref(),
                    interview_at.as_deref(),
                    date_added.as_deref(),
                ),
            );
        }
    }

    let now = chrono::Utc::now().date_naive();
    Ok((
        build_metric_trend(now, cand_counts),
        build_metric_trend(now, sub_counts),
        build_metric_trend(now, int_counts),
        build_metric_trend(now, plac_counts),
    ))
}

fn bump(counts: &mut HashMap<String, i64>, day: &str) {
    *counts.entry(day.to_string()).or_insert(0) += 1;
}

fn nonempty(v: Option<&str>) -> Option<&str> {
    v.map(str::trim).filter(|t| !t.is_empty())
}

/// Mirrors `substr(COALESCE(NULLIF(TRIM(a), ''), NULLIF(TRIM(b), ''), c), 1, 10)`.
fn trend_day<'a>(first: Option<&'a str>, second: Option<&'a str>, third: Option<&'a str>) -> String {
    let chosen = [first, second]
        .into_iter()
        .flatten()
        .map(str::trim)
        .find(|t| !t.is_empty())
        .or(third)
        .unwrap_or("");
    chosen.get(..10).unwrap_or(chosen).to_string()
}

fn build_metric_trend(now: chrono::NaiveDate, day_counts: HashMap<String, i64>) -> MetricTrend {
    use chrono::{Datelike, Duration};

    let current_day = now.day();

    // Strict Month-to-Date (MTD): Day 1 of current month up to Today
    let dates: Vec<chrono::NaiveDate> = (1..=current_day)
        .filter_map(|d| now.with_day(d))
        .collect();

    let weekday_from_mon = now.weekday().num_days_from_monday();
    let start_of_week = now - Duration::days(weekday_from_mon as i64);
    let start_of_week_str = start_of_week.format("%Y-%m-%d").to_string();

    let start_of_month = now.with_day(1).unwrap_or(now);
    let start_of_month_str = start_of_month.format("%Y-%m-%d").to_string();
    let today_str = now.format("%Y-%m-%d").to_string();

    let mut points = Vec::with_capacity(dates.len());
    for d in dates {
        let d_str = d.format("%Y-%m-%d").to_string();
        let label = d.format("%b %e").to_string();
        let count = day_counts.get(&d_str).copied().unwrap_or(0);
        points.push(crate::models::TrendPoint {
            date: d_str,
            label: label.trim().to_string(),
            count,
        });
    }

    let mut this_week = 0;
    let mut this_month = 0;
    for (day, count) in &day_counts {
        if day.as_str() >= start_of_week_str.as_str() && day.as_str() <= today_str.as_str() {
            this_week += count;
        }
        if day.as_str() >= start_of_month_str.as_str() && day.as_str() <= today_str.as_str() {
            this_month += count;
        }
    }

    MetricTrend {
        this_week,
        this_month,
        points,
    }
}
