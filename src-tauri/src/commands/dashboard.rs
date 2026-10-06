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

    let (
        active_jobs,
        total_jobs,
        total_candidates,
        total_clients,
        candidates_needing_action,
        placed_candidates,
        on_hold_jobs,
        external_submissions,
        interview_candidates,
    ): (i64, i64, i64, i64, i64, i64, i64, i64, i64) = conn.query_row(
        r#"
        SELECT
          (SELECT COUNT(*) FROM jobs WHERE status = 'active'),
          (SELECT COUNT(*) FROM jobs),
          (SELECT COUNT(*) FROM candidates),
          (SELECT COUNT(*) FROM clients),
          (SELECT COUNT(*) FROM candidates WHERE submission_status IN ('in_touch','submitted','interview') AND candidate_status = 'active'),
          (SELECT COUNT(*) FROM candidates WHERE submission_status = 'placed'),
          (SELECT COUNT(*) FROM jobs WHERE status = 'on_hold'),
          (SELECT COUNT(*) FROM candidates 
           WHERE submission_status IN ('submitted', 'interview', 'placed')
              OR (submission_status = 'rejected' AND (
                  rejection_reason LIKE '%"client_screening"%' 
                  OR rejection_reason LIKE '%"interview"%'
                  OR (submitted_at IS NOT NULL AND TRIM(submitted_at) != '')
              ))),
          (SELECT COALESCE(SUM(
             CASE
               WHEN json_valid(c.interview_status) AND json_type(c.interview_status) = 'array' AND json_array_length(c.interview_status) > 0
               THEN json_array_length(c.interview_status)
               ELSE 1
             END
           ), 0) FROM candidates c
           WHERE c.submission_status IN ('interview', 'placed')
              OR (c.interview_at IS NOT NULL AND TRIM(c.interview_at) != '')
              OR (c.submission_status = 'rejected' AND c.rejection_reason LIKE '%"interview"%'))
        "#,
        [],
        |r| Ok((
            r.get(0)?,
            r.get(1)?,
            r.get(2)?,
            r.get(3)?,
            r.get(4)?,
            r.get(5)?,
            r.get(6)?,
            r.get(7)?,
            r.get(8)?,
        )),
    )?;

    let candidates_by_status = status_counts(&conn, StatusTarget::CandidatesBySubmissionStatus)?;
    let jobs_by_status = status_counts(&conn, StatusTarget::JobsByStatus)?;

    let (candidates_trend, submissions_trend, interviews_trend, placed_trend) =
        compute_all_trends(&conn)?;

    let recent_jobs: Vec<JobWithStats> = {
        let mut stmt = conn.prepare(&format!("{JOB_SELECT} WHERE j.status = 'active' ORDER BY j.updated_at DESC, j.created_at DESC LIMIT 8"))?;
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
    let cutoff = (chrono::Utc::now() - chrono::Duration::days(45))
        .format("%Y-%m-%d")
        .to_string();

    let mut stmt = conn.prepare(
        "SELECT date_added, last_updated, submitted_at, interview_at, placed_at,
                submission_status, rejection_reason, interview_status
         FROM candidates
         WHERE date_added >= ?1 OR last_updated >= ?1 OR submitted_at >= ?1 OR interview_at >= ?1 OR placed_at >= ?1",
    )?;

    let mut cand_counts: HashMap<String, i64> = HashMap::new();
    let mut sub_counts: HashMap<String, i64> = HashMap::new();
    let mut int_counts: HashMap<String, i64> = HashMap::new();
    let mut plac_counts: HashMap<String, i64> = HashMap::new();

    let rows = stmt.query_map(rusqlite::params![cutoff], |r| {
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
