use rusqlite::{params, Connection};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{ReminderInput, ReminderWithContext};
use crate::rows::{new_id, now, row_to_reminder_with_context};
use crate::AppState;

const SELECT_REMINDERS_WITH_CONTEXT: &str = r#"
SELECT
  r.id, r.title, r.description, r.category, r.due_date, r.due_time,
  r.timezone, r.remind_at, r.priority, r.notify_before_minutes,
  r.status, r.snoozed_until, r.candidate_id, r.job_id, r.client_id,
  r.meeting_link, r.created_at, r.updated_at,
  c.name as candidate_name,
  j.title as job_title,
  cl.name as client_name
FROM reminders r
LEFT JOIN candidates c ON r.candidate_id = c.id
LEFT JOIN jobs j ON r.job_id = j.id
LEFT JOIN clients cl ON r.client_id = cl.id
"#;

pub fn fetch_reminder(conn: &Connection, id: &str) -> AppResult<ReminderWithContext> {
    let sql = format!("{SELECT_REMINDERS_WITH_CONTEXT} WHERE r.id = ?1");
    conn.query_row(&sql, params![id], row_to_reminder_with_context)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::Msg(format!("Reminder not found: {id}")),
            other => other.into(),
        })
}

pub fn get_reminders_inner(
    conn: &Connection,
    status: Option<String>,
    category: Option<String>,
) -> AppResult<Vec<ReminderWithContext>> {
    let mut sql = format!("{SELECT_REMINDERS_WITH_CONTEXT} WHERE 1=1");
    let mut param_values: Vec<String> = Vec::new();

    if let Some(ref s) = status {
        if !s.is_empty() && s != "all" {
            sql.push_str(" AND r.status = ?");
            param_values.push(s.clone());
        }
    }

    if let Some(ref c) = category {
        if !c.is_empty() && c != "all" {
            sql.push_str(" AND r.category = ?");
            param_values.push(c.clone());
        }
    }

    sql.push_str(" ORDER BY r.remind_at ASC, r.created_at ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_slice: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|v| v as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt
        .query_map(params_slice.as_slice(), row_to_reminder_with_context)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

pub fn create_reminder_inner(
    conn: &Connection,
    input: ReminderInput,
) -> AppResult<ReminderWithContext> {
    let id = new_id();
    let ts = now();

    let category = input.category.unwrap_or_else(|| "reminder".to_string());
    let timezone = input.timezone.unwrap_or_else(|| "UTC".to_string());
    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let status = input.status.unwrap_or_else(|| "pending".to_string());
    let notify_before = input.notify_before_minutes.unwrap_or(0);
    let remind_at = input.remind_at.unwrap_or_else(|| {
        if let Some(ref time) = input.due_time {
            format!("{}T{}:00Z", input.due_date, time)
        } else {
            format!("{}T09:00:00Z", input.due_date)
        }
    });

    conn.execute(
        r#"
        INSERT INTO reminders (
          id, title, description, category, due_date, due_time,
          timezone, remind_at, priority, notify_before_minutes,
          status, snoozed_until, candidate_id, job_id, client_id,
          meeting_link, created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
        )
        "#,
        params![
            id,
            input.title.trim(),
            input.description.as_deref(),
            category,
            input.due_date.trim(),
            input.due_time.as_deref(),
            timezone,
            remind_at,
            priority,
            notify_before,
            status,
            input.snoozed_until.as_deref(),
            input.candidate_id.as_deref(),
            input.job_id.as_deref(),
            input.client_id.as_deref(),
            input.meeting_link.as_deref(),
            ts,
            ts
        ],
    )?;

    fetch_reminder(conn, &id)
}

pub fn update_reminder_inner(
    conn: &Connection,
    id: &str,
    input: ReminderInput,
) -> AppResult<ReminderWithContext> {
    let ts = now();

    let category = input.category.unwrap_or_else(|| "reminder".to_string());
    let timezone = input.timezone.unwrap_or_else(|| "UTC".to_string());
    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let status = input.status.unwrap_or_else(|| "pending".to_string());
    let notify_before = input.notify_before_minutes.unwrap_or(0);
    let remind_at = input.remind_at.unwrap_or_else(|| {
        if let Some(ref time) = input.due_time {
            format!("{}T{}:00Z", input.due_date, time)
        } else {
            format!("{}T09:00:00Z", input.due_date)
        }
    });

    let count = conn.execute(
        r#"
        UPDATE reminders SET
          title = ?1,
          description = ?2,
          category = ?3,
          due_date = ?4,
          due_time = ?5,
          timezone = ?6,
          remind_at = ?7,
          priority = ?8,
          notify_before_minutes = ?9,
          status = ?10,
          snoozed_until = ?11,
          candidate_id = ?12,
          job_id = ?13,
          client_id = ?14,
          meeting_link = ?15,
          updated_at = ?16
        WHERE id = ?17
        "#,
        params![
            input.title.trim(),
            input.description.as_deref(),
            category,
            input.due_date.trim(),
            input.due_time.as_deref(),
            timezone,
            remind_at,
            priority,
            notify_before,
            status,
            input.snoozed_until.as_deref(),
            input.candidate_id.as_deref(),
            input.job_id.as_deref(),
            input.client_id.as_deref(),
            input.meeting_link.as_deref(),
            ts,
            id
        ],
    )?;

    if count == 0 {
        return Err(AppError::Msg(format!("Reminder not found: {id}")));
    }

    fetch_reminder(conn, id)
}

pub fn delete_reminder_inner(conn: &Connection, id: &str) -> AppResult<()> {
    let count = conn.execute("DELETE FROM reminders WHERE id = ?1", [id])?;
    if count == 0 {
        return Err(AppError::Msg(format!("Reminder not found: {id}")));
    }
    Ok(())
}

pub fn toggle_reminder_completed_inner(
    conn: &Connection,
    id: &str,
) -> AppResult<ReminderWithContext> {
    let current_status: String = conn
        .query_row("SELECT status FROM reminders WHERE id = ?1", [id], |r| r.get(0))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::Msg(format!("Reminder not found: {id}")),
            other => other.into(),
        })?;

    let next_status = if current_status == "completed" {
        "pending"
    } else {
        "completed"
    };

    let ts = now();
    conn.execute(
        "UPDATE reminders SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![next_status, ts, id],
    )?;

    fetch_reminder(conn, id)
}

pub fn snooze_reminder_inner(
    conn: &Connection,
    id: &str,
    minutes: i64,
) -> AppResult<ReminderWithContext> {
    let now_utc = chrono::Utc::now();
    let snooze_until = (now_utc + chrono::Duration::minutes(minutes)).to_rfc3339();
    let ts = now();

    let count = conn.execute(
        "UPDATE reminders SET status = 'snoozed', snoozed_until = ?1, remind_at = ?1, updated_at = ?2 WHERE id = ?3",
        params![snooze_until, ts, id],
    )?;

    if count == 0 {
        return Err(AppError::Msg(format!("Reminder not found: {id}")));
    }

    fetch_reminder(conn, id)
}

#[tauri::command]
pub fn get_reminders(
    state: State<'_, AppState>,
    status: Option<String>,
    category: Option<String>,
) -> AppResult<Vec<ReminderWithContext>> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    get_reminders_inner(&conn, status, category)
}

#[tauri::command]
pub fn get_reminder(state: State<'_, AppState>, id: String) -> AppResult<ReminderWithContext> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    fetch_reminder(&conn, &id)
}

#[tauri::command]
pub fn create_reminder(
    state: State<'_, AppState>,
    input: ReminderInput,
) -> AppResult<ReminderWithContext> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    create_reminder_inner(&conn, input)
}

#[tauri::command]
pub fn update_reminder(
    state: State<'_, AppState>,
    id: String,
    input: ReminderInput,
) -> AppResult<ReminderWithContext> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    update_reminder_inner(&conn, &id, input)
}

#[tauri::command]
pub fn delete_reminder(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    delete_reminder_inner(&conn, &id)
}

#[tauri::command]
pub fn toggle_reminder_completed(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<ReminderWithContext> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    toggle_reminder_completed_inner(&conn, &id)
}

#[tauri::command]
pub fn snooze_reminder(
    state: State<'_, AppState>,
    id: String,
    minutes: i64,
) -> AppResult<ReminderWithContext> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    snooze_reminder_inner(&conn, &id, minutes)
}
