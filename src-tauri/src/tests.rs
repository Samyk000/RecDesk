#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use rusqlite::params;

    use crate::commands::candidate::{bulk_update_candidates_sql, CandidatePatch};
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
    fn sort_order_controls_list_order() {
        let conn = test_conn();
        let ts = now();
        for (name, order) in [("Zebra", 0), ("Alpha", 1), ("Mid", 2)] {
            let id = new_id();
            conn.execute(
                "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order)
                 VALUES (?1, ?2, NULL, NULL, NULL, NULL, NULL, ?3, ?3, ?4)",
                params![id, name, ts, order],
            )
            .unwrap();
        }
        let names: Vec<String> = conn
            .prepare("SELECT name FROM clients ORDER BY sort_order, name")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(names, vec!["Zebra", "Alpha", "Mid"]);

        conn.execute("UPDATE clients SET sort_order = 1 WHERE name = 'Zebra'", [])
            .unwrap();
        conn.execute("UPDATE clients SET sort_order = 0 WHERE name = 'Alpha'", [])
            .unwrap();
        let names: Vec<String> = conn
            .prepare("SELECT name FROM clients ORDER BY sort_order, name")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(names, vec!["Alpha", "Zebra", "Mid"]);
    }

    #[test]
    fn client_crud_roundtrip() {
        let conn = test_conn();
        let id = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![
                id, "Acme Corp", "Acme Corp Inc", "hiring@acme.com", "Jane Doe", "NY", "note", ts
            ],
        )
        .unwrap();

        let client = conn
            .query_row(
                "SELECT id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order FROM clients WHERE id = ?1",
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
            "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at)
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
                          created_at, updated_at, closed_at, sort_order, bill_rate, pay_rate
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
            "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at)
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
                          submitted_at, interview_at, rejection_reason,
                          date_added, last_updated, linkedin_url, screening_answers, submission_details
                   FROM candidates WHERE id = ?1"#,
                params![&cand_id],
                row_to_candidate,
            )
            .unwrap();

        assert_eq!(cand.name, "Jane Doe");
        assert_eq!(cand.submission_status, "interviewing");
        assert_eq!(cand.email.as_deref(), Some("jane@x.com"));
        assert_eq!(cand.submitted_at, None);
        assert_eq!(cand.interview_at, None);
        assert_eq!(cand.rejection_reason, None);

        // cascade delete on job delete
        conn.execute("DELETE FROM jobs WHERE id = ?1", params![&jid]).unwrap();
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn bulk_status_change_preserves_timestamps() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let cand_id = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at)
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
        conn.execute(
            "INSERT INTO candidates (id, job_id, name, email, submission_status, candidate_status,
                submitted_at, interview_at, rejection_reason, date_added, last_updated)
             VALUES (?1, ?2, 'Jane Doe', 'jane@x.com', 'submitted', 'active', ?3, ?4, 'no feedback', ?3, ?3)",
            params![cand_id, jid, ts, "2026-08-01T10:00:00Z"],
        )
        .unwrap();

        // Moving to 'in_touch' (a non-timestamped status) must NOT wipe timestamps
        let patch = CandidatePatch {
            submission_status: Some("in_touch".to_string()),
            ..Default::default()
        };
        bulk_update_candidates_sql(&conn, std::slice::from_ref(&cand_id), &patch).unwrap();

        let row = conn
            .query_row(
                "SELECT submission_status, submitted_at, interview_at, rejection_reason FROM candidates WHERE id = ?1",
                params![&cand_id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, Option<String>>(1)?,
                        r.get::<_, Option<String>>(2)?,
                        r.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(row.0, "in_touch");
        assert_eq!(row.1.as_deref(), Some(ts.as_str()));
        assert_eq!(row.2.as_deref(), Some("2026-08-01T10:00:00Z"));
        assert_eq!(row.3.as_deref(), Some("no feedback"));

        // Moving to 'submitted' sets submitted_at when provided
        let patch = CandidatePatch {
            submission_status: Some("submitted".to_string()),
            submitted_at: Some("2026-08-10T09:00:00Z".to_string()),
            ..Default::default()
        };
        bulk_update_candidates_sql(&conn, std::slice::from_ref(&cand_id), &patch).unwrap();
        let submitted_at: String = conn
            .query_row(
                "SELECT submitted_at FROM candidates WHERE id = ?1",
                params![&cand_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(submitted_at, "2026-08-10T09:00:00Z");

        // Moving to 'placed' sets placed_at when provided
        let patch = CandidatePatch {
            submission_status: Some("placed".to_string()),
            placed_at: Some("2026-08-20".to_string()),
            ..Default::default()
        };
        bulk_update_candidates_sql(&conn, std::slice::from_ref(&cand_id), &patch).unwrap();
        let (status, placed_at): (String, Option<String>) = conn
            .query_row(
                "SELECT submission_status, placed_at FROM candidates WHERE id = ?1",
                params![&cand_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(status, "placed");
        assert_eq!(placed_at.as_deref(), Some("2026-08-20"));
    }

    #[test]
    fn bulk_delete_candidates() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at)
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

        let mut ids = Vec::new();
        for name in ["Alice", "Bob", "Carol"] {
            let cand_id = new_id();
            conn.execute(
                "INSERT INTO candidates (id, job_id, name, submission_status, candidate_status, date_added, last_updated)
                 VALUES (?1, ?2, ?3, 'sourced', 'active', ?4, ?4)",
                params![cand_id, jid, name, ts],
            )
            .unwrap();
            ids.push(cand_id);
        }

        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        let affected = conn
            .execute(
                &format!("DELETE FROM candidates WHERE id IN ({})", placeholders.join(",")),
                rusqlite::params_from_iter(ids.iter()),
            )
            .unwrap();
        assert_eq!(affected, 3);

        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn export_import_roundtrip_preserves_sort_order_and_updated_at() {
        let mut conn = test_conn();
        let ts = now();
        let cid = new_id();
        conn.execute(
            "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order)
             VALUES (?1, 'Acme', NULL, NULL, NULL, NULL, NULL, ?2, ?2, 3)",
            params![cid, ts],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at, sort_order)
             VALUES (?1, ?2, 'REQ-9', 'Java Dev', 'active', '[]', '[]', ?3, '2026-01-02T03:04:05Z', 7)",
            params![new_id(), cid, ts],
        )
        .unwrap();

        let json = crate::commands::data::export_json(&conn).unwrap();

        conn.execute("DELETE FROM candidates", []).unwrap();
        conn.execute("DELETE FROM jobs", []).unwrap();
        conn.execute("DELETE FROM clients", []).unwrap();

        let summary = crate::commands::data::import_json(&mut conn, &json, false).unwrap();
        assert_eq!(summary.clients, 1);
        assert_eq!(summary.jobs, 1);

        let sort_order: i64 = conn
            .query_row("SELECT sort_order FROM clients", [], |r| r.get(0))
            .unwrap();
        assert_eq!(sort_order, 3);
        let (job_sort, updated_at): (i64, String) = conn
            .query_row("SELECT sort_order, updated_at FROM jobs", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(job_sort, 7);
        assert_eq!(updated_at, "2026-01-02T03:04:05Z");
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

    #[test]
    fn candidate_update_preserves_screening_answers_and_submission_details() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let cand_id = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-1', 'Engineer', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO candidates (id, job_id, name, email, phone, location, submission_status, candidate_status,
                                     screening_answers, submission_details, date_added, last_updated)
             VALUES (?1, ?2, 'Alice Smith', 'alice@test.com', '123-456-7890', 'NYC', 'sourced', 'active',
                     '{\"0\":\"5 years\"}', '[{\"key\":\"rate\",\"label\":\"Rate\",\"value\":\"$80/hr\"}]', ?3, ?3)",
            params![cand_id, jid, ts],
        )
        .unwrap();

        // Perform partial update with phone change and None for screening_answers / submission_details
        conn.execute(
            "UPDATE candidates SET job_id = COALESCE(NULLIF(?1, ''), job_id),
                                   name = COALESCE(NULLIF(?2, ''), name),
                                   email = ?3,
                                   phone = ?4,
                                   location = ?5,
                                   current_title = ?6,
                                   current_company = ?7,
                                   experience_years = ?8,
                                   resume_path = ?9,
                                   recruiter_notes = ?10,
                                   match_score = ?11,
                                   submission_status = COALESCE(?12, submission_status),
                                   interview_status = ?13,
                                   client_feedback = ?14,
                                   candidate_status = COALESCE(?15, candidate_status),
                                   submitted_at = ?16,
                                   interview_at = ?17,
                                   rejection_reason = ?18,
                                   linkedin_url = ?19,
                                   screening_answers = COALESCE(?20, screening_answers),
                                   submission_details = COALESCE(?21, submission_details),
                                   last_updated = ?22
             WHERE id = ?23",
            params![
                jid,
                "Alice Smith",
                Some("alice@test.com"),
                Some("999-888-7777"),
                Some("NYC"),
                None::<String>,
                None::<String>,
                None::<i64>,
                None::<String>,
                None::<String>,
                None::<i64>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                now(),
                cand_id
            ],
        )
        .unwrap();

        let cand = conn
            .query_row(
                r#"SELECT id, job_id, name, email, phone, location, current_title, current_company,
                          experience_years, resume_path, recruiter_notes, match_score,
                          submission_status, interview_status, client_feedback, candidate_status,
                          submitted_at, interview_at, rejection_reason,
                          date_added, last_updated, linkedin_url, screening_answers, submission_details
                   FROM candidates WHERE id = ?1"#,
                params![&cand_id],
                row_to_candidate,
            )
            .unwrap();

        assert_eq!(cand.phone.as_deref(), Some("999-888-7777"));
        assert_eq!(cand.screening_answers.as_deref(), Some("{\"0\":\"5 years\"}"));
        assert_eq!(
            cand.submission_details.as_deref(),
            Some("[{\"key\":\"rate\",\"label\":\"Rate\",\"value\":\"$80/hr\"}]")
        );
    }

    #[test]
    fn export_import_placed_roundtrip() {
        use crate::commands::data::{export_json, import_json};

        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let cand_id = new_id();
        let ts = now();

        conn.execute(
            "INSERT INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order)
             VALUES (?1, 'TechCorp', NULL, NULL, NULL, NULL, NULL, ?2, ?2, 0)",
            params![cid, ts],
        ).unwrap();

        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, location, work_model, contract_type, bill_rate, pay_rate, status, refined_jd, boolean_strings, candidate_pitch, screening_questions, notes, created_at, updated_at, closed_at, sort_order)
             VALUES (?1, ?2, 'JOB-1', 'Engineer', NULL, NULL, NULL, NULL, NULL, 'active', NULL, '[]', NULL, '[]', NULL, ?3, ?3, NULL, 0)",
            params![jid, cid, ts],
        ).unwrap();

        conn.execute(
            "INSERT INTO candidates (id, job_id, name, email, phone, location, current_title, current_company, experience_years, resume_path, recruiter_notes, match_score, submission_status, interview_status, client_feedback, candidate_status, submitted_at, interview_at, rejection_reason, date_added, last_updated, linkedin_url, screening_answers, submission_details, placed_at)
             VALUES (?1, ?2, 'Placed Candidate', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'placed', NULL, NULL, 'active', NULL, NULL, NULL, ?3, ?3, NULL, '{}', '{}', '2026-08-20')",
            params![cand_id, jid, ts],
        ).unwrap();

        let json = export_json(&conn).unwrap();

        let mut conn2 = test_conn();
        let summary = import_json(&mut conn2, &json, true).unwrap();
        assert_eq!(summary.clients, 1);
        assert_eq!(summary.jobs, 1);
        assert_eq!(summary.candidates, 1);

        let placed_at: Option<String> = conn2
            .query_row(
                "SELECT placed_at FROM candidates WHERE id = ?1",
                params![&cand_id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(placed_at.as_deref(), Some("2026-08-20"));
    }
}

