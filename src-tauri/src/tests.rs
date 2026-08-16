#[cfg(test)]
mod tests {
    use rusqlite::params;

    use crate::database::{init_db, schema};
    use crate::rows::{new_id, now, row_to_candidate, row_to_client, row_to_job};

    fn test_conn() -> rusqlite::Connection {
        // Use the WAL/journal defaults; in-memory is fine for tests
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        schema::create_schema(&conn).unwrap();
        conn
    }

    #[test]
    fn schema_creates_tables() {
        let conn = test_conn();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('clients','jobs','candidates')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn client_crud_roundtrip() {
        let conn = test_conn();
        let id = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, company, email, phone, address, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![
                id, "Acme Corp", "Acme Corp Inc", "hiring@acme.com", "555", "NY", "note", ts
            ],
        )
        .unwrap();

        let client = conn
            .query_row(
                "SELECT id, name, company, email, phone, address, notes, created_at, updated_at FROM clients WHERE id = ?1",
                params![&id],
                row_to_client,
            )
            .unwrap();
        assert_eq!(client.name, "Acme Corp");
        assert_eq!(client.company.as_deref(), Some("Acme Corp Inc"));

        conn.execute("DELETE FROM clients WHERE id = ?1", params![&id]).unwrap();
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn job_json_fields_roundtrip() {
        let conn = test_conn();
        let cid = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, company, email, phone, address, notes, created_at, updated_at)
             VALUES (?1, 'Acme', NULL, NULL, NULL, NULL, NULL, ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();

        let jid = new_id();
        let bools = r#"[{"name":"Tight","query":"(Java AND Spring) AND Boston"},{"name":"Broad","query":"Java OR J2EE"}]"#;
        let questions = r#"["Q1","Q2","Q3"]"#;
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?7)",
            params![jid, cid, "REQ-1", "Java Dev", bools, questions, ts],
        )
        .unwrap();

        let job = conn
            .query_row(
                r#"SELECT id, client_id, job_id, title, location, work_model, contract_type, status,
                          refined_jd, boolean_strings, candidate_pitch, screening_questions, notes,
                          created_at, updated_at, closed_at
                   FROM jobs WHERE id = ?1"#,
                params![&jid],
                row_to_job,
            )
            .unwrap();

        assert_eq!(job.boolean_strings.len(), 2);
        assert_eq!(job.boolean_strings[0].name, "Tight");
        assert_eq!(job.boolean_strings[1].query, "Java OR J2EE");
        assert_eq!(job.screening_questions, vec!["Q1", "Q2", "Q3"]);
        assert_eq!(job.status, "active");
    }

    #[test]
    fn candidate_crud_roundtrip() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, company, email, phone, address, notes, created_at, updated_at)
             VALUES (?1, 'Acme', NULL, NULL, NULL, NULL, NULL, ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-1', 'Java Dev', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts],
        )
        .unwrap();

        let cand_id = new_id();
        conn.execute(
            "INSERT INTO candidates (id, job_id, name, email, submission_status, candidate_status, date_added, last_updated)
             VALUES (?1, ?2, 'Jane Doe', 'jane@x.com', 'interviewing', 'active', ?3, ?3)",
            params![cand_id, jid, ts],
        )
        .unwrap();

        let cand = conn
            .query_row(
                r#"SELECT id, job_id, name, email, phone, location, current_title, current_company,
                          experience_years, resume_path, recruiter_notes, match_score,
                          submission_status, interview_status, client_feedback, candidate_status,
                          date_added, last_updated
                   FROM candidates WHERE id = ?1"#,
                params![&cand_id],
                row_to_candidate,
            )
            .unwrap();

        assert_eq!(cand.name, "Jane Doe");
        assert_eq!(cand.submission_status, "interviewing");
        assert_eq!(cand.email.as_deref(), Some("jane@x.com"));

        // cascade delete on job delete
        conn.execute("DELETE FROM jobs WHERE id = ?1", params![&jid]).unwrap();
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn init_db_creates_file() {
        let dir = std::env::temp_dir().join(format!("rw_test_{}", new_id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("test.db");
        {
            let conn = init_db(&db_path).unwrap();
            let _ = conn.execute_batch("SELECT 1");
            assert!(db_path.exists());
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
