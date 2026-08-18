use rusqlite::params;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{Candidate, Client, ExportEnvelope, ImportSummary, Job};
use crate::rows::{
    now, row_to_candidate, row_to_client, row_to_job, serialize_bools, serialize_questions,
};
use crate::AppState;

const CLIENT_SELECT: &str =
    "SELECT id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order FROM clients";
const JOB_SELECT: &str = r#"SELECT id, client_id, job_id, title, location, work_model, contract_type,
     status, refined_jd, boolean_strings, candidate_pitch, screening_questions, notes,
     created_at, updated_at, closed_at, sort_order FROM jobs"#;
const CANDIDATE_SELECT: &str = r#"SELECT id, job_id, name, email, phone, location, current_title,
     current_company, experience_years, resume_path, recruiter_notes, match_score,
     submission_status, interview_status, client_feedback, candidate_status,
     submitted_at, interview_at, rejection_reason,
     date_added, last_updated, linkedin_url FROM candidates"#;

fn collect_clients(conn: &rusqlite::Connection) -> AppResult<Vec<Client>> {
    let mut stmt = conn.prepare(CLIENT_SELECT)?;
    let rows = stmt
        .query_map([], |row| row_to_client(row))?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

fn collect_jobs(conn: &rusqlite::Connection) -> AppResult<Vec<Job>> {
    let mut stmt = conn.prepare(JOB_SELECT)?;
    let rows = stmt
        .query_map([], |row| row_to_job(row))?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

fn collect_candidates(conn: &rusqlite::Connection) -> AppResult<Vec<Candidate>> {
    let mut stmt = conn.prepare(CANDIDATE_SELECT)?;
    let rows = stmt
        .query_map([], |row| row_to_candidate(row))?
        .collect::<Result<Vec<_>, rusqlite::Error>>()?;
    Ok(rows)
}

pub fn export_json(conn: &rusqlite::Connection) -> AppResult<String> {
    let envelope = ExportEnvelope {
        version: 1,
        exported_at: now(),
        clients: collect_clients(conn)?,
        jobs: collect_jobs(conn)?,
        candidates: collect_candidates(conn)?,
    };
    serde_json::to_string_pretty(&envelope).map_err(AppError::from)
}

pub fn import_json(
    conn: &mut rusqlite::Connection,
    json: &str,
    replace: bool,
) -> AppResult<ImportSummary> {
    let envelope: ExportEnvelope = serde_json::from_str(json)
        .map_err(|e| AppError::Msg(format!("Invalid export file: {e}")))?;
    if envelope.version != 1 {
        return Err(format!(
            "Unsupported export version: {} (expected 1)",
            envelope.version
        )
        .into());
    }

    let tx = conn.transaction()?;

    if replace {
        tx.execute("DELETE FROM candidates", [])?;
        tx.execute("DELETE FROM jobs", [])?;
        tx.execute("DELETE FROM clients", [])?;
    }

    for client in &envelope.clients {
        tx.execute(
            "INSERT OR IGNORE INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                client.id, client.name, client.company, client.email, client.hiring_manager,
                client.address, client.notes, client.created_at, client.updated_at,
                client.sort_order
            ],
        )?;
    }

    for job in &envelope.jobs {
        tx.execute(
            "INSERT OR IGNORE INTO jobs (id, client_id, job_id, title, location, work_model, contract_type,
                status, refined_jd, boolean_strings, candidate_pitch, screening_questions, notes,
                created_at, updated_at, closed_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                job.id, job.client_id, job.job_id, job.title, job.location, job.work_model,
                job.contract_type, job.status, job.refined_jd,
                serialize_bools(&job.boolean_strings), job.candidate_pitch,
                serialize_questions(&job.screening_questions), job.notes,
                job.created_at, job.updated_at, job.closed_at, job.sort_order
            ],
        )?;
    }

    for candidate in &envelope.candidates {
        tx.execute(
            "INSERT OR IGNORE INTO candidates (id, job_id, name, email, phone, location, current_title,
                current_company, experience_years, resume_path, linkedin_url, recruiter_notes, match_score,
                submission_status, interview_status, client_feedback, candidate_status,
                submitted_at, interview_at, rejection_reason,
                date_added, last_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
            params![
                candidate.id, candidate.job_id, candidate.name, candidate.email, candidate.phone,
                candidate.location, candidate.current_title, candidate.current_company,
                candidate.experience_years, candidate.resume_path, candidate.linkedin_url,
                candidate.recruiter_notes, candidate.match_score, candidate.submission_status,
                candidate.interview_status, candidate.client_feedback, candidate.candidate_status,
                candidate.submitted_at, candidate.interview_at, candidate.rejection_reason,
                candidate.date_added, candidate.last_updated
            ],
        )?;
    }

    tx.commit()?;

    Ok(ImportSummary {
        clients: envelope.clients.len(),
        jobs: envelope.jobs.len(),
        candidates: envelope.candidates.len(),
        replaced: replace,
    })
}

#[tauri::command]
pub fn export_data(state: State<'_, AppState>) -> AppResult<String> {
    let conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    export_json(&conn)
}

#[tauri::command]
pub fn import_data(
    state: State<'_, AppState>,
    json: String,
    replace: bool,
) -> AppResult<ImportSummary> {
    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    import_json(&mut conn, &json, replace)
}

#[tauri::command]
pub fn seed_demo_data(state: State<'_, AppState>) -> AppResult<ImportSummary> {
    use crate::rows::new_id;

    let mut conn = state.db.lock().map_err(|e| AppError::Msg(e.to_string()))?;
    let tx = conn.transaction()?;

    let demo: ExportEnvelope =
        serde_json::from_str(DEMO_JSON).map_err(|e| AppError::Msg(format!("demo data invalid: {e}")))?;

    for client in &demo.clients {
        let id = if client.id.is_empty() { new_id() } else { client.id.clone() };
        tx.execute(
            "INSERT OR IGNORE INTO clients (id, name, company, email, hiring_manager, address, notes, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                id, client.name, client.company, client.email, client.hiring_manager,
                client.address, client.notes, client.created_at, client.updated_at,
                client.sort_order
            ],
        )?;
    }

    for job in &demo.jobs {
        let id = if job.id.is_empty() { new_id() } else { job.id.clone() };
        tx.execute(
            "INSERT OR IGNORE INTO jobs (id, client_id, job_id, title, location, work_model, contract_type,
                status, refined_jd, boolean_strings, candidate_pitch, screening_questions, notes,
                created_at, updated_at, closed_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                id, job.client_id, job.job_id, job.title, job.location, job.work_model,
                job.contract_type, job.status, job.refined_jd,
                serialize_bools(&job.boolean_strings), job.candidate_pitch,
                serialize_questions(&job.screening_questions), job.notes,
                job.created_at, job.updated_at, job.closed_at, job.sort_order
            ],
        )?;
    }

    for candidate in &demo.candidates {
        let id = if candidate.id.is_empty() { new_id() } else { candidate.id.clone() };
        tx.execute(
            "INSERT OR IGNORE INTO candidates (id, job_id, name, email, phone, location, current_title,
                current_company, experience_years, resume_path, recruiter_notes, match_score,
                submission_status, interview_status, client_feedback, candidate_status,
                date_added, last_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                id, candidate.job_id, candidate.name, candidate.email, candidate.phone,
                candidate.location, candidate.current_title, candidate.current_company,
                candidate.experience_years, candidate.resume_path, candidate.recruiter_notes,
                candidate.match_score, candidate.submission_status, candidate.interview_status,
                candidate.client_feedback, candidate.candidate_status, candidate.date_added,
                candidate.last_updated
            ],
        )?;
    }

    tx.commit()?;

    let summary = ImportSummary {
        clients: demo.clients.len(),
        jobs: demo.jobs.len(),
        candidates: demo.candidates.len(),
        replaced: false,
    };
    Ok(summary)
}

const DEMO_JSON: &str = r#"
{
  "version": 1,
  "exported_at": "2026-08-16T00:00:00Z",
  "clients": [
    {
      "id": "demo-client-1",
      "name": "MassMutual",
      "company": "MassMutual Insurance",
      "email": "hiring@massmutual.com",
      "hiring_manager": "Sarah Thompson",
      "address": "1295 State St, Springfield, MA 01111",
      "notes": "Large insurance client. Prefers contract-to-hire for engineering roles.",
      "created_at": "2026-07-01T09:00:00Z",
      "updated_at": "2026-08-10T15:30:00Z"
    },
    {
      "id": "demo-client-2",
      "name": "Delta Systems",
      "company": "Delta Systems LLC",
      "email": "jobs@deltasystems.com",
      "hiring_manager": "Marcus Reed",
      "address": "900 Technology Pkwy, Atlanta, GA 30313",
      "notes": "",
      "created_at": "2026-07-12T10:00:00Z",
      "updated_at": "2026-08-12T11:00:00Z"
    },
    {
      "id": "demo-client-3",
      "name": "GreenWay Financial",
      "company": "GreenWay Financial Group",
      "email": "recruiting@greenwayfin.com",
      "hiring_manager": "Elena Vargas",
      "address": "250 Madison Ave, New York, NY 10016",
      "notes": "Fintech. Strong culture fit focus.",
      "created_at": "2026-07-20T08:30:00Z",
      "updated_at": "2026-08-14T09:45:00Z"
    }
  ],
  "jobs": [
    {
      "id": "demo-job-1",
      "client_id": "demo-client-1",
      "job_id": "REQ-10482",
      "title": "Senior Java Developer",
      "location": "Boston, MA",
      "work_model": "Hybrid",
      "contract_type": "Contract",
      "status": "active",
      "refined_jd": "Seeking a Senior Java Developer for a hybrid role in Boston.\n\n## Requirements\n- 7+ years of Java development experience\n- Strong Spring Boot / microservices background\n- Experience with Kafka and distributed systems\n- AWS or Azure cloud experience",
      "boolean_strings": [
        {
          "name": "Tight",
          "query": "(\"Senior Java Developer\" OR \"Senior Java Engineer\") AND (Spring Boot OR microservices) AND Kafka AND Boston"
        },
        {
          "name": "Normal",
          "query": "(Java AND Spring) AND (Kafka OR RabbitMQ) AND (AWS OR Azure)"
        },
        {
          "name": "Broad",
          "query": "(Java OR J2EE) AND (Spring OR Hibernate) AND (microservices OR distributed)"
        }
      ],
      "candidate_pitch": "Hi {name}, I'm working with MassMutual on a Senior Java Developer role. It's a 12-month contract, hybrid in Boston, working on their core policy platform with Spring Boot and Kafka. Great team, strong benefits. Would you be open to a quick chat?",
      "screening_questions": [
        "Can you walk me through a recent microservices project you led?",
        "How have you handled high-throughput Kafka consumers?",
        "What cloud platform do you have the most production experience with?",
        "Are you comfortable with a hybrid schedule in Boston 3 days a week?",
        "What is your expected hourly rate for a 12-month contract?"
      ],
      "notes": "Client is looking to move fast. They have budget approval through Q1 next year. Submissions reviewed within 2 business days.",
      "created_at": "2026-07-15T09:00:00Z",
      "updated_at": "2026-08-14T16:00:00Z",
      "closed_at": null
    },
    {
      "id": "demo-job-2",
      "client_id": "demo-client-1",
      "job_id": "REQ-10513",
      "title": "Business Analyst",
      "location": "Remote (EST)",
      "work_model": "Remote",
      "contract_type": "Permanent",
      "status": "active",
      "refined_jd": "Business Analyst with insurance domain experience to join MassMutual's digital transformation team.",
      "boolean_strings": [
        { "name": "Tight", "query": "(\"Business Analyst\") AND (insurance OR \"financial services\") AND (\"Agile\" OR \"Scrum\")" },
        { "name": "Broad", "query": "(\"Business Analyst\" OR \"BA\") AND (requirements OR \"process improvement\")" }
      ],
      "candidate_pitch": "Hello {name}, MassMutual is hiring a full-time Business Analyst - fully remote, EST hours. Insurance domain experience is a plus but they value strong BA fundamentals. Interested?",
      "screening_questions": [
        "What types of projects have you analyzed in financial services?",
        "How do you gather and document requirements?",
        "Are you comfortable being fully remote working in EST timezone?"
      ],
      "notes": "",
      "created_at": "2026-07-22T10:00:00Z",
      "updated_at": "2026-08-12T14:00:00Z",
      "closed_at": null
    },
    {
      "id": "demo-job-3",
      "client_id": "demo-client-2",
      "job_id": "REQ-10988",
      "title": "Data Engineer",
      "location": "Atlanta, GA",
      "work_model": "Hybrid",
      "contract_type": "Contract",
      "status": "active",
      "refined_jd": "Data Engineer for Delta Systems' analytics platform modernization.",
      "boolean_strings": [
        { "name": "Tight", "query": "(\"Data Engineer\") AND (Spark OR Databricks) AND (Python OR Scala) AND Atlanta" }
      ],
      "candidate_pitch": "Hi {name}, Delta Systems is looking for a Data Engineer to modernize their analytics platform - Spark/Databricks stack. Hybrid in Atlanta. Interested?",
      "screening_questions": [
        "Walk me through a data pipeline you built end-to-end.",
        "Databricks vs Snowflake - where is your comfort zone?",
        "Are you local to the Atlanta area?"
      ],
      "notes": "Rate range: $70-80/hr. Need to fill in 4 weeks.",
      "created_at": "2026-08-01T09:00:00Z",
      "updated_at": "2026-08-14T10:00:00Z",
      "closed_at": null
    },
    {
      "id": "demo-job-4",
      "client_id": "demo-client-3",
      "job_id": "REQ-11042",
      "title": "React Frontend Developer",
      "location": "New York, NY",
      "work_model": "Hybrid",
      "contract_type": "Permanent",
      "status": "on_hold",
      "refined_jd": "React frontend developer for GreenWay's client-facing investment dashboard.",
      "boolean_strings": [
        { "name": "Normal", "query": "React AND (TypeScript OR \"TypeScript\") AND (\"Frontend Engineer\" OR \"UI Engineer\") AND New York" }
      ],
      "candidate_pitch": "Hi {name}, GreenWay Financial is hiring a React dev for their investment dashboard. Currently on hold - do you want me to keep you in mind?",
      "screening_questions": [
        "How do you approach component architecture in React?",
        "Experience with data visualization libraries?",
        "Are you based in the NYC area?"
      ],
      "notes": "Budget approval pending. Do not submit candidates until status changes.",
      "created_at": "2026-08-05T09:00:00Z",
      "updated_at": "2026-08-10T12:00:00Z",
      "closed_at": null
    }
  ],
  "candidates": [
    {
      "id": "demo-cand-1",
      "job_id": "demo-job-1",
      "name": "Daniel Okafor",
      "email": "daniel.okafor@gmail.com",
      "phone": "+1 (617) 555-0101",
      "location": "Boston, MA",
      "current_title": "Senior Java Developer",
      "current_company": "Fidelity Investments",
      "experience_years": 9,
      "resume_path": null,
      "recruiter_notes": "Strong Spring Boot background. Led 3 microservices migrations.",
      "match_score": 92,
      "submission_status": "submitted",
      "interview_status": "Technical round 2 scheduled",
      "client_feedback": "Positive after first round. Wants to see Kafka depth.",
      "candidate_status": "active",
      "date_added": "2026-08-01T10:00:00Z",
      "last_updated": "2026-08-14T09:30:00Z"
    },
    {
      "id": "demo-cand-2",
      "job_id": "demo-job-1",
      "name": "Emily Davis",
      "email": "emily.davis@outlook.com",
      "phone": "+1 (781) 555-0132",
      "location": "Cambridge, MA",
      "current_title": "Java Engineer",
      "current_company": "Wayfair",
      "experience_years": 6,
      "resume_path": null,
      "recruiter_notes": "Great communicator. Kafka exposure but not deep.",
      "match_score": 78,
      "submission_status": "submitted",
      "interview_status": null,
      "client_feedback": null,
      "candidate_status": "active",
      "date_added": "2026-08-08T14:00:00Z",
      "last_updated": "2026-08-12T11:00:00Z"
    },
    {
      "id": "demo-cand-3",
      "job_id": "demo-job-1",
      "name": "Michael Chen",
      "email": "mchen@protonmail.com",
      "phone": "+1 (857) 555-0178",
      "location": "Quincy, MA",
      "current_title": "Principal Software Engineer",
      "current_company": "State Street",
      "experience_years": 12,
      "resume_path": null,
      "recruiter_notes": "Overqualified for title but interested in contract. Rate higher than budget.",
      "match_score": 85,
      "submission_status": "sourced",
      "interview_status": null,
      "client_feedback": null,
      "candidate_status": "active",
      "date_added": "2026-08-13T09:00:00Z",
      "last_updated": "2026-08-13T09:00:00Z"
    },
    {
      "id": "demo-cand-4",
      "job_id": "demo-job-2",
      "name": "Sarah Wilson",
      "email": "sarah.wilson@gmail.com",
      "phone": "+1 (413) 555-0115",
      "location": "Springfield, MA",
      "current_title": "Business Analyst",
      "current_company": "Travelers",
      "experience_years": 5,
      "resume_path": null,
      "recruiter_notes": "Insurance BA with Agile cert. Good culture fit.",
      "match_score": 88,
      "submission_status": "interview",
      "interview_status": "Final interview passed",
      "client_feedback": "Client made verbal offer, waiting on written.",
      "candidate_status": "active",
      "date_added": "2026-08-03T10:00:00Z",
      "last_updated": "2026-08-14T13:00:00Z"
    },
    {
      "id": "demo-cand-5",
      "job_id": "demo-job-3",
      "name": "David Rodriguez",
      "email": "drodriguez@yahoo.com",
      "phone": "+1 (470) 555-0193",
      "location": "Alpharetta, GA",
      "current_title": "Data Engineer",
      "current_company": "Home Depot",
      "experience_years": 7,
      "resume_path": null,
      "recruiter_notes": "Solid Spark/Databricks portfolio. Local to Atlanta.",
      "match_score": 90,
      "submission_status": "submitted",
      "interview_status": "Panel interview this week",
      "client_feedback": "Shortlisted for panel.",
      "candidate_status": "active",
      "date_added": "2026-08-06T10:00:00Z",
      "last_updated": "2026-08-14T08:00:00Z"
    },
    {
      "id": "demo-cand-6",
      "job_id": "demo-job-4",
      "name": "Ashley Kim",
      "email": "ashley.kim@gmail.com",
      "phone": "+1 (917) 555-0129",
      "location": "Jersey City, NJ",
      "current_title": "Frontend Developer",
      "current_company": "Bloomberg",
      "experience_years": 4,
      "resume_path": null,
      "recruiter_notes": "Strong TypeScript. Interested but has other active processes.",
      "match_score": 82,
      "submission_status": "sourced",
      "interview_status": null,
      "client_feedback": null,
      "candidate_status": "active",
      "date_added": "2026-08-10T09:00:00Z",
      "last_updated": "2026-08-10T09:00:00Z"
    }
  ]
}
"#;
