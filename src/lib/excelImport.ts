import * as XLSX from "xlsx";
import type { Candidate, Client, ExportEnvelope, Job } from "../types";
import {
  CANDIDATE_ALIASES,
  CLIENT_ALIASES,
  JOB_ALIASES,
  matchFieldKey,
  normalizeCandidateStatus,
  parseExcelDate,
  parseExperienceYears,
  parseMatchScore,
} from "./excelUtils";

export interface ExcelImportValidation {
  envelope: ExportEnvelope;
  clientsCount: number;
  jobsCount: number;
  candidatesCount: number;
  autoCreatedClients: string[];
  autoCreatedJobs: string[];
  skippedRows: { sheet: string; row: number; reason: string }[];
  warnings: string[];
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function parseExcelImport(
  bytes: Uint8Array,
  existingClients: Client[] = [],
  existingJobs: Job[] = []
): ExcelImportValidation {
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetNames = workbook.SheetNames;

  const skippedRows: { sheet: string; row: number; reason: string }[] = [];
  const warnings: string[] = [];
  const autoCreatedClients: string[] = [];
  const autoCreatedJobs: string[] = [];

  const clients: Client[] = [];
  const jobs: Job[] = [];
  const candidates: Candidate[] = [];

  // Track lookup maps for clients and jobs
  // Key: normalized name/title/job_id -> ID
  const clientLookup = new Map<string, string>();
  for (const c of existingClients) {
    if (c.name) clientLookup.set(c.name.toLowerCase().trim(), c.id);
    if (c.company) clientLookup.set(c.company.toLowerCase().trim(), c.id);
  }

  const jobLookup = new Map<string, string>();
  for (const j of existingJobs) {
    if (j.job_id) jobLookup.set(j.job_id.toLowerCase().trim(), j.id);
    if (j.title) jobLookup.set(j.title.toLowerCase().trim(), j.id);
  }

  // Identify sheet assignments
  let clientSheet: string | null = null;
  let jobSheet: string | null = null;
  let candidateSheet: string | null = null;

  for (const name of sheetNames) {
    const lower = name.toLowerCase().trim();
    if (lower.includes("client") || lower.includes("account") || lower.includes("company")) {
      clientSheet = name;
    } else if (lower.includes("job") || lower.includes("req") || lower.includes("position") || lower.includes("role")) {
      jobSheet = name;
    } else if (lower.includes("cand") || lower.includes("applicant") || lower.includes("talent") || lower.includes("people")) {
      candidateSheet = name;
    }
  }

  // If no standard multi-sheet names were matched and there is only 1 sheet (or Sheet1), auto-detect by headers
  if (!clientSheet && !jobSheet && !candidateSheet && sheetNames.length > 0) {
    const firstSheetName = sheetNames[0];
    const ws = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 });
    if (rawRows.length > 0 && Array.isArray(rawRows[0])) {
      const headers = rawRows[0].map(String);
      const isCandidate = headers.some((h) => matchFieldKey(h, CANDIDATE_ALIASES) === "name" || matchFieldKey(h, CANDIDATE_ALIASES) === "phone");
      const isJob = headers.some((h) => matchFieldKey(h, JOB_ALIASES) === "title");
      const isClient = headers.some((h) => matchFieldKey(h, CLIENT_ALIASES) === "hiring_manager");

      if (isCandidate) candidateSheet = firstSheetName;
      else if (isJob) jobSheet = firstSheetName;
      else if (isClient) clientSheet = firstSheetName;
      else candidateSheet = firstSheetName; // default to candidates
    }
  }

  // 1. Process Clients Sheet
  if (clientSheet && workbook.Sheets[clientSheet]) {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[clientSheet]);
    let rowIdx = 2;
    for (const raw of rawRows) {
      const mapped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        const canonical = matchFieldKey(k, CLIENT_ALIASES);
        if (canonical) mapped[canonical] = v;
      }

      const name = String(mapped.name || mapped.company || "").trim();
      if (!name) {
        skippedRows.push({ sheet: clientSheet, row: rowIdx, reason: "Missing client name or company" });
        rowIdx++;
        continue;
      }

      const id = generateId("client");
      const now = new Date().toISOString();
      const clientObj: Client = {
        id,
        name,
        company: mapped.company ? String(mapped.company).trim() : null,
        email: mapped.email ? String(mapped.email).trim() : null,
        hiring_manager: mapped.hiring_manager ? String(mapped.hiring_manager).trim() : null,
        address: mapped.address ? String(mapped.address).trim() : null,
        notes: mapped.notes ? String(mapped.notes).trim() : null,
        created_at: now,
        updated_at: now,
      };

      clients.push(clientObj);
      clientLookup.set(name.toLowerCase(), id);
      if (clientObj.company) clientLookup.set(clientObj.company.toLowerCase(), id);
      rowIdx++;
    }
  }

  // Helper to ensure a valid client ID
  function resolveOrCreateClientId(rawClientName?: string | null): string {
    const trimmed = String(rawClientName || "").trim();
    if (trimmed && clientLookup.has(trimmed.toLowerCase())) {
      return clientLookup.get(trimmed.toLowerCase())!;
    }
    // Auto-create client if named
    const newName = trimmed || "General Clients";
    const newId = generateId("client");
    const now = new Date().toISOString();
    const newClient: Client = {
      id: newId,
      name: newName,
      company: null,
      email: null,
      hiring_manager: null,
      address: null,
      notes: "Auto-created from Excel import",
      created_at: now,
      updated_at: now,
    };
    clients.push(newClient);
    clientLookup.set(newName.toLowerCase(), newId);
    autoCreatedClients.push(newName);
    return newId;
  }

  // 2. Process Jobs Sheet
  if (jobSheet && workbook.Sheets[jobSheet]) {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[jobSheet]);
    let rowIdx = 2;
    for (const raw of rawRows) {
      const mapped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        const canonical = matchFieldKey(k, JOB_ALIASES);
        if (canonical) mapped[canonical] = v;
      }

      const title = String(mapped.title || "").trim();
      if (!title) {
        skippedRows.push({ sheet: jobSheet, row: rowIdx, reason: "Missing job title" });
        rowIdx++;
        continue;
      }

      const clientId = resolveOrCreateClientId(mapped.client as string);
      const id = generateId("job");
      const now = new Date().toISOString();
      const jobIdCode = mapped.job_id ? String(mapped.job_id).trim() : `JOB-${Date.now().toString(36).toUpperCase()}`;

      const jobObj: Job = {
        id,
        client_id: clientId,
        job_id: jobIdCode,
        title,
        location: mapped.location ? String(mapped.location).trim() : null,
        work_model: mapped.work_model ? String(mapped.work_model).trim() : null,
        contract_type: mapped.contract_type ? String(mapped.contract_type).trim() : null,
        bill_rate: mapped.bill_rate ? String(mapped.bill_rate).trim() : null,
        pay_rate: mapped.pay_rate ? String(mapped.pay_rate).trim() : null,
        status: String(mapped.status || "active").toLowerCase().includes("close") ? "closed" : "active",
        refined_jd: mapped.refined_jd ? String(mapped.refined_jd).trim() : null,
        boolean_strings: [],
        candidate_pitch: mapped.candidate_pitch ? String(mapped.candidate_pitch).trim() : null,
        screening_questions: [],
        notes: mapped.notes ? String(mapped.notes).trim() : null,
        created_at: now,
        updated_at: now,
        closed_at: null,
      };

      jobs.push(jobObj);
      if (jobIdCode) jobLookup.set(jobIdCode.toLowerCase(), id);
      jobLookup.set(title.toLowerCase(), id);
      rowIdx++;
    }
  }

  // Helper to ensure a valid job ID
  function resolveOrCreateJobId(rawJobRef?: string | null): string {
    const trimmed = String(rawJobRef || "").trim();
    if (trimmed && jobLookup.has(trimmed.toLowerCase())) {
      return jobLookup.get(trimmed.toLowerCase())!;
    }
    // If jobs list has at least 1 job and no ref specified, link to first job
    if (!trimmed && jobs.length > 0) {
      return jobs[0].id;
    }
    if (!trimmed && existingJobs.length > 0) {
      return existingJobs[0].id;
    }
    // Auto-create a job
    const newTitle = trimmed || "General Pipeline";
    const clientId = resolveOrCreateClientId(null);
    const newJobId = generateId("job");
    const now = new Date().toISOString();
    const newJob: Job = {
      id: newJobId,
      client_id: clientId,
      job_id: `REQ-${Date.now().toString(36).toUpperCase()}`,
      title: newTitle,
      location: null,
      work_model: null,
      contract_type: null,
      bill_rate: null,
      pay_rate: null,
      status: "active",
      refined_jd: null,
      boolean_strings: [],
      candidate_pitch: null,
      screening_questions: [],
      notes: "Auto-created from candidate roster import",
      created_at: now,
      updated_at: now,
      closed_at: null,
    };
    jobs.push(newJob);
    jobLookup.set(newTitle.toLowerCase(), newJobId);
    autoCreatedJobs.push(newTitle);
    return newJobId;
  }

  // 3. Process Candidates Sheet
  if (candidateSheet && workbook.Sheets[candidateSheet]) {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[candidateSheet]);
    let rowIdx = 2;
    for (const raw of rawRows) {
      const mapped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        const canonical = matchFieldKey(k, CANDIDATE_ALIASES);
        if (canonical) mapped[canonical] = v;
      }

      const name = String(mapped.name || "").trim();
      if (!name) {
        skippedRows.push({ sheet: candidateSheet, row: rowIdx, reason: "Missing candidate name" });
        rowIdx++;
        continue;
      }

      const jobId = resolveOrCreateJobId(mapped.job as string);
      const id = generateId("cand");
      const now = new Date().toISOString();
      const status = normalizeCandidateStatus(mapped.submission_status);

      let screeningJson: string | null = null;
      if (mapped.screening_summary) {
        screeningJson = JSON.stringify({ "0": String(mapped.screening_summary).trim() });
      }

      const candidateObj: Candidate = {
        id,
        job_id: jobId,
        name,
        email: mapped.email ? String(mapped.email).trim() : null,
        phone: mapped.phone ? String(mapped.phone).trim() : null,
        location: mapped.location ? String(mapped.location).trim() : null,
        current_title: mapped.current_title ? String(mapped.current_title).trim() : null,
        current_company: mapped.current_company ? String(mapped.current_company).trim() : null,
        experience_years: parseExperienceYears(mapped.experience_years),
        resume_path: null,
        linkedin_url: mapped.linkedin_url ? String(mapped.linkedin_url).trim() : null,
        recruiter_notes: mapped.recruiter_notes ? String(mapped.recruiter_notes).trim() : null,
        match_score: parseMatchScore(mapped.match_score),
        submission_status: status,
        interview_status: status === "interview" ? "Interview Scheduled" : null,
        client_feedback: mapped.client_feedback ? String(mapped.client_feedback).trim() : null,
        candidate_status: "active",
        submitted_at: status === "submitted" ? parseExcelDate(mapped.submitted_at) || now.slice(0, 10) : parseExcelDate(mapped.submitted_at),
        interview_at: status === "interview" ? parseExcelDate(mapped.interview_at) || now.slice(0, 10) : parseExcelDate(mapped.interview_at),
        placed_at: status === "placed" ? parseExcelDate(mapped.placed_at) || now.slice(0, 10) : parseExcelDate(mapped.placed_at),
        rejection_reason: mapped.rejection_reason ? String(mapped.rejection_reason).trim() : null,
        screening_answers: screeningJson,
        submission_details: null,
        date_added: now,
        last_updated: now,
      };

      candidates.push(candidateObj);
      rowIdx++;
    }
  }

  const envelope: ExportEnvelope = {
    version: 1,
    exported_at: new Date().toISOString(),
    clients,
    jobs,
    candidates,
  };

  return {
    envelope,
    clientsCount: clients.length,
    jobsCount: jobs.length,
    candidatesCount: candidates.length,
    autoCreatedClients,
    autoCreatedJobs,
    skippedRows,
    warnings,
  };
}
