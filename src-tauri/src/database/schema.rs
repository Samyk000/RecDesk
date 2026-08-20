use rusqlite::Connection;

use crate::error::AppResult;

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  hiring_manager TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  work_model TEXT,
  contract_type TEXT,
  bill_rate TEXT,
  pay_rate TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  refined_jd TEXT,
  boolean_strings TEXT NOT NULL DEFAULT '[]',
  candidate_pitch TEXT,
  screening_questions TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  current_title TEXT,
  current_company TEXT,
  experience_years INTEGER,
  resume_path TEXT,
  linkedin_url TEXT,
  recruiter_notes TEXT,
  match_score INTEGER,
  submission_status TEXT NOT NULL DEFAULT 'sourced',
  interview_status TEXT,
  client_feedback TEXT,
  candidate_status TEXT NOT NULL DEFAULT 'active',
  submitted_at TEXT,
  interview_at TEXT,
  placed_at TEXT,
  rejection_reason TEXT,
  screening_answers TEXT NOT NULL DEFAULT '{}',
  submission_details TEXT NOT NULL DEFAULT '{}',
  date_added TEXT NOT NULL,
  last_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company);

CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs(title);
CREATE INDEX IF NOT EXISTS idx_jobs_updated ON jobs(updated_at);

CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(name);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(submission_status);
CREATE INDEX IF NOT EXISTS idx_candidates_updated ON candidates(last_updated);
"#;

pub fn create_schema(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(SCHEMA_SQL)?;
    migrate_clients(conn)?;
    migrate_jobs(conn)?;
    migrate_candidates(conn)?;
    Ok(())
}

// Idempotent migration: adds new columns to the clients table.
fn migrate_clients(conn: &Connection) -> AppResult<()> {
    let existing: Vec<String> = conn
        .prepare("PRAGMA table_info(clients)")?
        .query_map([], |row| row.get(1))?
        .collect::<Result<_, _>>()?;

    let additions = [
        ("hiring_manager", "TEXT"),
        ("sort_order", "INTEGER NOT NULL DEFAULT 0"),
    ];
    for (col, ty) in additions {
        if !existing.iter().any(|c| c == col) {
            conn.execute(&format!("ALTER TABLE clients ADD COLUMN {col} {ty}"), [])?;
        }
    }

    Ok(())
}

// Idempotent migration: adds new columns to the jobs table.
fn migrate_jobs(conn: &Connection) -> AppResult<()> {
    let existing: Vec<String> = conn
        .prepare("PRAGMA table_info(jobs)")?
        .query_map([], |row| row.get(1))?
        .collect::<Result<_, _>>()?;

    let additions = [
        ("sort_order", "INTEGER NOT NULL DEFAULT 0"),
        ("bill_rate", "TEXT"),
        ("pay_rate", "TEXT"),
    ];
    for (col, ty) in additions {
        if !existing.iter().any(|c| c == col) {
            conn.execute(&format!("ALTER TABLE jobs ADD COLUMN {col} {ty}"), [])?;
        }
    }

    Ok(())
}

// Idempotent migration: adds new columns and maps old status values.
fn migrate_candidates(conn: &Connection) -> AppResult<()> {
    let existing: Vec<String> = conn
        .prepare("PRAGMA table_info(candidates)")?
        .query_map([], |row| row.get(1))?
        .collect::<Result<_, _>>()?;

    let additions = [
        ("submitted_at", "TEXT"),
        ("interview_at", "TEXT"),
        ("placed_at", "TEXT"),
        ("rejection_reason", "TEXT"),
        ("linkedin_url", "TEXT"),
        ("screening_answers", "TEXT NOT NULL DEFAULT '{}'"),
        ("submission_details", "TEXT NOT NULL DEFAULT '{}'"),
    ];
    for (col, ty) in additions {
        if !existing.iter().any(|c| c == col) {
            conn.execute(&format!("ALTER TABLE candidates ADD COLUMN {col} {ty}"), [])?;
        }
    }

    conn.execute(
        "UPDATE candidates SET submission_status = 'sourced' WHERE submission_status = 'new'",
        [],
    )?;
    conn.execute(
        "UPDATE candidates SET submission_status = 'submitted' WHERE submission_status = 'interviewing'",
        [],
    )?;
    conn.execute(
        "UPDATE candidates SET submission_status = 'interview' WHERE submission_status = 'offer'",
        [],
    )?;
    conn.execute(
        "UPDATE candidates SET submission_status = 'sourced' WHERE submission_status = 'hired'",
        [],
    )?;

    Ok(())
}
