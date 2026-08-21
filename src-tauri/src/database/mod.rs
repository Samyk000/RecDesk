pub mod schema;

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppResult;

fn perform_rolling_backup(db_path: &Path) {
    if !db_path.exists() {
        return;
    }
    if let Ok(metadata) = std::fs::metadata(db_path) {
        if metadata.len() == 0 {
            return;
        }
    } else {
        return;
    }

    let parent = match db_path.parent() {
        Some(p) => p,
        None => return,
    };
    let backup_dir = parent.join("backups");
    if std::fs::create_dir_all(&backup_dir).is_err() {
        return;
    }

    let today = chrono::Utc::now().format("%Y%m%d").to_string();
    let backup_dest = backup_dir.join(format!("workspace_backup_{today}.db"));

    let _ = std::fs::copy(db_path, &backup_dest);

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
    perform_rolling_backup(path);
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "busy_timeout", "5000")?;
    schema::create_schema(&conn)?;
    Ok(conn)
}

