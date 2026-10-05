pub mod schema;

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppResult;

fn perform_rolling_backup(conn: &Connection, db_path: &Path) {
    let parent = match db_path.parent() {
        Some(p) if !p.as_os_str().is_empty() => p,
        _ => return,
    };
    let backup_dir = parent.join("backups");
    if std::fs::create_dir_all(&backup_dir).is_err() {
        return;
    }

    let today = chrono::Utc::now().format("%Y%m%d").to_string();
    let backup_dest = backup_dir.join(format!("workspace_backup_{today}.db"));

    match Connection::open(&backup_dest) {
        Ok(mut dst_conn) => {
            match rusqlite::backup::Backup::new(conn, &mut dst_conn) {
                Ok(backup) => {
                    if let Err(e) =
                        backup.run_to_completion(100, std::time::Duration::from_millis(50), None)
                    {
                        eprintln!("recdesk: online rolling backup failed: {e}");
                    }
                }
                Err(e) => eprintln!("recdesk: backup initialization failed: {e}"),
            }
        }
        Err(e) => eprintln!("recdesk: backup destination open failed: {e}"),
    }

    // Retain only the last 5 backup snapshots
    if let Ok(entries) = std::fs::read_dir(&backup_dir) {
        let mut backups: Vec<std::path::PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.is_file()
                    && p.file_name()
                        .and_then(|n| n.to_str())
                        .map(|s| s.starts_with("workspace_backup_") && s.ends_with(".db"))
                        .unwrap_or(false)
            })
            .collect();

        backups.sort();
        if backups.len() > 5 {
            let excess = backups.len() - 5;
            for p in backups.iter().take(excess) {
                let _ = std::fs::remove_file(p);
            }
        }
    }
}

pub fn init_db(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    conn.pragma_update(None, "cache_size", "-4000")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "busy_timeout", "5000")?;
    schema::create_schema(&conn)?;
    perform_rolling_backup(&conn, path);
    Ok(conn)
}

