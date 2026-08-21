import * as XLSX from "xlsx";
import type { Candidate, Client, ExportEnvelope, Job } from "../types";

function extractScreeningSummary(screeningAnswersJson?: string | null): string {
  if (!screeningAnswersJson) return "";
  try {
    const parsed = JSON.parse(screeningAnswersJson);
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed)
        .map(([k, v]) => `Q${Number(k) + 1}: ${v}`)
        .join(" | ");
    }
  } catch {
    // fallback
  }
  return screeningAnswersJson;
}

export function generateExcelWorkbook(envelope: ExportEnvelope): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Create client lookup maps
  const clientMap = new Map<string, string>();
  for (const c of envelope.clients) {
    clientMap.set(c.id, c.name || c.company || "General Client");
  }

  // Create job lookup maps
  const jobMap = new Map<string, string>();
  for (const j of envelope.jobs) {
    const label = j.job_id ? `${j.job_id} - ${j.title}` : j.title;
    jobMap.set(j.id, label);
  }

  // 1. Clients Sheet
  const clientRows = envelope.clients.map((c: Client) => ({
    "Client Name": c.name || "",
    Company: c.company || "",
    "Hiring Manager": c.hiring_manager || "",
    Email: c.email || "",
    Address: c.address || "",
    Notes: c.notes || "",
  }));
  const wsClients = XLSX.utils.json_to_sheet(
    clientRows.length > 0
      ? clientRows
      : [{ "Client Name": "", Company: "", "Hiring Manager": "", Email: "", Address: "", Notes: "" }]
  );
  wsClients["!cols"] = [
    { wch: 22 },
    { wch: 26 },
    { wch: 26 },
    { wch: 26 },
    { wch: 30 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsClients, "Clients");

  // 2. Jobs Sheet
  const jobRows = envelope.jobs.map((j: Job) => ({
    "Job Code / ID": j.job_id || "",
    "Client Name": clientMap.get(j.client_id) || "",
    "Job Title": j.title || "",
    Location: j.location || "",
    "Work Model": j.work_model || "",
    "Contract Type": j.contract_type || "",
    "Bill Rate": j.bill_rate || "",
    "Pay Rate": j.pay_rate || "",
    Status: j.status || "active",
    "Candidate Pitch": j.candidate_pitch || "",
    "Refined JD / Notes": j.refined_jd || j.notes || "",
  }));
  const wsJobs = XLSX.utils.json_to_sheet(
    jobRows.length > 0
      ? jobRows
      : [
          {
            "Job Code / ID": "",
            "Client Name": "",
            "Job Title": "",
            Location: "",
            "Work Model": "",
            "Contract Type": "",
            "Bill Rate": "",
            "Pay Rate": "",
            Status: "",
            "Candidate Pitch": "",
            "Refined JD / Notes": "",
          },
        ]
  );
  wsJobs["!cols"] = [
    { wch: 16 },
    { wch: 24 },
    { wch: 32 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 40 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsJobs, "Jobs");

  // 3. Candidates Sheet
  const candidateRows = envelope.candidates.map((c: Candidate) => ({
    "Candidate Name": c.name || "",
    "Job Code or Title": jobMap.get(c.job_id) || "",
    Email: c.email || "",
    Phone: c.phone || "",
    Location: c.location || "",
    "Current Title": c.current_title || "",
    "Current Company": c.current_company || "",
    "Experience (Years)": c.experience_years ?? "",
    Status: c.submission_status || "sourced",
    "Placed Date": c.placed_at || "",
    "Submitted At": c.submitted_at || "",
    "Interview At": c.interview_at || "",
    "Match Score": c.match_score ?? "",
    "LinkedIn URL": c.linkedin_url || "",
    "Recruiter Notes": c.recruiter_notes || "",
    "Screening Q&A Summary": extractScreeningSummary(c.screening_answers),
  }));
  const wsCandidates = XLSX.utils.json_to_sheet(
    candidateRows.length > 0
      ? candidateRows
      : [
          {
            "Candidate Name": "",
            "Job Code or Title": "",
            Email: "",
            Phone: "",
            Location: "",
            "Current Title": "",
            "Current Company": "",
            "Experience (Years)": "",
            Status: "",
            "Placed Date": "",
            "Submitted At": "",
            "Interview At": "",
            "Match Score": "",
            "LinkedIn URL": "",
            "Recruiter Notes": "",
            "Screening Q&A Summary": "",
          },
        ]
  );
  wsCandidates["!cols"] = [
    { wch: 22 },
    { wch: 30 },
    { wch: 26 },
    { wch: 18 },
    { wch: 18 },
    { wch: 26 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 30 },
    { wch: 40 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCandidates, "Candidates");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

export function generateSampleExcelTemplate(): Uint8Array {
  const sampleEnvelope: ExportEnvelope = {
    version: 1,
    exported_at: new Date().toISOString(),
    clients: [
      {
        id: "client-sample-1",
        name: "MassMutual",
        company: "MassMutual Financial Group",
        hiring_manager: "Sarah Thompson",
        email: "sarah@massmutual.com",
        address: "Springfield, MA",
        notes: "Key enterprise account. Fast feedback loop.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "client-sample-2",
        name: "Delta Systems",
        company: "Delta Systems Enterprise",
        hiring_manager: "Marcus Reed",
        email: "m.reed@deltasystems.com",
        address: "Atlanta, GA",
        notes: "Cloud consultancy account.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    jobs: [
      {
        id: "job-sample-1",
        client_id: "client-sample-1",
        job_id: "MM-2026-081",
        title: "Senior Full Stack React/Node Engineer",
        location: "Boston, MA",
        work_model: "Hybrid",
        contract_type: "W2 Contract",
        bill_rate: "$95/hr",
        pay_rate: "$75/hr",
        status: "active",
        refined_jd: "Lead React & Node microservices for digital platform.",
        boolean_strings: [],
        candidate_pitch: "Great culture, $75/hr rate, long-term contract.",
        screening_questions: [],
        notes: "2-step interview process.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closed_at: null,
      },
      {
        id: "job-sample-2",
        client_id: "client-sample-2",
        job_id: "DS-8802",
        title: "DevOps / Cloud Platform Engineer",
        location: "Atlanta, GA (Remote)",
        work_model: "Remote",
        contract_type: "Direct Hire",
        bill_rate: "$155,000/yr",
        pay_rate: "$140,000/yr",
        status: "active",
        refined_jd: "AWS, Terraform, and Kubernetes infrastructure.",
        boolean_strings: [],
        candidate_pitch: "100% remote with generous equity.",
        screening_questions: [],
        notes: "Target start date: next month.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closed_at: null,
      },
    ],
    candidates: [
      {
        id: "cand-sample-1",
        job_id: "job-sample-1",
        name: "Maya Lin",
        email: "maya.lin@example.com",
        phone: "+1 (617) 555-0142",
        location: "Boston, MA",
        current_title: "Senior Frontend Architect",
        current_company: "Stripe",
        experience_years: 8,
        resume_path: null,
        linkedin_url: "https://linkedin.com/in/maya-lin-demo",
        recruiter_notes: "Accepted offer! Start date confirmed.",
        match_score: 96,
        submission_status: "placed",
        interview_status: null,
        client_feedback: "Exceptional candidate.",
        candidate_status: "active",
        submitted_at: null,
        interview_at: null,
        placed_at: "2026-08-20",
        rejection_reason: null,
        screening_answers: "{\"0\":\"8 years commercial React\",\"1\":\"Heavy TanStack Query experience\"}",
        submission_details: null,
        date_added: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
      {
        id: "cand-sample-2",
        job_id: "job-sample-2",
        name: "Sarah Jenkins",
        email: "sarah.jenkins@example.com",
        phone: "+1 (404) 555-0163",
        location: "Atlanta, GA",
        current_title: "Cloud Platform Specialist",
        current_company: "Datadog",
        experience_years: 6,
        resume_path: null,
        linkedin_url: "https://linkedin.com/in/sarah-jenkins-demo",
        recruiter_notes: "Technical round scheduled with Cloud Lead.",
        match_score: 92,
        submission_status: "interview",
        interview_status: "Technical Round",
        client_feedback: null,
        candidate_status: "active",
        submitted_at: null,
        interview_at: "2026-08-23T11:00:00 EST",
        placed_at: null,
        rejection_reason: null,
        screening_answers: "{\"0\":\"AWS DevOps Pro Certified\"}",
        submission_details: null,
        date_added: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
    ],
  };

  return generateExcelWorkbook(sampleEnvelope);
}
