import * as XLSX from "xlsx";
import type { CandidateSubmissionStatus } from "../types";

export function normalizeHeaderKey(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const CLIENT_ALIASES: Record<string, string[]> = {
  name: ["name", "clientname", "client", "account", "accountname", "customer", "clientcompany", "organization"],
  company: ["company", "companyname", "legalname", "org", "business"],
  hiring_manager: ["hiringmanager", "manager", "hm", "contactperson", "pointofcontact", "poc", "lead"],
  email: ["email", "contactemail", "emailaddress", "mail", "manageremail"],
  address: ["address", "location", "office", "headquarters", "citystate", "hq"],
  notes: ["notes", "note", "description", "details", "comments", "accountnotes"],
};

export const JOB_ALIASES: Record<string, string[]> = {
  job_id: ["jobid", "jobcode", "reqid", "reqnumber", "code", "id", "requisition", "req"],
  client: ["client", "clientname", "company", "companyname", "account", "clientid"],
  title: ["title", "jobtitle", "position", "role", "designation", "job", "opening"],
  location: ["location", "city", "joblocation", "workplace", "citystate"],
  work_model: ["workmodel", "model", "worktype", "remotehybrid", "remotetype", "arrangement"],
  contract_type: ["contracttype", "engagementtype", "type", "employmenttype", "w2c2c", "terms", "contract"],
  bill_rate: ["billrate", "clientrate", "bill", "billing", "billraterange"],
  pay_rate: ["payrate", "candidaterate", "pay", "rate", "salary", "comp", "targetpay"],
  status: ["status", "jobstatus", "state", "active", "statusstage"],
  candidate_pitch: ["candidatepitch", "pitch", "elevatorpitch", "pitchsummary", "jobpitch"],
  refined_jd: ["refinedjd", "jd", "jobdescription", "description", "scope", "overview"],
  notes: ["notes", "note", "internalnotes", "jobnotes", "comments"],
};

export const CANDIDATE_ALIASES: Record<string, string[]> = {
  name: ["name", "candidatename", "fullname", "applicantname", "applicant", "candidate", "talent"],
  job: ["job", "jobcode", "jobtitle", "jobid", "position", "role", "reqid", "reqnumber", "requisition"],
  email: ["email", "candidateemail", "emailaddress", "mail", "contactemail"],
  phone: ["phone", "phonenumber", "mobile", "cell", "contactnumber", "telephone", "contact"],
  location: ["location", "city", "candidatelocation", "residence", "citystate", "currentcity"],
  current_title: ["currenttitle", "title", "currentrole", "designation", "profession", "jobtitle"],
  current_company: ["currentcompany", "company", "employer", "currentemployer", "organization", "organizationname"],
  experience_years: ["experienceyears", "experience", "yearsofexperience", "yoe", "exp", "expyears", "totalexperience"],
  submission_status: ["status", "submissionstatus", "pipelinestatus", "stage", "candidatestatus", "currentstage"],
  submitted_at: ["submittedat", "datesubmitted", "submissiondate", "subdate", "submittedon"],
  interview_at: ["interviewat", "interviewdate", "dateinterview", "interviewtime", "scheduledfor", "interviewscheduled"],
  placed_at: ["placedat", "dateplaced", "placementdate", "hiredate", "startdate", "placedon"],
  match_score: ["matchscore", "score", "match", "rating", "matchpercentage", "scorepercentage"],
  linkedin_url: ["linkedinurl", "linkedin", "linkedinprofile", "profileurl", "social", "url"],
  recruiter_notes: ["recruiternotes", "notes", "comments", "feedback", "remarks", "note", "recruiterfeedback"],
  screening_summary: ["screeningsummary", "screeninganswers", "screening", "qasummary", "answers", "screen"],
  client_feedback: ["clientfeedback", "feedback", "hmfeedback", "clientcomments"],
  rejection_reason: ["rejectionreason", "rejectreason", "reason", "declinereason"],
};

export function matchFieldKey(rawHeader: string, aliasMap: Record<string, string[]>): string | null {
  const norm = normalizeHeaderKey(rawHeader);
  if (!norm) return null;
  for (const [targetKey, aliases] of Object.entries(aliasMap)) {
    if (targetKey === norm || aliases.includes(norm)) {
      return targetKey;
    }
  }
  return null;
}

export function parseExcelDate(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number" && val > 20000 && val < 60000) {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      if (d) {
        const y = String(d.y).padStart(4, "0");
        const m = String(d.m).padStart(2, "0");
        const day = String(d.d).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
    } catch {
      // fallback
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (!str) return null;
  // If already standard ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  // Try parsing MM/DD/YYYY or DD/MM/YYYY
  const mdy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (mdy) {
    const [, p1, p2, year] = mdy;
    const month = String(Math.min(12, Number(p1))).padStart(2, "0");
    const day = String(Math.min(31, Number(p2))).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  // Fallback Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return str;
}

export function parseExperienceYears(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Math.max(0, Math.round(val));
  const str = String(val).trim();
  const match = str.match(/(\d+(\.\d+)?)/);
  return match ? Math.max(0, Math.round(Number(match[1]))) : null;
}

export function parseMatchScore(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Math.min(100, Math.max(0, Math.round(val)));
  const str = String(val).trim();
  const match = str.match(/(\d+)/);
  return match ? Math.min(100, Math.max(0, Number(match[1]))) : null;
}

export function normalizeCandidateStatus(raw: unknown): CandidateSubmissionStatus {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "sourced";
  if (s.includes("place") || s.includes("hire") || s.includes("select") || s.includes("offer accept")) {
    return "placed";
  }
  if (s.includes("interview") || s.includes("screen") || s.includes("panel") || s.includes("call")) {
    return "interview";
  }
  if (s.includes("sub") || s.includes("sent")) {
    return "submitted";
  }
  if (s.includes("touch") || s.includes("reach") || s.includes("contact")) {
    return "in_touch";
  }
  if (s.includes("not inter") || s.includes("pass") || s.includes("decline")) {
    return "not_interested";
  }
  if (s.includes("reject") || s.includes("deny")) {
    return "rejected";
  }
  return "sourced";
}
