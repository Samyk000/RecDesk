import { useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  Check,
  CircleNotch,
  Clock,
  Copy,
  IdentificationCard,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useCandidate, useUpdateCandidate } from "../../hooks/useQueries";
import { useDebounce } from "../../hooks/useDebounce";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Spinner } from "../common/Spinner";
import { cn, errorMessage } from "../../lib/utils";
import type { Candidate } from "../../types";

interface Props {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SubmissionRowItem {
  id: string;
  key: string;
  label: string;
  value: string;
  type?: "text" | "textarea" | "rtr";
}

interface DefaultFieldDef {
  key: string;
  label: string;
  defaultVal: string;
  type?: "text" | "textarea" | "rtr";
  fromCandidate?: (c: Candidate) => string | null | undefined;
}

const DEFAULT_SUBMISSION_FIELDS: DefaultFieldDef[] = [
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

type DialogWidthPreset = "compact" | "standard" | "wide";
type ColumnRatioPreset = "35-65" | "45-55" | "50-50";

export function SubmissionDetailsDialog({ candidateId, open, onOpenChange }: Props) {
  const { data: candidate, isLoading } = useCandidate(open ? candidateId : undefined);

  // Width preset persisted in localStorage
  const [widthPreset, setWidthPreset] = useState<DialogWidthPreset>(() => {
    return (localStorage.getItem("recdesk_details_dialog_width") as DialogWidthPreset) || "compact";
  });

  const handleSetWidth = (w: DialogWidthPreset) => {
    setWidthPreset(w);
    localStorage.setItem("recdesk_details_dialog_width", w);
  };

  if (!open) return null;

  const maxWidthClass =
    widthPreset === "compact"
      ? "max-w-2xl" // ~672px (clean, compact, no excess space)
      : widthPreset === "standard"
        ? "max-w-3xl" // ~768px
        : "max-w-4xl"; // ~896px

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[92vh] w-full overflow-hidden p-0 flex flex-col transition-all duration-200", maxWidthClass)}>
        {isLoading || !candidate ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <SubmissionDetailsBody
            candidate={candidate}
            widthPreset={widthPreset}
            onSetWidth={handleSetWidth}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseSubmissionRows(candidate: Candidate): SubmissionRowItem[] {
  if (candidate.submission_details) {
    try {
      const parsed = JSON.parse(candidate.submission_details);

      // New array format
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, idx: number) => ({
          id: item.id || `row_${idx}_${Date.now()}`,
          key: item.key || `custom_${idx}`,
          label: item.label || "",
          value: item.value || "",
          type: item.type || (item.label && item.label.length > 60 ? "textarea" : "text"),
        }));
      }

      // Legacy object format -> migrate to array
      if (typeof parsed === "object" && parsed !== null) {
        return DEFAULT_SUBMISSION_FIELDS.map((field, idx) => {
          const val =
            parsed[field.key] !== undefined && parsed[field.key] !== null
              ? parsed[field.key]
              : field.fromCandidate
                ? field.fromCandidate(candidate) || field.defaultVal
                : field.defaultVal;

          return {
            id: `field_${field.key}_${idx}`,
            key: field.key,
            label: field.label,
            value: val,
            type: field.type || (field.label.length > 60 ? "textarea" : "text"),
          };
        });
      }
    } catch {
      // fallback to defaults below
    }
  }

  // Initial fresh setup from default schema
  return DEFAULT_SUBMISSION_FIELDS.map((field, idx) => ({
    id: `field_${field.key}_${idx}`,
    key: field.key,
    label: field.label,
    value: field.fromCandidate
      ? field.fromCandidate(candidate) || field.defaultVal
      : field.defaultVal,
    type: field.type || (field.label.length > 60 ? "textarea" : "text"),
  }));
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

function SubmissionDetailsBody({
  candidate,
  widthPreset,
  onSetWidth,
}: {
  candidate: Candidate;
  widthPreset: DialogWidthPreset;
  onSetWidth: (w: DialogWidthPreset) => void;
}) {
  const updateCandidate = useUpdateCandidate();
  const initialRows = useMemo(() => parseSubmissionRows(candidate), [candidate.id]);
  const [rows, setRows] = useState<SubmissionRowItem[]>(initialRows);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasCopied, setHasCopied] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

  // Column split ratio (persisted in localStorage)
  const [colRatio, setColRatio] = useState<ColumnRatioPreset>(() => {
    return (localStorage.getItem("recdesk_details_col_ratio") as ColumnRatioPreset) || "45-55";
  });

  const handleSetRatio = (r: ColumnRatioPreset) => {
    setColRatio(r);
    localStorage.setItem("recdesk_details_col_ratio", r);
  };

  const debouncedRows = useDebounce(rows, 600);

  useEffect(() => {
    setRows(parseSubmissionRows(candidate));
  }, [candidate.id]);

  // Autosave when rows or content change
  useEffect(() => {
    const prevRaw = candidate.submission_details || "[]";
    const nextRaw = JSON.stringify(debouncedRows);
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
  }, [debouncedRows]);

  // Handlers for modifying rows
  const handleValueChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, value } : r)),
    );
  };

  const handleLabelChange = (id: string, label: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label } : r)),
    );
  };

  const handleAddRow = () => {
    const newId = `custom_${Date.now()}`;
    const newRow: SubmissionRowItem = {
      id: newId,
      key: newId,
      label: "New Field Label:",
      value: "",
      type: "text",
    };
    setRows((prev) => [...prev, newRow]);
    setEditingLabelId(newId);
    toast.success("Added new row to table");
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Row removed");
  };

  const handleMoveRow = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === rows.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset all table rows to the default recruitment submission fields?")) {
      const defaults = DEFAULT_SUBMISSION_FIELDS.map((field, idx) => ({
        id: `field_${field.key}_${idx}`,
        key: field.key,
        label: field.label,
        value: field.fromCandidate
          ? field.fromCandidate(candidate) || field.defaultVal
          : field.defaultVal,
        type: field.type || (field.label.length > 60 ? "textarea" : "text"),
      }));
      setRows(defaults);
      toast.success("Table reset to standard template");
    }
  };

  const stampRTR = (id: string) => {
    const stamped = formatCurrentTimestamp();
    handleValueChange(id, stamped);
    toast.success(`RTR stamped: ${stamped}`);
  };

  // Build clean HTML table & Plain text table for clipboard
  const handleCopyTable = async () => {
    // 1. Generate clean HTML table
    const rowsHtml = rows
      .map((r) => {
        const val = (r.value || "").trim();
        const formattedLabel = r.label.replace(/\n/g, "<br/>");
        const formattedVal = val.replace(/\n/g, "<br/>") || "&nbsp;";
        return `<tr>
  <td style="border: 1px solid #d1d5db; padding: 6px 10px; font-weight: 600; vertical-align: top; background-color: #fafafa; width: ${colRatio === "35-65" ? "35%" : colRatio === "50-50" ? "50%" : "45%"};">${formattedLabel}</td>
  <td style="border: 1px solid #d1d5db; padding: 6px 10px; vertical-align: top; width: ${colRatio === "35-65" ? "65%" : colRatio === "50-50" ? "50%" : "55%"};">${formattedVal}</td>
</tr>`;
      })
      .join("\n");

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
    const plainRows = rows
      .map((r) => {
        const val = (r.value || "").trim();
        return `${r.label}\t${val}`;
      })
      .join("\n");
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

  // Grid column classes based on selected column split ratio
  const labelColClass =
    colRatio === "35-65" ? "col-span-4" : colRatio === "50-50" ? "col-span-6" : "col-span-5";
  const valueColClass =
    colRatio === "35-65" ? "col-span-8" : colRatio === "50-50" ? "col-span-6" : "col-span-7";

  return (
    <>
      {/* Header bar - with pr-12 to reserve space for native Dialog close button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3 pr-12">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IdentificationCard className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-[13.5px] font-semibold text-fg flex items-center gap-1.5 truncate">
              <span className="truncate">{candidate.name}</span>
              <span className="text-xs font-normal text-fg-subtle">·</span>
              <span className="text-xs font-normal text-fg-muted">Candidate Details Table</span>
            </DialogTitle>
            <p className="text-[11px] text-fg-subtle">
              Editable submission fields · Copy table for emails & client submissions
            </p>
          </div>
        </div>

        {/* Action Controls & Width Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Table Width Controls */}
          <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => onSetWidth("compact")}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                widthPreset === "compact"
                  ? "bg-surface text-fg shadow-2xs font-semibold"
                  : "text-fg-subtle hover:text-fg",
              )}
              title="Compact width (~670px)"
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => onSetWidth("standard")}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                widthPreset === "standard"
                  ? "bg-surface text-fg shadow-2xs font-semibold"
                  : "text-fg-subtle hover:text-fg",
              )}
              title="Standard width (~770px)"
            >
              Medium
            </button>
            <button
              type="button"
              onClick={() => onSetWidth("wide")}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                widthPreset === "wide"
                  ? "bg-surface text-fg shadow-2xs font-semibold"
                  : "text-fg-subtle hover:text-fg",
              )}
              title="Wide width (~900px)"
            >
              Wide
            </button>
          </div>

          {/* Autosave Indicator */}
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

          {/* Copy Table Button */}
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

      {/* Toolbar for column split ratio & table actions */}
      <div className="flex items-center justify-between border-b border-border/60 bg-surface-hover/30 px-5 py-1.5 text-[11.5px] text-fg-muted">
        <div className="flex items-center gap-2">
          <span className="text-fg-subtle text-[11px]">Column Ratio:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSetRatio("35-65")}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10.5px] transition-colors cursor-pointer",
                colRatio === "35-65"
                  ? "bg-surface font-semibold text-primary border border-border/70"
                  : "text-fg-subtle hover:text-fg",
              )}
            >
              35/65
            </button>
            <button
              type="button"
              onClick={() => handleSetRatio("45-55")}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10.5px] transition-colors cursor-pointer",
                colRatio === "45-55"
                  ? "bg-surface font-semibold text-primary border border-border/70"
                  : "text-fg-subtle hover:text-fg",
              )}
            >
              45/55
            </button>
            <button
              type="button"
              onClick={() => handleSetRatio("50-50")}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10.5px] transition-colors cursor-pointer",
                colRatio === "50-50"
                  ? "bg-surface font-semibold text-primary border border-border/70"
                  : "text-fg-subtle hover:text-fg",
              )}
            >
              50/50
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-[11px] text-fg-subtle hover:text-fg transition-colors cursor-pointer"
            title="Reset rows to standard template"
          >
            <ArrowCounterClockwise className="h-3 w-3" />
            <span>Reset Template</span>
          </button>
          <span className="text-border">|</span>
          <span className="text-[11px] text-fg-subtle">{rows.length} rows</span>
        </div>
      </div>

      {/* 2-Column Table Form with Row Controls */}
      <div className="flex-1 overflow-y-auto p-4 bg-background scrollbar-thin">
        <div className="rounded-lg border border-border bg-surface shadow-xs overflow-hidden">
          <div className="bg-surface-hover/60 px-4 py-2 border-b border-border text-[12.5px] font-semibold text-fg flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkle className="h-3.5 w-3.5 text-primary" />
              <span>Candidate Details:</span>
            </div>
            <span className="text-[10.5px] font-normal text-fg-subtle">
              Click any label to rename · Hover row for controls
            </span>
          </div>

          <div className="divide-y divide-border">
            {rows.map((r, idx) => {
              const val = r.value || "";
              const isRtr = r.type === "rtr" || r.key.includes("rtr");
              const isTextarea = r.type === "textarea" || r.label.length > 55 || val.includes("\n");
              const isEditingLabel = editingLabelId === r.id;

              return (
                <div
                  key={r.id}
                  className={`group relative grid grid-cols-12 items-center transition-colors hover:bg-surface-hover/30 ${
                    idx % 2 === 1 ? "bg-surface-hover/10" : ""
                  }`}
                >
                  {/* Left Column: Label (Editable) */}
                  <div
                    className={cn(
                      "p-2.5 sm:p-3 border-r border-border self-stretch flex items-center justify-between gap-1.5",
                      labelColClass,
                    )}
                  >
                    {isEditingLabel ? (
                      <div className="flex flex-1 items-center gap-1">
                        <textarea
                          rows={2}
                          value={r.label}
                          onChange={(e) => handleLabelChange(r.id, e.target.value)}
                          onBlur={() => setEditingLabelId(null)}
                          autoFocus
                          placeholder="Field label…"
                          className="w-full rounded border border-primary bg-background px-2 py-1 text-[11.5px] font-medium text-fg outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingLabelId(null)}
                          className="rounded p-1 text-primary hover:bg-primary/10 cursor-pointer"
                          title="Done editing label"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setEditingLabelId(r.id)}
                        className="group/lbl flex flex-1 items-center justify-between gap-1 cursor-pointer select-none rounded px-1 py-0.5 -mx-1 hover:bg-surface-hover/60"
                        title="Click to edit field label"
                      >
                        <p className="text-[12px] font-medium text-fg whitespace-pre-line leading-snug">
                          {r.label}
                        </p>
                        <PencilSimple className="h-3 w-3 text-fg-subtle/0 group-hover/lbl:text-fg-subtle shrink-0 transition-opacity" />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Input / Details with Row Action Hover Buttons */}
                  <div className={cn("p-2 sm:p-2.5 relative flex items-center gap-2", valueColClass)}>
                    <div className="flex-1 min-w-0">
                      {isRtr ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleValueChange(r.id, e.target.value)}
                            placeholder="e.g. Aug 19, 2026 10:30 AM EST"
                            className="h-8 flex-1 rounded border border-border/70 bg-background/80 px-2.5 text-[12px] text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => stampRTR(r.id)}
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
                          onChange={(e) => handleValueChange(r.id, e.target.value)}
                          placeholder="Enter details…"
                          className="w-full min-h-[36px] resize-y rounded border border-border/70 bg-background/80 px-2.5 py-1.5 text-[12px] leading-relaxed text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleValueChange(r.id, e.target.value)}
                          placeholder="Enter details…"
                          className="h-8 w-full rounded border border-border/70 bg-background/80 px-2.5 text-[12px] text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                        />
                      )}
                    </div>

                    {/* Row Order & Delete Tools on Hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveRow(idx, "up")}
                        className="p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        title="Move row up"
                      >
                        <CaretUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === rows.length - 1}
                        onClick={() => handleMoveRow(idx, "down")}
                        className="p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        title="Move row down"
                      >
                        <CaretDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(r.id)}
                        className="p-1 rounded text-red-500/70 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                        title="Delete this row"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Row Button at bottom of table */}
          <div className="p-3 bg-surface-hover/30 border-t border-border flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddRow}
              className="h-8 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
            >
              <Plus className="h-3.5 w-3.5" />
              Add New Row / Field
            </Button>
            <span className="text-[11px] text-fg-subtle">
              All changes autosave and format dynamically when copied.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
