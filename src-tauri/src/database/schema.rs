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
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
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
  status_history TEXT NOT NULL DEFAULT '[]',
  interview_feedback TEXT NOT NULL DEFAULT '{}',
  date_added TEXT NOT NULL,
  last_updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(submission_status);
CREATE INDEX IF NOT EXISTS idx_candidates_updated ON candidates(last_updated);
CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_candidates_submitted_at ON candidates(submitted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_interview_at ON candidates(interview_at);
CREATE INDEX IF NOT EXISTS idx_candidates_placed_at ON candidates(placed_at);
CREATE INDEX IF NOT EXISTS idx_candidates_date_added ON candidates(date_added);
"#;

const CURRENT_SCHEMA_VERSION: i32 = 6;

pub fn create_schema(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(SCHEMA_SQL)?;

    // Clean up legacy tables & duplicate index artifacts from early prototype versions
    conn.execute_batch(
        r#"
        DROP TABLE IF EXISTS reminders;
        DROP TABLE IF EXISTS candidate_resume_chunks;
        DROP INDEX IF EXISTS idx_jobs_client;
        DROP INDEX IF EXISTS idx_candidates_job;
        "#,
    )?;

    let user_version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if user_version < CURRENT_SCHEMA_VERSION {
        migrate_clients(conn)?;
        migrate_jobs(conn)?;
        migrate_candidates(conn)?;
        migrate_json_integrity(conn)?;
        migrate_candidates_nullable_job(conn)?;
        conn.pragma_update(None, "user_version", CURRENT_SCHEMA_VERSION)?;
    }

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
        ("status_history", "TEXT NOT NULL DEFAULT '[]'"),
        ("interview_feedback", "TEXT NOT NULL DEFAULT '{}'"),
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
        "UPDATE candidates SET submission_status = 'placed' WHERE submission_status = 'hired'",
        [],
    )?;
    conn.execute(
        "UPDATE candidates SET client_feedback = NULL WHERE client_feedback IN ('internal', 'client')",
        [],
    )?;

    Ok(())
}

// Idempotent migration (v5): sanitizes JSON text columns and installs validation triggers.
fn migrate_json_integrity(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        r#"
        UPDATE candidates
        SET submission_details = '{}'
        WHERE submission_details IS NULL OR TRIM(submission_details) = '' OR NOT json_valid(submission_details);

        UPDATE candidates
        SET screening_answers = '{}'
        WHERE screening_answers IS NULL OR TRIM(screening_answers) = '' OR NOT json_valid(screening_answers);

        UPDATE candidates
        SET interview_feedback = '{}'
        WHERE interview_feedback IS NULL OR TRIM(interview_feedback) = '' OR NOT json_valid(interview_feedback);

        UPDATE candidates
        SET status_history = '[]'
        WHERE status_history IS NULL OR TRIM(status_history) = '' OR NOT json_valid(status_history);

        UPDATE jobs
        SET boolean_strings = '[]'
        WHERE boolean_strings IS NULL OR TRIM(boolean_strings) = '' OR NOT json_valid(boolean_strings);

        UPDATE jobs
        SET screening_questions = '[]'
        WHERE screening_questions IS NULL OR TRIM(screening_questions) = '' OR NOT json_valid(screening_questions);
        "#,
    )?;

    conn.execute_batch(
        r#"
        CREATE TRIGGER IF NOT EXISTS trg_candidates_json_insert
        BEFORE INSERT ON candidates
        FOR EACH ROW
        BEGIN
            SELECT CASE
                WHEN (NEW.submission_details IS NOT NULL AND NOT json_valid(NEW.submission_details))
                  OR (NEW.screening_answers IS NOT NULL AND NOT json_valid(NEW.screening_answers))
                  OR (NEW.interview_feedback IS NOT NULL AND NOT json_valid(NEW.interview_feedback))
                  OR (NEW.status_history IS NOT NULL AND NOT json_valid(NEW.status_history))
                THEN RAISE(ABORT, 'Invalid JSON payload for candidate metadata')
            END;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_candidates_json_update
        BEFORE UPDATE ON candidates
        FOR EACH ROW
        BEGIN
            SELECT CASE
                WHEN (NEW.submission_details IS NOT NULL AND NOT json_valid(NEW.submission_details))
                  OR (NEW.screening_answers IS NOT NULL AND NOT json_valid(NEW.screening_answers))
                  OR (NEW.interview_feedback IS NOT NULL AND NOT json_valid(NEW.interview_feedback))
                  OR (NEW.status_history IS NOT NULL AND NOT json_valid(NEW.status_history))
                THEN RAISE(ABORT, 'Invalid JSON payload for candidate metadata')
            END;
        END;
        "#,
    )?;

    Ok(())
}

// Idempotent migration (v6): relaxes candidates.job_id to allow NULL with ON DELETE SET NULL.
fn migrate_candidates_nullable_job(conn: &Connection) -> AppResult<()> {
    let is_not_null: bool = conn
        .prepare("PRAGMA table_info(candidates)")?
        .query_map([], |row| {
            let col_name: String = row.get(1)?;
            let not_null: i32 = row.get(3)?;
            Ok((col_name, not_null))
        })?
        .filter_map(|r| r.ok())
        .any(|(name, not_null)| name == "job_id" && not_null == 1);

    if !is_not_null {
        return Ok(());
    }

    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = OFF;

        CREATE TABLE candidates_v6_tmp (
            id TEXT PRIMARY KEY,
            job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
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
            status_history TEXT NOT NULL DEFAULT '[]',
            interview_feedback TEXT NOT NULL DEFAULT '{}',
            date_added TEXT NOT NULL,
            last_updated TEXT NOT NULL
        );

        INSERT INTO candidates_v6_tmp SELECT
            id, job_id, name, email, phone, location, current_title,
            current_company, experience_years, resume_path, linkedin_url,
            recruiter_notes, match_score, submission_status, interview_status,
            client_feedback, candidate_status, submitted_at, interview_at,
            placed_at, rejection_reason, screening_answers, submission_details,
            status_history, interview_feedback, date_added, last_updated
        FROM candidates;

        DROP TABLE candidates;

        ALTER TABLE candidates_v6_tmp RENAME TO candidates;

        CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(submission_status);
        CREATE INDEX IF NOT EXISTS idx_candidates_updated ON candidates(last_updated);
        CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id);
        CREATE INDEX IF NOT EXISTS idx_candidates_submitted_at ON candidates(submitted_at);
        CREATE INDEX IF NOT EXISTS idx_candidates_interview_at ON candidates(interview_at);
        CREATE INDEX IF NOT EXISTS idx_candidates_placed_at ON candidates(placed_at);
        CREATE INDEX IF NOT EXISTS idx_candidates_date_added ON candidates(date_added);

        PRAGMA foreign_keys = ON;
        "#,
    )?;

    // Re-install the JSON integrity triggers on candidates table
    migrate_json_integrity(conn)?;

    Ok(())
}
