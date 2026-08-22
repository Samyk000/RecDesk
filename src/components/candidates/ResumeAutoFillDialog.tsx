import { useEffect, useState } from "react";
import {
  Lightning,
  CircleNotch,
  Check,
  User,
  EnvelopeSimple,
  Phone,
  MapPin,
  LinkedinLogo,
  Briefcase,
  Clock,
  Tag,
  FileText,
  ArrowRight,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { useParseResume } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/utils";
import type { ExtractedCandidateProfile } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (profile: ExtractedCandidateProfile) => void;
}

const SAMPLE_RESUME = `Alex Rivera
Senior Frontend Architect
Email: alex.rivera@example.com
Phone: (415) 555-0182
Location: San Francisco, CA
LinkedIn: https://linkedin.com/in/alex-rivera-dev

Summary:
Full stack and UI engineering specialist with 8 years of experience leading web application development across distributed teams.

Core Technical Skills:
React, TypeScript, Next.js, Node.js, Tailwind CSS, GraphQL, PostgreSQL, Docker, AWS, Jest.
`;

export function ResumeAutoFillDialog({ open, onOpenChange, onApply }: Props) {
  const [rawText, setRawText] = useState("");
  const [extracted, setExtracted] = useState<ExtractedCandidateProfile | null>(null);

  const parseMutation = useParseResume();

  // Reset text and extracted state whenever dialog opens to ensure a clean slate
  useEffect(() => {
    if (open) {
      setRawText("");
      setExtracted(null);
    }
  }, [open]);

  function handlePasteResumeSample() {
    setRawText(SAMPLE_RESUME);
    setExtracted(null);
  }

  function handleParse() {
    if (!rawText.trim()) {
      toast.error("Please paste resume text first");
      return;
    }

    parseMutation.mutate(rawText, {
      onSuccess: (data) => {
        setExtracted(data);
        toast.success("Resume details extracted successfully!");
      },
      onError: (err) => {
        toast.error(`Extraction failed: ${errorMessage(err)}`);
      },
    });
  }

  function handleApply() {
    if (!extracted) return;
    onApply(extracted);
    setRawText("");
    setExtracted(null);
    onOpenChange(false);
    toast.success("Candidate form auto-filled!");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-4 pr-12">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lightning className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-fg">
                Resume Auto-Fill
              </DialogTitle>
              <p className="text-xs text-fg-subtle">
                Paste raw resume text to auto-fill candidate fields in seconds.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4 scrollbar-thin">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-fg flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Raw Resume / CV Text
              </label>
              <button
                type="button"
                onClick={handlePasteResumeSample}
                className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
              >
                Paste Sample Resume
              </button>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (extracted) setExtracted(null);
              }}
              placeholder="Paste candidate resume or CV text here..."
              rows={5}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary scrollbar-thin resize-y"
            />
          </div>

          {/* Action Trigger */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="text-[11px] text-fg-subtle">
              Instant on-device extraction.
            </span>
            <Button
              size="sm"
              variant="primary"
              className="h-8 gap-1.5 px-3.5 text-xs font-medium cursor-pointer"
              onClick={handleParse}
              disabled={parseMutation.isPending || !rawText.trim()}
            >
              {parseMutation.isPending ? (
                <>
                  <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                  Extracting Fields…
                </>
              ) : (
                <>
                  <Lightning className="h-3.5 w-3.5" />
                  Extract Details
                </>
              )}
            </Button>
          </div>

          {/* Live Extraction Preview Card */}
          {extracted && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-primary/15 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                  <Check className="h-4 w-4" />
                  Extracted Details Review
                </span>
                <span className="text-[11px] text-fg-subtle">Check fields before applying</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Name */}
                <div className="flex items-center gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60">
                  <User className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                  <span className="text-fg-subtle shrink-0">Name:</span>
                  <span className="font-semibold text-fg truncate">{extracted.name || "—"}</span>
                </div>

                {/* Role */}
                <div className="flex items-center gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60">
                  <Briefcase className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                  <span className="text-fg-subtle shrink-0">Role:</span>
                  <span className="font-medium text-fg truncate">{extracted.current_role || "—"}</span>
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60">
                  <EnvelopeSimple className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                  <span className="text-fg-subtle shrink-0">Email:</span>
                  <span className="text-fg truncate">{extracted.email || "—"}</span>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60">
                  <Phone className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                  <span className="text-fg-subtle shrink-0">Phone:</span>
                  <span className="text-fg truncate">{extracted.phone || "—"}</span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60">
                  <MapPin className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                  <span className="text-fg-subtle shrink-0">Location:</span>
                  <span className="text-fg truncate">{extracted.location || "—"}</span>
                </div>

                {/* Experience */}
                <div className="flex items-center gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60">
                  <Clock className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                  <span className="text-fg-subtle shrink-0">Experience:</span>
                  <span className="text-fg font-medium">
                    {extracted.experience_years !== null && extracted.experience_years !== undefined
                      ? `${extracted.experience_years} Years`
                      : "—"}
                  </span>
                </div>

                {/* LinkedIn */}
                <div className="flex items-center gap-2 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60 sm:col-span-2">
                  <LinkedinLogo className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="text-fg-subtle shrink-0">LinkedIn:</span>
                  <span className="text-fg truncate">{extracted.linkedin_url || "—"}</span>
                </div>
              </div>

              {/* Skills Tags */}
              {extracted.skills && extracted.skills.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-medium text-fg-subtle flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Detected Skills ({extracted.skills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-thin">
                    {extracted.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply Action */}
              <div className="flex justify-end pt-2 border-t border-primary/15">
                <Button
                  size="sm"
                  variant="primary"
                  className="gap-1.5 px-4 text-xs font-semibold cursor-pointer shadow-raise"
                  onClick={handleApply}
                >
                  Apply to Form
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
