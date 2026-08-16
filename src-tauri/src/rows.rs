use rusqlite::Row;

use crate::models::{
    BooleanString, Candidate, CandidateWithJob, Client, ClientWithStats, Job, JobWithStats,
};

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn parse_bools(raw: String) -> Vec<BooleanString> {
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn parse_questions(raw: String) -> Vec<String> {
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn serialize_bools(v: &[BooleanString]) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string())
}

pub fn serialize_questions(v: &[String]) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string())
}

pub fn row_to_client(row: &Row) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get(0)?,
        name: row.get(1)?,
        company: row.get(2)?,
        email: row.get(3)?,
        phone: row.get(4)?,
        address: row.get(5)?,
        notes: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

pub fn row_to_client_with_stats(row: &Row) -> rusqlite::Result<ClientWithStats> {
    Ok(ClientWithStats {
        client: row_to_client(row)?,
        jobs_count: row.get(9)?,
        candidates_count: row.get(10)?,
    })
}

pub fn row_to_job(row: &Row) -> rusqlite::Result<Job> {
    let bools_raw: String = row.get(9)?;
    let questions_raw: String = row.get(11)?;
    Ok(Job {
        id: row.get(0)?,
        client_id: row.get(1)?,
        job_id: row.get(2)?,
        title: row.get(3)?,
        location: row.get(4)?,
        work_model: row.get(5)?,
        contract_type: row.get(6)?,
        status: row.get(7)?,
        refined_jd: row.get(8)?,
        boolean_strings: parse_bools(bools_raw),
        candidate_pitch: row.get(10)?,
        screening_questions: parse_questions(questions_raw),
        notes: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
        closed_at: row.get(15)?,
    })
}

// Job + client_name + candidate_count (indices 16, 17 appended after job fields)
pub fn row_to_job_with_stats(row: &Row) -> rusqlite::Result<JobWithStats> {
    Ok(JobWithStats {
        job: row_to_job(row)?,
        client_name: row.get(16)?,
        candidate_count: row.get(17)?,
    })
}

pub fn row_to_candidate(row: &Row) -> rusqlite::Result<Candidate> {
    Ok(Candidate {
        id: row.get(0)?,
        job_id: row.get(1)?,
        name: row.get(2)?,
        email: row.get(3)?,
        phone: row.get(4)?,
        location: row.get(5)?,
        current_title: row.get(6)?,
        current_company: row.get(7)?,
        experience_years: row.get(8)?,
        resume_path: row.get(9)?,
        recruiter_notes: row.get(10)?,
        match_score: row.get(11)?,
        submission_status: row.get(12)?,
        interview_status: row.get(13)?,
        client_feedback: row.get(14)?,
        candidate_status: row.get(15)?,
        date_added: row.get(16)?,
        last_updated: row.get(17)?,
    })
}

// Candidate + job_title + job_id_ref + client_name (indices 18, 19, 20 appended)
pub fn row_to_candidate_with_job(row: &Row) -> rusqlite::Result<CandidateWithJob> {
    Ok(CandidateWithJob {
        candidate: row_to_candidate(row)?,
        job_title: row.get(18)?,
        job_id_ref: row.get(19)?,
        client_name: row.get(20)?,
    })
}
