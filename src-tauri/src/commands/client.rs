use rusqlite::params;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{Client, ClientInput, ClientWithStats};
use crate::rows::{like_pattern, new_id, now, row_to_client, row_to_client_with_stats};
use crate::AppState;

pub const CLIENT_SELECT: &str = r#"
  SELECT c.id, c.name, c.company, c.email, c.hiring_manager, c.address, c.notes,
         c.created_at, c.updated_at, c.sort_order,
         (SELECT COUNT(*) FROM jobs j WHERE j.client_id = c.id),
         (SELECT COUNT(*) FROM candidates ca JOIN jobs j2 ON ca.job_id = j2.id WHERE j2.client_id = c.id)
  FROM clients c
"#;

#[tauri::command]
pub fn get_clients(
    state: State<'_, AppState>,
    search: Option<String>,
) -> AppResult<Vec<ClientWithStats>> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let sql = match &search {
        Some(_) => format!(
            "{CLIENT_SELECT} WHERE c.name LIKE ?1 ESCAPE '\\' OR COALESCE(c.company,'') LIKE ?1 ESCAPE '\\' OR COALESCE(c.email,'') LIKE ?1 ESCAPE '\\' ORDER BY c.sort_order, c.name"
        ),
        None => format!("{CLIENT_SELECT} ORDER BY c.sort_order, c.name"),
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = match search {
        Some(s) => stmt
            .query_map(params![like_pattern(s.trim())], |row| {
                row_to_client_with_stats(row)
            })?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?,
        None => stmt
            .query_map([], row_to_client_with_stats)?
            .collect::<Result<Vec<_>, rusqlite::Error>>()?,
    };
    Ok(rows)
}

#[tauri::command]
pub fn get_client(state: State<'_, AppState>, id: String) -> AppResult<ClientWithStats> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let sql = format!("{CLIENT_SELECT} WHERE c.id = ?1");
    conn.query_row(&sql, params![id], row_to_client_with_stats)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::Msg("Client not found".into()),
            other => other.into(),
        })
}

#[tauri::command]
pub fn create_client(state: State<'_, AppState>, input: ClientInput) -> AppResult<Client> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let id = new_id();
    let ts = now();
    conn.execute(
        "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9)",
        params![
            id,
            input.name,
            input.company,
            input.email,
            input.hiring_manager,
            input.address,
            input.notes,
            ts,
            conn.query_row("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM clients", [], |r| r.get::<_, i64>(0))?
        ],
    )?;
    let client = conn.query_row(
        "SELECT id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order FROM clients WHERE id = ?1",
        params![&id],
        row_to_client,
    )?;
    Ok(client)
}

#[tauri::command]
pub fn update_client(
    state: State<'_, AppState>,
    id: String,
    input: ClientInput,
) -> AppResult<Client> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let affected = conn.execute(
        "UPDATE clients SET name = ?1, company = ?2, email = ?3, hiring_manager = ?4, address = ?5, notes = ?6, updated_at = ?7 WHERE id = ?8",
        params![
            input.name,
            input.company,
            input.email,
            input.hiring_manager,
            input.address,
            input.notes,
            now(),
            id
        ],
    )?;
    if affected == 0 {
        return Err("Client not found".into());
    }
    let client = conn.query_row(
        "SELECT id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order FROM clients WHERE id = ?1",
        params![&id],
        row_to_client,
    )?;
    Ok(client)
}

#[tauri::command]
pub fn delete_client(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    conn.execute("DELETE FROM clients WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn move_client(state: State<'_, AppState>, id: String, direction: i64) -> AppResult<()> {
    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let mut ids: Vec<String> = conn
        .prepare("SELECT id FROM clients ORDER BY sort_order, name")?
        .query_map([], |r| r.get(0))?
        .collect::<Result<_, rusqlite::Error>>()?;
    let pos = ids
        .iter()
        .position(|x| *x == id)
        .ok_or_else(|| AppError::Msg("Client not found".into()))?;
    let target = pos as i64 + direction;
    if target < 0 || target >= ids.len() as i64 {
        return Ok(());
    }
    ids.swap(pos, target as usize);
    let tx = conn.transaction()?;
    for (i, cid) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE clients SET sort_order = ?1 WHERE id = ?2",
            params![i as i64, cid],
        )?;
    }
    tx.commit()?;
    Ok(())
}
