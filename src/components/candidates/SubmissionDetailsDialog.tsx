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
import { errorMessage } from "../../lib/utils";
import { toCandidateInput } from "../../lib/candidateUtils";
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

export function SubmissionDetailsDialog({ candidateId, open, onOpenChange }: Props) {
  const { data: candidate, isLoading } = useCandidate(open ? candidateId : undefined);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-[650px] overflow-hidden p-0 flex flex-col">
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
    (localStorage.getItem("recdesk_default_tz") as string) || "EST";
  return `${dateStr} ${timeStr} ${tzName}`;
}

function SubmissionDetailsBody({ candidate }: { candidate: Candidate }) {
  const updateCandidate = useUpdateCandidate();
  const initialRows = useMemo(() => parseSubmissionRows(candidate), [candidate.id]);
  const [rows, setRows] = useState<SubmissionRowItem[]>(initialRows);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasCopied, setHasCopied] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

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
        input: toCandidateInput(candidate, {
          submission_details: nextRaw,
        }),
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
    // 1. Generate clean HTML table with compact fixed width for Word/Emails
    const rowsHtml = rows
      .map((r) => {
        const val = (r.value || "").trim();
        const formattedLabel = r.label.replace(/\n/g, "<br/>");
        const formattedVal = val.replace(/\n/g, "<br/>") || "&nbsp;";
        return `<tr>
  <td style="border: 1px solid #d1d5db; padding: 5px 9px; font-weight: 600; vertical-align: top; background-color: #fafafa; width: 200px; max-width: 200px;">${formattedLabel}</td>
  <td style="border: 1px solid #d1d5db; padding: 5px 9px; vertical-align: top; width: 360px; max-width: 360px;">${formattedVal}</td>
</tr>`;
      })
      .join("\n");

    const fullHtml = `<table style="border-collapse: collapse; width: 560px; max-width: 560px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; color: #111827; line-height: 1.35;">
  <thead>
    <tr>
      <th colspan="2" style="border: 1px solid #d1d5db; background-color: #f3f4f6; padding: 6px 10px; text-align: left; font-weight: 700; font-size: 13px;">Candidate Details:</th>
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

  return (
    <>
      {/* Header bar - with Copy Table button placed directly left of the close icon */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3 pr-11">
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
              Editable submission fields
            </p>
          </div>
        </div>

        {/* Action Controls: Autosave Badge + Copy Table Button */}
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

          {/* Copy Table Button - positioned next to close icon */}
          <Button
            size="sm"
            variant="primary"
            onClick={handleCopyTable}
            className="h-7 gap-1.5 px-3 text-xs shadow-sm font-medium cursor-pointer"
          >
            {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {hasCopied ? "Copied Table!" : "Copy Table"}
          </Button>
        </div>
      </div>

      {/* 2-Column Table Form */}
      <div className="flex-1 overflow-y-auto p-3.5 bg-background scrollbar-thin">
        <div className="rounded-lg border border-border bg-surface shadow-xs overflow-hidden">
          <div className="bg-surface-hover/60 px-3.5 py-1.5 border-b border-border text-[12px] font-semibold text-fg flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkle className="h-3.5 w-3.5 text-primary" />
              <span>Candidate Details:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center gap-1 text-[10.5px] text-fg-subtle hover:text-fg transition-colors cursor-pointer"
                title="Reset rows to standard template"
              >
                <ArrowCounterClockwise className="h-3 w-3" />
                <span>Reset Template</span>
              </button>
              <span className="text-border text-xs">|</span>
              <span className="text-[10.5px] text-fg-subtle">{rows.length} rows</span>
            </div>
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
                  className={`group relative flex items-center transition-colors hover:bg-surface-hover/30 ${
                    idx % 2 === 1 ? "bg-surface-hover/10" : ""
                  }`}
                >
                  {/* Left Column: Label (35% width) */}
                  <div className="w-[35%] shrink-0 p-2 sm:p-2.5 border-r border-border self-stretch flex items-center justify-between gap-1">
                    {isEditingLabel ? (
                      <div className="flex flex-1 items-center gap-1">
                        <textarea
                          rows={2}
                          value={r.label}
                          onChange={(e) => handleLabelChange(r.id, e.target.value)}
                          onBlur={() => setEditingLabelId(null)}
                          autoFocus
                          placeholder="Field label…"
                          className="w-full rounded border border-primary bg-background px-1.5 py-0.5 text-[11px] font-medium text-fg outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingLabelId(null)}
                          className="rounded p-0.5 text-primary hover:bg-primary/10 cursor-pointer"
                          title="Done editing label"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setEditingLabelId(r.id)}
                        className="group/lbl flex flex-1 items-center justify-between gap-1 cursor-pointer select-none rounded px-1 py-0.5 -mx-1 hover:bg-surface-hover/60"
                        title="Click to edit field label"
                      >
                        <p className="text-[11.5px] font-medium text-fg whitespace-pre-line leading-snug">
                          {r.label}
                        </p>
                        <PencilSimple className="h-2.5 w-2.5 text-fg-subtle/0 group-hover/lbl:text-fg-subtle shrink-0 transition-opacity" />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Input / Details (65% width) */}
                  <div className="w-[65%] min-w-0 p-1.5 sm:p-2 relative flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      {isRtr ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleValueChange(r.id, e.target.value)}
                            placeholder="e.g. Aug 19, 2026 10:30 AM EST"
                            className="h-7.5 flex-1 rounded border border-border/70 bg-background/80 px-2 text-[11.5px] text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => stampRTR(r.id)}
                            className="h-7.5 shrink-0 gap-1 text-[10.5px] px-2 font-medium"
                            title="Stamp current date, time, and timezone"
                          >
                            <Clock className="h-3 w-3 text-primary" />
                            Stamp
                          </Button>
                        </div>
                      ) : isTextarea ? (
                        <textarea
                          rows={2}
                          value={val}
                          onChange={(e) => handleValueChange(r.id, e.target.value)}
                          placeholder="Enter details…"
                          className="w-full min-h-[32px] resize-y rounded border border-border/70 bg-background/80 px-2 py-1 text-[11.5px] leading-relaxed text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleValueChange(r.id, e.target.value)}
                          placeholder="Enter details…"
                          className="h-7.5 w-full rounded border border-border/70 bg-background/80 px-2 text-[11.5px] text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                        />
                      )}
                    </div>

                    {/* Row Order & Delete Tools on Hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveRow(idx, "up")}
                        className="p-0.5 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        title="Move row up"
                      >
                        <CaretUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === rows.length - 1}
                        onClick={() => handleMoveRow(idx, "down")}
                        className="p-0.5 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        title="Move row down"
                      >
                        <CaretDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(r.id)}
                        className="p-0.5 rounded text-red-500/70 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                        title="Delete this row"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Row Button at bottom of table */}
          <div className="p-2.5 bg-surface-hover/30 border-t border-border flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddRow}
              className="h-7.5 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 border-primary/30 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add New Row / Field
            </Button>
            <span className="text-[10.5px] text-fg-subtle">
              Autosaves continuously · Formatted for client submission
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
