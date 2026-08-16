use rusqlite::Connection;

use crate::error::AppResult;

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  work_model TEXT,
  contract_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  refined_jd TEXT,
  boolean_strings TEXT NOT NULL DEFAULT '[]',
  candidate_pitch TEXT,
  screening_questions TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
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
  recruiter_notes TEXT,
  match_score INTEGER,
  submission_status TEXT NOT NULL DEFAULT 'new',
  interview_status TEXT,
  client_feedback TEXT,
  candidate_status TEXT NOT NULL DEFAULT 'active',
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
    Ok(())
}
