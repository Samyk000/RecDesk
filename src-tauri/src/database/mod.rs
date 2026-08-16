pub mod schema;

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppResult;

pub fn init_db(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "busy_timeout", "5000")?;
    schema::create_schema(&conn)?;
    Ok(conn)
}
