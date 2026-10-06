#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use rusqlite::params;

    use crate::commands::candidate::{
        bulk_update_candidates_sql, update_candidate_in, CandidatePatch,
    };
    use crate::commands::job::update_job_in;
    use crate::models::{CandidateInput, JobInput};
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
                &format!("{} WHERE c.id = ?1", crate::commands::candidate::CANDIDATE_SELECT),
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

        // job deletion preserves candidate with job_id set to NULL
        conn.execute("DELETE FROM jobs WHERE id = ?1", params![&jid]).unwrap();
        let (remaining, orphaned_job_id): (i64, Option<String>) = conn
            .query_row("SELECT COUNT(*), job_id FROM candidates WHERE id = ?1", params![&cand_id], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap();
        assert_eq!(remaining, 1);
        assert_eq!(orphaned_job_id, None);
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
                                     screening_answers, submission_details, submitted_at, interview_at, placed_at, date_added, last_updated)
             VALUES (?1, ?2, 'Alice Smith', 'alice@test.com', '123-456-7890', 'NYC', 'placed', 'active',
                     '{\"0\":\"5 years\"}', '[{\"key\":\"rate\",\"label\":\"Rate\",\"value\":\"$80/hr\"}]',
                     '2026-09-01', '2026-09-05', '2026-09-20', ?3, ?3)",
            params![cand_id, jid, ts],
        )
        .unwrap();

        // Partial payload: milestone keys absent, phone changed.
        let partial: CandidateInput = serde_json::from_str(&format!(
            r#"{{"job_id":"{jid}","name":"Alice Smith","email":"alice@test.com","phone":"999-888-7777","location":"NYC"}}"#
        ))
        .unwrap();
        let cand = update_candidate_in(&conn, &cand_id, &partial).unwrap();

        assert_eq!(cand.phone.as_deref(), Some("999-888-7777"));
        assert_eq!(
            cand.screening_answers.as_deref(),
            Some("{\"0\":\"5 years\"}")
        );
        assert_eq!(
            cand.submission_details.as_deref(),
            Some("[{\"key\":\"rate\",\"label\":\"Rate\",\"value\":\"$80/hr\"}]")
        );
        // Omitting a milestone key must not wipe the stored history.
        assert_eq!(cand.submitted_at.as_deref(), Some("2026-09-01"));
        assert_eq!(cand.interview_at.as_deref(), Some("2026-09-05"));
        assert_eq!(cand.placed_at.as_deref(), Some("2026-09-20"));

        // Explicit null clears that milestone only.
        let clearing: CandidateInput = serde_json::from_str(&format!(
            r#"{{"job_id":"{jid}","name":"Alice Smith","submitted_at":null}}"#
        ))
        .unwrap();
        let cand = update_candidate_in(&conn, &cand_id, &clearing).unwrap();
        assert_eq!(cand.submitted_at, None);
        assert_eq!(cand.interview_at.as_deref(), Some("2026-09-05"));
        assert_eq!(cand.placed_at.as_deref(), Some("2026-09-20"));

        // An explicit value sets it.
        let setting: CandidateInput = serde_json::from_str(&format!(
            r#"{{"job_id":"{jid}","name":"Alice Smith","submitted_at":"2026-10-01"}}"#
        ))
        .unwrap();
        let cand = update_candidate_in(&conn, &cand_id, &setting).unwrap();
        assert_eq!(cand.submitted_at.as_deref(), Some("2026-10-01"));
    }

    #[test]
    fn job_sparse_update_preserves_untouched_columns() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, location, status, refined_jd, boolean_strings, screening_questions, notes, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-1', 'Engineer', 'NYC', 'active', 'JD text',
                     '[{\"name\":\"java\",\"query\":\"java\"}]', '[\"q1\"]', 'orig notes', ?3, ?3)",
            params![jid, cid, ts],
        )
        .unwrap();

        // Notes-only payload: every other column must survive.
        let patch: JobInput = serde_json::from_str(r#"{"notes":"updated"}"#).unwrap();
        let job = update_job_in(&conn, &jid, &patch).unwrap();
        assert_eq!(job.job.notes.as_deref(), Some("updated"));
        assert_eq!(job.job.title, "Engineer");
        assert_eq!(job.job.location.as_deref(), Some("NYC"));
        assert_eq!(job.job.status, "active");
        assert_eq!(job.job.refined_jd.as_deref(), Some("JD text"));
        assert_eq!(job.job.boolean_strings.len(), 1);
        assert_eq!(job.job.screening_questions.len(), 1);

        // Closing stamps closed_at and leaves everything else alone;
        // reopening clears it again.
        let close: JobInput = serde_json::from_str(r#"{"status":"closed"}"#).unwrap();
        let job = update_job_in(&conn, &jid, &close).unwrap();
        assert_eq!(job.job.status, "closed");
        assert!(job.job.closed_at.is_some());
        assert_eq!(job.job.notes.as_deref(), Some("updated"));

        let reopen: JobInput = serde_json::from_str(r#"{"status":"active"}"#).unwrap();
        let job = update_job_in(&conn, &jid, &reopen).unwrap();
        assert_eq!(job.job.status, "active");
        assert_eq!(job.job.closed_at, None);
    }

    #[test]
    fn candidate_list_projection_omits_blobs_but_keeps_scalars() {
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
            "INSERT INTO candidates (id, job_id, name, screening_answers, submission_details,
                                     status_history, interview_feedback, placed_at, date_added, last_updated)
             VALUES (?1, ?2, 'Alice Smith', '{\"0\":\"5 years\"}', '[{\"key\":\"rate\"}]',
                     '[{\"from\":\"sourced\"}]', '{\"rounds\":[]}', '2026-09-20', ?3, ?3)",
            params![cand_id, jid, ts],
        )
        .unwrap();

        let cand = conn
            .query_row(
                &format!(
                    "{} WHERE c.id = ?1",
                    crate::commands::candidate::CANDIDATE_SELECT_SLIM
                ),
                params![&cand_id],
                row_to_candidate,
            )
            .unwrap();

        // Scalars survive the slim projection, the heavy blobs come back empty.
        assert_eq!(cand.name, "Alice Smith");
        assert_eq!(cand.placed_at.as_deref(), Some("2026-09-20"));
        assert_eq!(cand.screening_answers, None);
        assert_eq!(cand.submission_details, None);
        assert_eq!(cand.status_history, None);
        assert_eq!(cand.interview_feedback, None);
    }

    #[test]
    fn dashboard_trends_match_legacy_substr_sql() {
        use chrono::{Datelike, Duration, Utc};

        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
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

        let seed = |id: &str,
                    status: &str,
                    date_added: &str,
                    updated: &str,
                    submitted: &str,
                    interview: &str,
                    placed: &str,
                    rej: &str| {
            conn.execute(
                "INSERT INTO candidates (id, job_id, name, submission_status, date_added, last_updated,
                                         submitted_at, interview_at, placed_at, rejection_reason)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![id, jid, id, status, date_added, updated, submitted, interview, placed, rej],
            )
            .unwrap();
        };

        seed("c1", "submitted", &ts, &ts, &ts, "", "", "");
        seed("c2", "interview", &ts, &ts, &ts, &ts, "", "");
        seed("c3", "placed", &ts, &ts, &ts, &ts, &ts, "");
        seed("c4", "rejected", &ts, &ts, &ts, &ts, "", r#"{"origin":"interview"}"#);
        seed("c5", "rejected", &ts, &ts, &ts, "", "", r#"{"origin":"client_screening"}"#);
        seed("c6", "sourced", &ts, &ts, "", "", "", "");
        // empty date_added must fall back to last_updated
        seed("c7", "pipeline", "", &ts, "", "", "", "");

        let today = Utc::now().date_naive();
        let today_str = today.format("%Y-%m-%d").to_string();
        let start_of_week_str = (today - Duration::days(today.weekday().num_days_from_monday() as i64))
            .format("%Y-%m-%d")
            .to_string();
        let start_of_month_str = today.with_day(1).unwrap().format("%Y-%m-%d").to_string();

        // The exact substr() SQL this code replaced, kept here as the oracle.
        let legacy_sum = |date_expr: &str, where_clause: &str, earliest: &str| -> i64 {
            let sql = format!(
                "SELECT COALESCE(SUM(cnt), 0) FROM (
                    SELECT substr({date_expr}, 1, 10) AS day, COUNT(*) AS cnt
                    FROM candidates
                    WHERE ({where_clause}) AND substr({date_expr}, 1, 10) >= ?1 AND substr({date_expr}, 1, 10) <= ?2
                    GROUP BY day)"
            );
            conn.query_row(&sql, params![earliest, today_str], |r| r.get(0)).unwrap()
        };

        let candidates_expr = "COALESCE(NULLIF(TRIM(date_added), ''), last_updated)";
        let submissions_expr = "COALESCE(NULLIF(TRIM(submitted_at), ''), date_added)";
        let interviews_expr =
            "COALESCE(NULLIF(TRIM(interview_at), ''), NULLIF(TRIM(submitted_at), ''), date_added)";
        let placed_expr =
            "COALESCE(NULLIF(TRIM(placed_at), ''), NULLIF(TRIM(interview_at), ''), date_added)";

        let submissions_where = r#"submission_status IN ('submitted', 'interview', 'placed')
             OR (submission_status = 'rejected' AND (
                 rejection_reason LIKE '%"client_screening"%'
                 OR rejection_reason LIKE '%"interview"%'
                 OR (submitted_at IS NOT NULL AND TRIM(submitted_at) != '')
             ))"#;
        let interviews_where = r#"submission_status IN ('interview', 'placed')
             OR (interview_at IS NOT NULL AND TRIM(interview_at) != '')
             OR (submission_status = 'rejected' AND (
                 rejection_reason LIKE '%"interview"%'
                 OR (interview_at IS NOT NULL AND TRIM(interview_at) != '')
             ))"#;
        let placed_where = "submission_status = 'placed'";

        let (cand, subs, ints, placed) =
            crate::commands::dashboard::compute_all_trends(&conn).unwrap();

        assert_eq!(cand.this_month, legacy_sum(candidates_expr, "1=1", &start_of_month_str));
        assert_eq!(cand.this_week, legacy_sum(candidates_expr, "1=1", &start_of_week_str));
        assert_eq!(subs.this_month, legacy_sum(submissions_expr, submissions_where, &start_of_month_str));
        assert_eq!(subs.this_week, legacy_sum(submissions_expr, submissions_where, &start_of_week_str));
        assert_eq!(ints.this_month, legacy_sum(interviews_expr, interviews_where, &start_of_month_str));
        assert_eq!(ints.this_week, legacy_sum(interviews_expr, interviews_where, &start_of_week_str));
        assert_eq!(placed.this_month, legacy_sum(placed_expr, placed_where, &start_of_month_str));
        assert_eq!(placed.this_week, legacy_sum(placed_expr, placed_where, &start_of_week_str));

        // Guard against a trivially green comparison (empty table vs empty table).
        assert_eq!(cand.this_month, 7);
        assert!(subs.this_month > 0 && ints.this_month > 0 && placed.this_month > 0);
    }

    #[test]
    fn placed_candidate_export_import_roundtrip() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let cand_id = new_id();
        let ts = now();

        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts],
        ).unwrap();

        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-1', 'Engineer', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts],
        ).unwrap();

        conn.execute(
            "INSERT INTO candidates (id, job_id, name, email, phone, location, current_title, current_company, experience_years, resume_path, recruiter_notes, match_score, submission_status, interview_status, client_feedback, candidate_status, submitted_at, interview_at, rejection_reason, date_added, last_updated, linkedin_url, screening_answers, submission_details, placed_at)
             VALUES (?1, ?2, 'Placed Candidate', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'placed', NULL, NULL, 'active', NULL, NULL, NULL, ?3, ?3, NULL, '{}', '{}', '2026-08-20')",
            params![cand_id, jid, ts],
        ).unwrap();

        let json = crate::commands::data::export_json(&conn).unwrap();

        let mut conn2 = test_conn();
        let summary = crate::commands::data::import_json(&mut conn2, &json, true).unwrap();
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

    #[test]
    fn schema_user_version_is_set() {
        let conn = test_conn();
        let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version, 6);

        // Running create_schema again should be a safe no-op
        schema::create_schema(&conn).unwrap();
        let version2: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version2, 6);
    }

    #[test]
    fn ai_resume_extraction_and_missing_field_safety() {
        let full_resume = r#"
Johnathan Doe
Senior Full Stack Engineer
Email: john.doe@example.com
Phone: (555) 123-4567
Location: Austin, TX
LinkedIn: https://www.linkedin.com/in/johndoe

Summary:
Over 7 years of experience building scalable distributed web applications.
Proficient in React, TypeScript, Node.js, Rust, Docker, and AWS.
"#;

        let profile = crate::commands::ai::extract_profile_from_text(full_resume, None, &[]);
        assert_eq!(profile.name, "Johnathan Doe");
        assert_eq!(profile.current_role.as_deref(), Some("Senior Full Stack Engineer"));
        assert_eq!(profile.email.as_deref(), Some("john.doe@example.com"));
        assert_eq!(profile.phone.as_deref(), Some("(555) 123-4567"));
        assert_eq!(profile.location.as_deref(), Some("Austin, TX"));
        assert_eq!(profile.linkedin_url.as_deref(), Some("https://www.linkedin.com/in/johndoe"));
        assert_eq!(profile.experience_years, Some(7));
        assert!(profile.skills.contains(&"React".to_string()));
        assert!(profile.skills.contains(&"TypeScript".to_string()));
        assert!(profile.skills.contains(&"Rust".to_string()));

        // Test minimal resume with missing fields (edge case handling)
        let minimal_resume = r#"
Jane Smith
Developer
Contact: jane@testdev.io, +1-800-555-0199
Skills: Python, PostgreSQL, Kubernetes
3 yrs experience.
"#;

        let minimal_profile = crate::commands::ai::extract_profile_from_text(minimal_resume, None, &[]);
        assert_eq!(minimal_profile.name, "Jane Smith");
        assert_eq!(minimal_profile.current_role.as_deref(), Some("Developer"));
        assert_eq!(minimal_profile.email.as_deref(), Some("jane@testdev.io"));
        assert_eq!(minimal_profile.location, None);
        assert_eq!(minimal_profile.linkedin_url, None);
        assert_eq!(minimal_profile.experience_years, Some(3));
        assert!(minimal_profile.skills.contains(&"Python".to_string()));
        assert!(minimal_profile.skills.contains(&"PostgreSQL".to_string()));

        // Test resume without explicit "Location:" or "Title:" prefixes (Header Pipe format)
        let header_pipe_resume = r#"
Sarah Jenkins
Senior Product Manager
sarah.jenkins@example.com | (555) 987-6543 | Seattle, WA | linkedin.com/in/sarahjenkins

Professional Experience:
8+ years leading cross-functional teams building enterprise software products.
Skills: Agile, Scrum, Figma, SQL, UI/UX
"#;
        let pipe_profile = crate::commands::ai::extract_profile_from_text(header_pipe_resume, None, &[]);
        assert_eq!(pipe_profile.name, "Sarah Jenkins");
        assert_eq!(pipe_profile.current_role.as_deref(), Some("Senior Product Manager"));
        assert_eq!(pipe_profile.email.as_deref(), Some("sarah.jenkins@example.com"));
        assert_eq!(pipe_profile.phone.as_deref(), Some("(555) 987-6543"));
        assert_eq!(pipe_profile.location.as_deref(), Some("Seattle, WA"));
        assert_eq!(pipe_profile.linkedin_url.as_deref(), Some("https://linkedin.com/in/sarahjenkins"));
        assert_eq!(pipe_profile.experience_years, Some(8));
        assert!(pipe_profile.skills.contains(&"Figma".to_string()));

        // Test compound name-headline on Line 1 (real-world delimiter format)
        let compound_resume = r#"
Deion Smith – kubernetes / openSHIFT / NVIDIA GUP platform sme
deion.smith@cloudops.net | (555) 321-7654 | San Jose, CA
Technical Summary:
Over 6 years consulting on enterprise storage and Kubernetes clusters.
Skills: Kubernetes, Docker, Linux, Python, Go
"#;
        let compound_profile = crate::commands::ai::extract_profile_from_text(compound_resume, None, &[]);
        assert_eq!(compound_profile.name, "Deion Smith");
        assert_eq!(compound_profile.current_role.as_deref(), Some("kubernetes / openSHIFT / NVIDIA GUP platform sme"));
        assert_eq!(compound_profile.email.as_deref(), Some("deion.smith@cloudops.net"));
        assert_eq!(compound_profile.location.as_deref(), Some("San Jose, CA"));
        assert_eq!(compound_profile.experience_years, Some(6));
        assert!(compound_profile.skills.contains(&"Kubernetes".to_string()));
        assert!(compound_profile.skills.contains(&"Go".to_string()));

        // Test go-to-market phrase guard: "go to market" should not match Go language
        let non_tech_resume = r#"
Marketing Lead
marketing.specialist@agency.com
Experience:
5 years of experience leading go-to-market strategy for enterprise sales.
"#;
        let non_tech_profile = crate::commands::ai::extract_profile_from_text(non_tech_resume, None, &[]);
        assert!(!non_tech_profile.skills.contains(&"Go".to_string()));
        assert_eq!(non_tech_profile.experience_years, Some(5));
    }

    #[test]
    fn skills_extraction_accuracy_and_context_guards() {
        // 1. Calendar "Spring" & English verb "leveraging" guard
        let calendar_resume = r#"
John Doe
Full Stack Engineer
john.doe@example.com
Education:
BS in Computer Science (Spring 2022 - Spring 2024)
Experience:
Software Engineer Intern
Leveraged React, TypeScript, and Node.js to build cloud dashboards.
"#;
        let profile1 = crate::commands::ai::extract_profile_from_text(calendar_resume, None, &[]);
        assert!(profile1.skills.contains(&"React".to_string()));
        assert!(profile1.skills.contains(&"TypeScript".to_string()));
        assert!(profile1.skills.contains(&"Node.js".to_string()));
        assert!(!profile1.skills.contains(&"Spring".to_string()));
        assert!(!profile1.skills.contains(&"Spring Boot".to_string()));
        assert!(!profile1.skills.contains(&"Lever".to_string()));

        // 2. Genuine Spring Boot with Java ecosystem
        let java_resume = r#"
Alex Rivera
Backend Engineer
alex@backend.io
Experience:
Senior Java Developer
Architected enterprise microservices with Spring Boot, Hibernate, and PostgreSQL.
"#;
        let profile2 = crate::commands::ai::extract_profile_from_text(java_resume, None, &[]);
        assert!(profile2.skills.contains(&"Java".to_string()));
        assert!(profile2.skills.contains(&"Spring Boot".to_string()));
        assert!(profile2.skills.contains(&"Hibernate".to_string()));
        assert!(profile2.skills.contains(&"PostgreSQL".to_string()));
        assert!(profile2.skills.contains(&"Microservices".to_string()));

        // 3. Swift English phrase vs iOS Swift language
        let non_tech_swift = r#"
Operations Lead
ops@company.com
Experience:
Took swift action to resolve customer escalations and improved team response times.
"#;
        let profile3a = crate::commands::ai::extract_profile_from_text(non_tech_swift, None, &[]);
        assert!(!profile3a.skills.contains(&"Swift".to_string()));

        let ios_swift = r#"
Mobile Developer
mobile@iosdev.com
Experience:
Built high performance iOS applications using Swift, SwiftUI, and Xcode.
"#;
        let profile3b = crate::commands::ai::extract_profile_from_text(ios_swift, None, &[]);
        assert!(profile3b.skills.contains(&"Swift".to_string()));
        assert!(profile3b.skills.contains(&"SwiftUI".to_string()));
        assert!(profile3b.skills.contains(&"Xcode".to_string()));
        assert!(profile3b.skills.contains(&"iOS".to_string()));

        // 4. Lean & Slack elimination
        let lean_slack_resume = r#"
Engineering Manager
manager@tech.org
Experience:
Led a lean team of 6 software engineers and managed daily team communications via Slack.
"#;
        let profile4 = crate::commands::ai::extract_profile_from_text(lean_slack_resume, None, &[]);
        assert!(!profile4.skills.contains(&"Lean".to_string()));
        assert!(!profile4.skills.contains(&"Slack".to_string()));

        // 5. Soft-skills rejection from skills sections
        let soft_skills_resume = r#"
Product Leader
lead@prod.net
Core Competencies:
Leadership, Strategic Planning, Communication, Problem Solving, Mentoring, Budgeting, Cross-Functional Teams, Python, Docker
"#;
        let profile5 = crate::commands::ai::extract_profile_from_text(soft_skills_resume, None, &[]);
        assert!(profile5.skills.contains(&"Python".to_string()));
        assert!(profile5.skills.contains(&"Docker".to_string()));
        assert!(!profile5.skills.contains(&"Leadership".to_string()));
        assert!(!profile5.skills.contains(&"Communication".to_string()));
        assert!(!profile5.skills.contains(&"Problem Solving".to_string()));
        assert!(!profile5.skills.contains(&"Mentoring".to_string()));
        assert!(!profile5.skills.contains(&"Strategic Planning".to_string()));
        assert!(!profile5.skills.contains(&"Budgeting".to_string()));

        // 6. Normalization & Canonical mapping from aliases
        let aliases_resume = r#"
Cloud Architect
cloud@arc.dev
Technical Skills:
Postgres, K8s, Golang, ReactJS, NextJS, TailwindCSS
"#;
        let profile6 = crate::commands::ai::extract_profile_from_text(aliases_resume, None, &[]);
        assert!(profile6.skills.contains(&"PostgreSQL".to_string()));
        assert!(profile6.skills.contains(&"Kubernetes".to_string()));
        assert!(profile6.skills.contains(&"Go".to_string()));
        assert!(profile6.skills.contains(&"React".to_string()));
        assert!(profile6.skills.contains(&"Next.js".to_string()));
        assert!(profile6.skills.contains(&"Tailwind CSS".to_string()));
        // Ensure unnormalized alias names were not duplicated
        assert!(!profile6.skills.contains(&"Postgres".to_string()));
        assert!(!profile6.skills.contains(&"K8s".to_string()));
        assert!(!profile6.skills.contains(&"Golang".to_string()));
        assert!(!profile6.skills.contains(&"ReactJS".to_string()));
        assert!(!profile6.skills.contains(&"NextJS".to_string()));

        // 7. Parenthetical technical skills extraction
        let paren_resume = r#"
DevOps Engineer
devops@infra.io
Technical Proficiencies:
Cloud: AWS (EC2, S3, RDS), Docker, GitHub Actions, Terraform
"#;
        let profile7 = crate::commands::ai::extract_profile_from_text(paren_resume, None, &[]);
        assert!(profile7.skills.contains(&"AWS".to_string()));
        assert!(profile7.skills.contains(&"Docker".to_string()));
        assert!(profile7.skills.contains(&"GitHub Actions".to_string()));
        assert!(profile7.skills.contains(&"Terraform".to_string()));
    }

    #[test]
    fn multibyte_resume_text_never_panics() {
        // Byte-offset slicing used to panic on any multi-byte char straddling a cut.
        let resume = "İstanbul Öğrencisi – Café Résumé ☕
Senior Spring Boot Engineer
Skills: Spring Boot, Java, Swift, Go
Experience: worked on spring éngineering and rünning systems — 2022 – 2024
Education: BS (Spring 2022 - Spring 2024)
Contact: İbrahim Ünal | ibrahim@example.com
";
        let profile = crate::commands::ai::extract_profile_from_text(
            resume,
            Some("İbrahim Ünal"),
            &["mailto:ibrahim@example.com".to_string()],
        );
        assert!(profile.skills.contains(&"Spring Boot".to_string()));

        // Name/headline strip path: lowercased name length differs from byte length.
        let compound = "İsmet ÖZTÜRK – Platform SME
ismet@example.com
Skills: Kubernetes, Docker
";
        let profile2 = crate::commands::ai::extract_profile_from_text(compound, None, &[]);
        assert!(profile2.skills.contains(&"Kubernetes".to_string()));

        // The lookahead peek used to slice at a fixed 30-byte offset: place a
        // multi-byte char exactly across that cut (byte 36) and assert no panic.
        let tricky = format!("springx{}", "é".repeat(30));
        let _ = crate::commands::ai::check_spring_tech(&tricky);
    }

    #[test]
    fn import_json_reports_inserted_counts() {
        let src = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts = now();
        src.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();
        src.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-1', 'Engineer', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts],
        )
        .unwrap();
        src.execute(
            "INSERT INTO candidates (id, job_id, name, submission_status, candidate_status, date_added, last_updated)
             VALUES (?1, ?2, 'Alice', 'sourced', 'active', ?3, ?3)",
            params![new_id(), jid, ts],
        )
        .unwrap();

        let json = crate::commands::data::export_json(&src).unwrap();
        let mut dst = test_conn();

        let first = crate::commands::data::import_json(&mut dst, &json, false).unwrap();
        assert_eq!(first.clients, 1);
        assert_eq!(first.jobs, 1);
        assert_eq!(first.candidates, 1);
        assert!(!first.replaced);

        // INSERT OR IGNORE skips duplicates — the summary must report what landed.
        let second = crate::commands::data::import_json(&mut dst, &json, false).unwrap();
        assert_eq!(second.clients, 0);
        assert_eq!(second.jobs, 0);
        assert_eq!(second.candidates, 0);

        let replaced = crate::commands::data::import_json(&mut dst, &json, true).unwrap();
        assert_eq!(replaced.candidates, 1);
        assert!(replaced.replaced);
    }

    #[test]
    fn path_containment_blocks_escape_and_bad_extensions() {
        use std::path::PathBuf;

        let root = std::env::temp_dir().join(format!("recdesk_root_{}", new_id()));
        std::fs::create_dir_all(root.join("docs")).unwrap();
        let good = root.join("docs").join("cv.pdf");
        std::fs::write(&good, b"%PDF-1.4").unwrap();
        let escape = std::env::temp_dir().join(format!("recdesk_escape_{}.pdf", new_id()));
        std::fs::write(&escape, b"%PDF-1.4").unwrap();

        // Document inside the root: allowed for read and write.
        assert!(crate::commands::files::check_path(&root, &good, false).is_ok());
        assert!(crate::commands::files::check_path(&root, &root.join("docs/new.docx"), true).is_ok());
        // Case-insensitive root match (Windows paths).
        assert!(crate::commands::files::check_path(
            &root,
            &PathBuf::from(good.to_string_lossy().to_uppercase()),
            true
        )
        .is_ok());

        // Existing document outside the root: denied even though the extension is fine.
        assert!(crate::commands::files::check_path(&root, &escape, false).is_err());
        // Non-existent target: the extension must be checked before any I/O.
        assert!(crate::commands::files::check_path(&root, &root.join("x.exe"), true).is_err());
        assert!(crate::commands::files::check_path(&root, &root.join("id_rsa"), false).is_err());
        // `..` traversal normalizes out of the root.
        assert!(crate::commands::files::check_path(
            &root,
            &root.join("docs").join("..").join("..").join("evil.txt"),
            true
        )
        .is_err());
        // Missing file with a valid extension: no phantom read.
        assert!(crate::commands::files::check_path(&root, &root.join("docs/gone.pdf"), false).is_err());

        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::remove_file(&escape);
    }

    #[test]
    fn skills_section_fuzzy_headings_and_trust() {
        // Odd headings + lowercase long-tail tokens + category prefixes + slash tokens.
        let odd_resume = r#"
Priya Sharma
Data Engineer
priya@example.com
## My Tech Stack:
python, airflow, dbt, mycustometl, kafka, terraform
Toolbox: Node.js/Express, CI/CD, React/Redux, PL/SQL
Languages: English, Hindi
"#;
        let profile = crate::commands::ai::extract_profile_from_text(odd_resume, None, &[]);
        let has = |s: &str| profile.skills.iter().any(|k| k == s);

        // Fuzzy heading "## My Tech Stack" opened the section
        assert!(has("Python"));
        assert!(has("Apache Airflow"));
        assert!(has("dbt"));
        assert!(has("Apache Kafka"));
        assert!(has("Terraform"));
        // Section trust: lowercase unknown tech survives
        assert!(has("mycustometl"));
        // Slash joining is split; CI/CD and PL/SQL compounds are preserved
        assert!(has("Node.js"));
        assert!(has("Express"));
        assert!(has("CI/CD"));
        assert!(has("PL/SQL"));
        assert!(!has("PL"));
        assert!(has("React"));
        assert!(has("Redux"));
        // Spoken languages are junk inside a skills section
        assert!(!has("English"));
        assert!(!has("Hindi"));
    }

    #[test]
    fn tokenizer_proficiency_prefixes_and_connectors() {
        let resume = r#"
Kim Jo
Developer
kim@example.com
Technical Skills: Advanced Python, Knowledge of React, Proficient in SQL, Expert Rust
"#;
        let profile = crate::commands::ai::extract_profile_from_text(resume, None, &[]);
        let has = |s: &str| profile.skills.iter().any(|k| k == s);

        assert!(has("Python"));
        assert!(has("React"));
        assert!(has("SQL"));
        assert!(has("Rust"));
        assert!(!profile.skills.iter().any(|k| k.starts_with("Advanced")));
        assert!(!profile.skills.iter().any(|k| k.starts_with("Knowledge")));
        assert!(!profile.skills.iter().any(|k| k.starts_with("Proficient")));
    }

    #[test]
    fn canonical_skills_coverage_and_alias_preservation() {
        let resume = r#"
Sam Lee
Data Platform Engineer
sam@example.com
Technical Skills: CloudFormation, Segment, Natural Language Processing, Fivetran, DuckDB, Pulumi
Experience:
Built high-throughput data platforms with Snowplow, Airbyte, and ClickHouse.
"#;
        let profile = crate::commands::ai::extract_profile_from_text(resume, None, &[]);
        let has = |s: &str| profile.skills.iter().any(|k| k == s);

        // Section tokens with 'tion'/'ment' are not dropped by suffix heuristic
        assert!(has("CloudFormation"));
        assert!(has("Segment"));
        // Section alias mapped before ban filter
        assert!(has("NLP"));
        // Standard data tools in dictionary
        assert!(has("Fivetran"));
        assert!(has("DuckDB"));
        assert!(has("Pulumi"));
        assert!(has("Snowplow"));
        assert!(has("Airbyte"));
        assert!(has("ClickHouse"));
    }

    #[test]
    fn bulk_update_candidates_chunking_works_across_boundary() {
        let mut conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts = now();

        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-CHUNK', 'Engineer', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts],
        )
        .unwrap();

        let tx = conn.transaction().unwrap();
        let mut ids = Vec::with_capacity(550);
        {
            let mut stmt = tx.prepare(
                "INSERT INTO candidates (id, job_id, name, submission_status, candidate_status, date_added, last_updated)
                 VALUES (?1, ?2, ?3, 'sourced', 'active', ?4, ?4)",
            ).unwrap();
            for i in 0..550 {
                let id = format!("cand-{i}");
                stmt.execute(params![&id, jid, format!("Candidate {i}"), ts]).unwrap();
                ids.push(id);
            }
        }
        tx.commit().unwrap();

        let patch = CandidatePatch {
            submission_status: Some("submitted".to_string()),
            ..Default::default()
        };

        let updated = bulk_update_candidates_sql(&conn, &ids, &patch).unwrap();
        assert_eq!(updated, 550);

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM candidates WHERE submission_status = 'submitted'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 550);
    }

    #[test]
    fn auto_hold_stale_jobs_transitions_only_stale_jobs() {
        let conn = test_conn();
        let cid = new_id();
        let ts = now();

        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Client', ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();

        let recent_id = new_id();
        let stale_id = new_id();

        // Recent job: updated today
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-RECENT', 'Recent Job', 'active', '[]', '[]', ?3, ?3)",
            params![recent_id, cid, ts],
        )
        .unwrap();

        // Stale job: updated 20 days ago
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-STALE', 'Stale Job', 'active', '[]', '[]', datetime('now', '-20 days'), datetime('now', '-20 days'))",
            params![stale_id, cid],
        )
        .unwrap();

        let changed = crate::commands::job::auto_hold_stale_jobs(&conn).unwrap();
        assert_eq!(changed, 1);

        let recent_status: String = conn
            .query_row("SELECT status FROM jobs WHERE id = ?1", params![recent_id], |r| r.get(0))
            .unwrap();
        let stale_status: String = conn
            .query_row("SELECT status FROM jobs WHERE id = ?1", params![stale_id], |r| r.get(0))
            .unwrap();

        assert_eq!(recent_status, "active");
        assert_eq!(stale_status, "on_hold");
    }

    #[test]
    fn online_backup_replicates_database_accurately() {
        let conn = test_conn();
        let cid = new_id();
        let ts = now();

        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme Backup Test', ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();

        let mut dst_conn = rusqlite::Connection::open_in_memory().unwrap();
        {
            let backup = rusqlite::backup::Backup::new(&conn, &mut dst_conn).unwrap();
            backup
                .run_to_completion(100, std::time::Duration::from_millis(10), None)
                .unwrap();
        }

        let name: String = dst_conn
            .query_row("SELECT name FROM clients WHERE id = ?1", params![cid], |r| r.get(0))
            .unwrap();
        assert_eq!(name, "Acme Backup Test");
    }

    #[test]
    fn rename_resume_auto_disambiguates_when_filename_collides() {
        use std::path::PathBuf;

        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let cand_a = new_id();
        let cand_b = new_id();
        let ts = now();

        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-REN', 'Engineer', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts],
        )
        .unwrap();

        let temp_dir = std::env::temp_dir().join(format!("recdesk_ren_{}", new_id()));
        std::fs::create_dir_all(&temp_dir).unwrap();

        let path_a = temp_dir.join("orig_a.docx");
        let path_b = temp_dir.join("orig_b.docx");
        std::fs::write(&path_a, b"candidate a resume").unwrap();
        std::fs::write(&path_b, b"candidate b resume").unwrap();

        conn.execute(
            "INSERT INTO candidates (id, job_id, name, resume_path, submission_status, candidate_status, date_added, last_updated)
             VALUES (?1, ?2, 'Sameer Khan', ?3, 'sourced', 'active', ?4, ?4)",
            params![cand_a, jid, path_a.to_string_lossy().to_string(), ts],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO candidates (id, job_id, name, resume_path, submission_status, candidate_status, date_added, last_updated)
             VALUES (?1, ?2, 'Sameer Khan', ?3, 'sourced', 'active', ?4, ?4)",
            params![cand_b, jid, path_b.to_string_lossy().to_string(), ts],
        )
        .unwrap();

        // Rename Candidate A to "Sameer KHAN - Resume"
        let res_a = crate::commands::files::rename_resume_in(&conn, &cand_a, "Sameer KHAN - Resume").unwrap();
        assert_eq!(
            PathBuf::from(res_a.resume_path.unwrap()).file_name().unwrap().to_string_lossy(),
            "Sameer KHAN - Resume.docx"
        );

        // Rename Candidate B to the EXACT same name "Sameer KHAN - Resume"
        // It must NOT fail with "already exists" — it must auto-disambiguate cleanly!
        let res_b = crate::commands::files::rename_resume_in(&conn, &cand_b, "Sameer KHAN - Resume").unwrap();
        assert_eq!(
            PathBuf::from(res_b.resume_path.unwrap()).file_name().unwrap().to_string_lossy(),
            "Sameer KHAN - Resume (1).docx"
        );

        // Rename Candidate B again to the same name: should be a clean no-op
        let res_b_noop = crate::commands::files::rename_resume_in(&conn, &cand_b, "Sameer KHAN - Resume (1)").unwrap();
        assert_eq!(
            PathBuf::from(res_b_noop.resume_path.unwrap()).file_name().unwrap().to_string_lossy(),
            "Sameer KHAN - Resume (1).docx"
        );

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn v5_json_integrity_triggers_reject_malformed_json() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme Corp', ?2, ?2)",
            params![cid, ts],
        ).unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, created_at, updated_at) VALUES (?1, ?2, 'J1', 'Engineer', 'active', ?3, ?3)",
            params![jid, cid, ts],
        ).unwrap();

        let cand_id = new_id();

        // Valid JSON insert succeeds
        conn.execute(
            "INSERT INTO candidates (id, job_id, name, submission_details, screening_answers, status_history, interview_feedback, date_added, last_updated)
             VALUES (?1, ?2, 'Valid Json Cand', '{}', '{}', '[]', '{}', ?3, ?3)",
            params![cand_id, jid, ts],
        ).unwrap();

        // Invalid JSON insert fails due to trigger
        let invalid_insert = conn.execute(
            "INSERT INTO candidates (id, job_id, name, submission_details, date_added, last_updated)
             VALUES ('bad_1', ?1, 'Bad Cand', '{not-json', ?2, ?2)",
            params![jid, ts],
        );
        assert!(invalid_insert.is_err(), "Trigger should reject malformed JSON in submission_details");

        // Invalid JSON update fails due to trigger
        let invalid_update = conn.execute(
            "UPDATE candidates SET status_history = 'invalid-json' WHERE id = ?1",
            params![cand_id],
        );
        assert!(invalid_update.is_err(), "Trigger should reject malformed JSON in status_history");

        // Clean up
        conn.execute("DELETE FROM clients WHERE id = ?1", params![cid]).unwrap();
    }

    #[test]
    fn recent_jobs_ordered_by_updated_at() {
        let conn = test_conn();
        let cid = new_id();
        let ts_old = "2026-01-01T10:00:00Z";
        let ts_new = "2026-02-01T10:00:00Z";
        let ts_recent = "2026-03-01T10:00:00Z";
        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts_old],
        ).unwrap();

        let job_old_created = new_id();
        let job_new_created = new_id();

        // Job 1 created long ago, but updated recently
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-OLD', 'Old Job Updated Recently', 'active', '[]', '[]', ?3, ?4)",
            params![job_old_created, cid, ts_old, ts_recent],
        ).unwrap();

        // Job 2 created more recently than Job 1's creation, but updated before Job 1's recent update
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-NEW', 'New Job Older Update', 'active', '[]', '[]', ?3, ?3)",
            params![job_new_created, cid, ts_new],
        ).unwrap();

        let mut stmt = conn.prepare(&format!(
            "{} WHERE j.status = 'active' ORDER BY j.updated_at DESC, j.created_at DESC LIMIT 8",
            crate::commands::job::JOB_SELECT
        )).unwrap();
        let rows = stmt
            .query_map([], crate::rows::row_to_job_with_stats)
            .unwrap()
            .collect::<Result<Vec<_>, rusqlite::Error>>()
            .unwrap();

        assert_eq!(rows.len(), 2);
        // The job with the fresher updated_at MUST be first
        assert_eq!(rows[0].job.id, job_old_created);
        assert_eq!(rows[1].job.id, job_new_created);
    }

    #[test]
    fn delete_job_preserves_candidates_as_unassigned() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts = now();
        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts],
        ).unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-1', 'Senior Dev', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts],
        ).unwrap();

        let cand_id = new_id();
        conn.execute(
            "INSERT INTO candidates (id, job_id, name, submission_status, candidate_status, recruiter_notes, date_added, last_updated)
             VALUES (?1, ?2, 'Jane Doe', 'sourced', 'active', 'Top talent', ?3, ?3)",
            params![cand_id, jid, ts],
        ).unwrap();

        // Detach and delete job (simulating delete_job)
        let ts_del = now();
        conn.execute(
            "UPDATE candidates SET job_id = NULL, last_updated = ?1 WHERE job_id = ?2",
            params![ts_del, jid],
        ).unwrap();
        conn.execute("DELETE FROM jobs WHERE id = ?1", params![jid]).unwrap();

        // Candidate must STILL exist in database
        let cand: crate::models::Candidate = conn.query_row(
            &format!("{} WHERE c.id = ?1", crate::commands::candidate::CANDIDATE_SELECT),
            params![cand_id],
            row_to_candidate,
        ).unwrap();

        assert_eq!(cand.id, cand_id);
        assert_eq!(cand.name, "Jane Doe");
        assert_eq!(cand.job_id, None);
        assert_eq!(cand.recruiter_notes.as_deref(), Some("Top talent"));

        // Query with LEFT JOIN CANDIDATE_SELECT_JOIN returns unassigned candidate
        let mut stmt = conn.prepare(&format!(
            "{} WHERE c.id = ?1",
            crate::commands::candidate::CANDIDATE_SELECT_JOIN
        )).unwrap();
        let cand_with_job = stmt.query_row(
            params![cand_id],
            crate::rows::row_to_candidate_with_job,
        ).unwrap();

        assert_eq!(cand_with_job.candidate.id, cand_id);
        assert_eq!(cand_with_job.candidate.job_id, None);
        assert_eq!(cand_with_job.job_title, "Unassigned");
        assert_eq!(cand_with_job.job_id_ref, "—");
        assert_eq!(cand_with_job.client_name, "—");
    }

    #[test]
    fn reassign_unassigned_candidate_bumps_target_job_updated_at() {
        let conn = test_conn();
        let cid = new_id();
        let jid = new_id();
        let ts_initial = "2026-01-01T00:00:00Z";
        conn.execute(
            "INSERT INTO clients (id, name, created_at, updated_at) VALUES (?1, 'Acme', ?2, ?2)",
            params![cid, ts_initial],
        ).unwrap();
        conn.execute(
            "INSERT INTO jobs (id, client_id, job_id, title, status, boolean_strings, screening_questions, created_at, updated_at)
             VALUES (?1, ?2, 'REQ-2', 'Backend Engineer', 'active', '[]', '[]', ?3, ?3)",
            params![jid, cid, ts_initial],
        ).unwrap();

        let cand_id = new_id();
        // Candidate is unassigned initially
        conn.execute(
            "INSERT INTO candidates (id, job_id, name, submission_status, candidate_status, date_added, last_updated)
             VALUES (?1, NULL, 'Alex Smith', 'sourced', 'active', ?2, ?2)",
            params![cand_id, ts_initial],
        ).unwrap();

        // Assign to job via update_candidate_in
        let input = CandidateInput {
            job_id: Some(jid.clone()),
            ..Default::default()
        };
        let updated = update_candidate_in(&conn, &cand_id, &input).unwrap();
        assert_eq!(updated.job_id.as_deref(), Some(jid.as_str()));

        // Target job's updated_at must be bumped beyond ts_initial
        let job_updated_at: String = conn.query_row(
            "SELECT updated_at FROM jobs WHERE id = ?1",
            params![jid],
            |r| r.get(0),
        ).unwrap();
        assert_ne!(job_updated_at, ts_initial);
    }
}




