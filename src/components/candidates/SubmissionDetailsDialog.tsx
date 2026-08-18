import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleNotch,
  Clock,
  Copy,
  IdentificationCard,
  Sparkle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useCandidate, useUpdateCandidate } from "../../hooks/useQueries";
import { useDebounce } from "../../hooks/useDebounce";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Spinner } from "../common/Spinner";
import { errorMessage } from "../../lib/utils";
import type { Candidate } from "../../types";

interface Props {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FieldDef {
  key: string;
  label: string;
  defaultVal: string;
  type?: "text" | "textarea" | "rtr";
  fromCandidate?: (c: Candidate) => string | null | undefined;
}

const SUBMISSION_FIELDS: FieldDef[] = [
  {
    key: "legal_name",
    label: "Legal Name (first, last):",
    defaultVal: "",
    fromCandidate: (c) => c.name,
  },
  {
    key: "phone",
    label: "Phone H/C:",
    defaultVal: "",
    fromCandidate: (c) => c.phone,
  },
  {
    key: "email",
    label: "Email:",
    defaultVal: "",
    fromCandidate: (c) => c.email,
  },
  {
    key: "linkedin",
    label: "LinkedIn:",
    defaultVal: "",
    fromCandidate: (c) => c.linkedin_url,
  },
  {
    key: "work_status",
    label: "Work Status:",
    defaultVal: "",
  },
  {
    key: "dob",
    label: "DOB (Month & Day):",
    defaultVal: "",
  },
  {
    key: "sin_last4",
    label: "SIN (Last 4 digits):",
    defaultVal: "",
  },
  {
    key: "tax_term",
    label: "T4/W2 or C2C/Incorp:",
    defaultVal: "W2",
  },
  {
    key: "pay_rate",
    label: "Pay Rate/Salary:",
    defaultVal: "",
  },
  {
    key: "location",
    label: "Location:",
    defaultVal: "",
    fromCandidate: (c) => c.location,
  },
  {
    key: "communication_skills",
    label: "Communication Skills:",
    defaultVal: "Excellent",
  },
  {
    key: "availability_start",
    label: "Availability to start:",
    defaultVal: "Within 2 weeks",
  },
  {
    key: "availability_interview",
    label: "Availability for a phone interview:",
    defaultVal: "24 hours’ notice",
  },
  {
    key: "resignation_form",
    label: "Ok to sign Previous Company Resignation form",
    defaultVal: "Yes",
  },
  {
    key: "credit_check",
    label: "Ok with Credit check – clear credit",
    defaultVal: "Yes",
  },
  {
    key: "rtr_timestamp",
    label: "RTR (date and time stamp)",
    defaultVal: "",
    type: "rtr",
  },
  {
    key: "business_insurance",
    label: "Business Insurance",
    defaultVal: "---",
  },
  {
    key: "resume_permission",
    label:
      "Do I have your permission to edit your resume, highlight relevant experience, align job titles with the client's requirements, and share the final version with you for approval before submission?",
    defaultVal: "Yes",
    type: "textarea",
  },
  {
    key: "fte_or_contract",
    label: "Currently in FTE or contract?",
    defaultVal: "Contract",
  },
  {
    key: "contract_extension_info",
    label: "Contract-extension chances/current rate/range of the rate",
    defaultVal: "Current project ending",
    type: "textarea",
  },
  {
    key: "fte_salary_reason",
    label: "FTE-Salary-why are they ok to leave FTE for contract with no benefits?",
    defaultVal: "--",
  },
  {
    key: "interview_commitment",
    label: `Availability for interview:
We can submit only two candidates for this opportunity. Before I submit your profile, I want to ensure this is one of your top priorities. If selected, will you remain available over the next 2 weeks, respond to interview requests within 2 hours, and actively participate throughout the interview process?

If possible, please also share an emergency contact number (optional) in case we're unable to reach you regarding an interview invitation.

If you're not highly interested or cannot commit to this level of availability, I completely understand and would rather reserve the submission for another candidate.`,
    defaultVal: "Yes",
    type: "textarea",
  },
  {
    key: "other_interviews_pipeline",
    label: "Another interview/offer pipeline",
    defaultVal: "Yes, interviews in pipeline, no offers",
    type: "textarea",
  },
  {
    key: "role_comparison",
    label: "How does our role compare with others they are considering",
    defaultVal: "Nothing in hand yet",
    type: "textarea",
  },
];

export function SubmissionDetailsDialog({ candidateId, open, onOpenChange }: Props) {
  const { data: candidate, isLoading } = useCandidate(open ? candidateId : undefined);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-4xl overflow-hidden p-0 flex flex-col">
        {isLoading || !candidate ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <SubmissionDetailsBody candidate={candidate} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseSubmissionDetails(
  candidate: Candidate,
): Record<string, string> {
  let saved: Record<string, string> = {};
  if (candidate.submission_details) {
    try {
      const parsed = JSON.parse(candidate.submission_details);
      if (typeof parsed === "object" && parsed !== null) {
        saved = parsed;
      }
    } catch {
      // Ignore
    }
  }

  const result: Record<string, string> = {};
  for (const field of SUBMISSION_FIELDS) {
    if (saved[field.key] !== undefined && saved[field.key] !== null) {
      result[field.key] = saved[field.key];
    } else {
      const candVal = field.fromCandidate ? field.fromCandidate(candidate) : null;
      result[field.key] = candVal || field.defaultVal;
    }
  }
  return result;
}

function formatCurrentTimestamp(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tzName =
    Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value || "EST";
  return `${dateStr} ${timeStr} ${tzName}`;
}

function SubmissionDetailsBody({ candidate }: { candidate: Candidate }) {
  const updateCandidate = useUpdateCandidate();
  const initialValues = useMemo(() => parseSubmissionDetails(candidate), [candidate.id]);
  const [details, setDetails] = useState<Record<string, string>>(initialValues);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasCopied, setHasCopied] = useState(false);

  const debouncedDetails = useDebounce(details, 600);

  useEffect(() => {
    setDetails(parseSubmissionDetails(candidate));
  }, [candidate.id]);

  // Autosave when values change
  useEffect(() => {
    const prevRaw = candidate.submission_details || "{}";
    const nextRaw = JSON.stringify(debouncedDetails);
    if (prevRaw === nextRaw) return;

    setSaveState("saving");
    updateCandidate.mutate(
      {
        id: candidate.id,
        input: {
          job_id: candidate.job_id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          location: candidate.location,
          current_title: candidate.current_title,
          current_company: candidate.current_company,
          experience_years: candidate.experience_years,
          resume_path: candidate.resume_path,
          linkedin_url: candidate.linkedin_url,
          recruiter_notes: candidate.recruiter_notes,
          match_score: candidate.match_score,
          submission_status: candidate.submission_status,
          interview_status: candidate.interview_status,
          client_feedback: candidate.client_feedback,
          candidate_status: candidate.candidate_status,
          submitted_at: candidate.submitted_at,
          interview_at: candidate.interview_at,
          rejection_reason: candidate.rejection_reason,
          screening_answers: candidate.screening_answers,
          submission_details: nextRaw,
        },
      },
      {
        onSuccess: () => {
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 1800);
        },
        onError: (err) => {
          setSaveState("idle");
          toast.error(errorMessage(err));
        },
      },
    );
  }, [debouncedDetails]);

  const handleChange = (key: string, value: string) => {
    setDetails((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const stampRTR = () => {
    const stamped = formatCurrentTimestamp();
    handleChange("rtr_timestamp", stamped);
    toast.success(`RTR stamped: ${stamped}`);
  };

  // Build rich HTML table & plain text table for clipboard
  const handleCopyTable = async () => {
    // 1. Generate clean HTML table
    const rowsHtml = SUBMISSION_FIELDS.map((f) => {
      const val = (details[f.key] || "").trim();
      const formattedLabel = f.label.replace(/\n/g, "<br/>");
      const formattedVal = val.replace(/\n/g, "<br/>") || "&nbsp;";
      return `<tr>
  <td style="border: 1px solid #d1d5db; padding: 6px 10px; font-weight: 600; vertical-align: top; background-color: #fafafa; width: 45%;">${formattedLabel}</td>
  <td style="border: 1px solid #d1d5db; padding: 6px 10px; vertical-align: top; width: 55%;">${formattedVal}</td>
</tr>`;
    }).join("\n");

    const fullHtml = `<table style="border-collapse: collapse; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #111827; line-height: 1.4;">
  <thead>
    <tr>
      <th colspan="2" style="border: 1px solid #d1d5db; background-color: #f3f4f6; padding: 8px 10px; text-align: left; font-weight: 700; font-size: 13.5px;">Candidate Details:</th>
    </tr>
  </thead>
  <tbody>
${rowsHtml}
  </tbody>
</table>`;

    // 2. Generate clean Plain Text table
    const plainRows = SUBMISSION_FIELDS.map((f) => {
      const val = (details[f.key] || "").trim();
      return `${f.label}\t${val}`;
    }).join("\n");
    const fullText = `Candidate Details:\n${plainRows}`;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([fullHtml], { type: "text/html" });
        const textBlob = new Blob([fullText], { type: "text/plain" });
        const clipboardItem = new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        await navigator.clipboard.writeText(fullText);
      }
      setHasCopied(true);
      toast.success("Candidate Details table copied to clipboard!");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy table to clipboard");
    }
  };

  return (
    <>
      {/* Header bar - with pr-12 to reserve space for native Dialog close button */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-surface pr-12">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IdentificationCard className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-[14px] font-semibold text-fg flex items-center gap-1.5 truncate">
              <span className="truncate">{candidate.name}</span>
              <span className="text-xs font-normal text-fg-subtle">·</span>
              <span className="text-xs font-normal text-fg-muted">Candidate Details Table</span>
            </DialogTitle>
            <p className="text-[11px] text-fg-subtle">
              Submission & RTR information · Fits table format when pasted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveState === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <CircleNotch className="h-3 w-3 animate-spin text-primary" />
              Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}

          <Button
            size="sm"
            variant="primary"
            onClick={handleCopyTable}
            className="h-7 gap-1.5 px-3 text-xs shadow-sm font-medium"
          >
            {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {hasCopied ? "Copied Table!" : "Copy Table"}
          </Button>
        </div>
      </div>

      {/* 2-Column Table Form */}
      <div className="flex-1 overflow-y-auto p-4 bg-background scrollbar-thin">
        <div className="rounded-lg border border-border bg-surface shadow-xs overflow-hidden">
          <div className="bg-surface-hover/60 px-4 py-2 border-b border-border text-[12.5px] font-semibold text-fg flex items-center gap-1.5">
            <Sparkle className="h-3.5 w-3.5 text-primary" />
            <span>Candidate Details:</span>
          </div>

          <div className="divide-y divide-border">
            {SUBMISSION_FIELDS.map((f, idx) => {
              const val = details[f.key] || "";
              const isRtr = f.type === "rtr";
              const isTextarea = f.type === "textarea";

              return (
                <div
                  key={f.key}
                  className={`grid grid-cols-12 items-center transition-colors hover:bg-surface-hover/30 ${
                    idx % 2 === 1 ? "bg-surface-hover/10" : ""
                  }`}
                >
                  {/* Left Column: Label */}
                  <div className="col-span-5 p-2.5 sm:p-3 border-r border-border self-stretch flex items-center">
                    <p className="text-[12px] font-medium text-fg whitespace-pre-line leading-snug">
                      {f.label}
                    </p>
                  </div>

                  {/* Right Column: Input / Details */}
                  <div className="col-span-7 p-2 sm:p-2.5">
                    {isRtr ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleChange(f.key, e.target.value)}
                          placeholder="e.g. Aug 19, 2026 10:30 AM EST"
                          className="h-8 flex-1 rounded border border-border/70 bg-background/80 px-2.5 text-[12px] text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={stampRTR}
                          className="h-8 shrink-0 gap-1 text-[11px] px-2.5 font-medium"
                          title="Stamp current date, time, and timezone"
                        >
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          Stamp Now
                        </Button>
                      </div>
                    ) : isTextarea ? (
                      <textarea
                        rows={2}
                        value={val}
                        onChange={(e) => handleChange(f.key, e.target.value)}
                        placeholder="Enter details…"
                        className="w-full min-h-[36px] resize-y rounded border border-border/70 bg-background/80 px-2.5 py-1.5 text-[12px] leading-relaxed text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleChange(f.key, e.target.value)}
                        placeholder="Enter details…"
                        className="h-8 w-full rounded border border-border/70 bg-background/80 px-2.5 text-[12px] text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
