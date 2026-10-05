import { useEffect, useState } from "react";
import {
  Lightning,
  EnvelopeSimple,
  Phone,
  MapPin,
  LinkedinLogo,
  Briefcase,
  Tag,
  Clock,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import type { Candidate, CandidateInput, ExtractedCandidateProfile } from "../../types";
import { getCandidateSkills, setCandidateSkills } from "../../lib/candidateUtils";

interface Props {
  candidate: Candidate;
  extracted: ExtractedCandidateProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (patch: Partial<CandidateInput>) => void;
}

export function ResumeProfileMergeDialog({
  candidate,
  extracted,
  open,
  onOpenChange,
  onApply,
}: Props) {
  const currentSkills = getCandidateSkills(candidate);

  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !extracted) return;

    const initialSelections: Record<string, boolean> = {};

    // Auto-select title if new or empty
    if (extracted.current_role) {
      initialSelections.current_title = true;
    }

    // Auto-select experience if extracted
    if (extracted.experience_years !== undefined && extracted.experience_years !== null) {
      initialSelections.experience_years = true;
    }

    // Auto-select location if extracted
    if (extracted.location) {
      initialSelections.location = !candidate.location || candidate.location !== extracted.location;
    }

    // Auto-select linkedin if extracted
    if (extracted.linkedin_url) {
      initialSelections.linkedin_url = !candidate.linkedin_url;
    }

    // Auto-select email if candidate email is empty
    if (extracted.email) {
      initialSelections.email = !candidate.email;
    }

    // Auto-select phone if candidate phone is empty
    if (extracted.phone) {
      initialSelections.phone = !candidate.phone;
    }

    // Auto-select skills if any detected
    if (extracted.skills && extracted.skills.length > 0) {
      initialSelections.skills = true;
    }

    setSelectedFields(initialSelections);
  }, [open, extracted, candidate]);

  if (!extracted) return null;

  const toggleField = (key: string) => {
    setSelectedFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = () => {
    setSelectedFields({
      current_title: Boolean(extracted.current_role),
      experience_years: extracted.experience_years !== undefined && extracted.experience_years !== null,
      location: Boolean(extracted.location),
      skills: Boolean(extracted.skills?.length),
      linkedin_url: Boolean(extracted.linkedin_url),
      email: Boolean(extracted.email),
      phone: Boolean(extracted.phone),
    });
  };

  const handleFillEmptyOnly = () => {
    setSelectedFields({
      current_title: !candidate.current_title && Boolean(extracted.current_role),
      experience_years: candidate.experience_years == null && extracted.experience_years != null,
      location: !candidate.location && Boolean(extracted.location),
      skills: currentSkills.length === 0 && Boolean(extracted.skills?.length),
      linkedin_url: !candidate.linkedin_url && Boolean(extracted.linkedin_url),
      email: !candidate.email && Boolean(extracted.email),
      phone: !candidate.phone && Boolean(extracted.phone),
    });
  };

  const handleConfirmApply = () => {
    const patch: Partial<CandidateInput> = {};

    if (selectedFields.current_title && extracted.current_role) {
      patch.current_title = extracted.current_role;
    }

    if (selectedFields.experience_years && extracted.experience_years != null) {
      patch.experience_years = extracted.experience_years;
    }

    if (selectedFields.location && extracted.location) {
      patch.location = extracted.location;
    }

    if (selectedFields.linkedin_url && extracted.linkedin_url) {
      patch.linkedin_url = extracted.linkedin_url;
    }

    if (selectedFields.email && extracted.email) {
      patch.email = extracted.email;
    }

    if (selectedFields.phone && extracted.phone) {
      patch.phone = extracted.phone;
    }

    if (selectedFields.skills && extracted.skills && extracted.skills.length > 0) {
      // Merge unique skills
      const combined = [...currentSkills, ...extracted.skills];
      patch.submission_details = setCandidateSkills(candidate.submission_details, combined);
    }

    onApply(patch);
    onOpenChange(false);
  };

  const selectedCount = Object.values(selectedFields).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-full max-w-[620px] overflow-hidden p-0 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface/90 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Lightning className="h-5 w-5" weight="fill" />
            </span>
            <div>
              <DialogTitle className="text-sm font-semibold text-fg">
                Auto-Fill Profile from Resume
              </DialogTitle>
              <DialogDescription className="text-xs text-fg-subtle">
                Review detected fields from resume for <strong>{candidate.name}</strong>
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFillEmptyOnly}
              className="h-7 text-[11px] px-2 text-fg-subtle hover:text-fg cursor-pointer"
            >
              Empty only
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-7 text-[11px] px-2 text-primary hover:bg-primary/10 cursor-pointer"
            >
              Select all
            </Button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 scrollbar-thin">
          {/* Title */}
          <DiffRow
            label="Current Role / Title"
            icon={<Briefcase className="h-4 w-4" />}
            current={candidate.current_title}
            detected={extracted.current_role}
            selected={Boolean(selectedFields.current_title)}
            onToggle={() => toggleField("current_title")}
            disabled={!extracted.current_role}
          />

          {/* Experience Years */}
          <DiffRow
            label="Experience Years"
            icon={<Clock className="h-4 w-4" />}
            current={candidate.experience_years != null ? `${candidate.experience_years} years` : null}
            detected={extracted.experience_years != null ? `${extracted.experience_years} years` : null}
            selected={Boolean(selectedFields.experience_years)}
            onToggle={() => toggleField("experience_years")}
            disabled={extracted.experience_years == null}
          />

          {/* Location */}
          <DiffRow
            label="Location"
            icon={<MapPin className="h-4 w-4" />}
            current={candidate.location}
            detected={extracted.location}
            selected={Boolean(selectedFields.location)}
            onToggle={() => toggleField("location")}
            disabled={!extracted.location}
          />

          {/* LinkedIn URL */}
          <DiffRow
            label="LinkedIn URL"
            icon={<LinkedinLogo className="h-4 w-4" />}
            current={candidate.linkedin_url}
            detected={extracted.linkedin_url}
            selected={Boolean(selectedFields.linkedin_url)}
            onToggle={() => toggleField("linkedin_url")}
            disabled={!extracted.linkedin_url}
          />

          {/* Email */}
          <DiffRow
            label="Email Address"
            icon={<EnvelopeSimple className="h-4 w-4" />}
            current={candidate.email}
            detected={extracted.email}
            selected={Boolean(selectedFields.email)}
            onToggle={() => toggleField("email")}
            disabled={!extracted.email}
          />

          {/* Phone */}
          <DiffRow
            label="Phone Number"
            icon={<Phone className="h-4 w-4" />}
            current={candidate.phone}
            detected={extracted.phone}
            selected={Boolean(selectedFields.phone)}
            onToggle={() => toggleField("phone")}
            disabled={!extracted.phone}
          />

          {/* Skills Section */}
          <div className="rounded-lg border border-border/80 bg-surface p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(selectedFields.skills && extracted.skills.length > 0)}
                  disabled={!extracted.skills || extracted.skills.length === 0}
                  onChange={() => toggleField("skills")}
                  className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
                />
                <span className="flex items-center gap-1.5 text-xs font-semibold text-fg">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Technical Skills ({extracted.skills.length} detected)
                </span>
              </label>
              <span className="text-[11px] text-fg-subtle">
                {currentSkills.length} existing in profile
              </span>
            </div>

            {extracted.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pt-1 scrollbar-thin">
                {extracted.skills.map((skill) => {
                  const alreadyHas = currentSkills.some(
                    (c) => c.toLowerCase() === skill.toLowerCase(),
                  );
                  return (
                    <span
                      key={skill}
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                        alreadyHas
                          ? "border-border bg-surface-hover text-fg-muted"
                          : "border-primary/30 bg-primary/10 text-primary"
                      }`}
                    >
                      {skill}
                      {!alreadyHas && <span className="ml-1 text-[9px] text-primary/70">• new</span>}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-fg-subtle italic">No technical skills detected in text.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5 bg-surface/50">
          <p className="text-xs text-fg-subtle">
            {selectedCount} {selectedCount === 1 ? "field" : "fields"} selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedCount === 0}
              onClick={handleConfirmApply}
              className="h-8 px-4 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs gap-1.5"
            >
              <Lightning className="h-3.5 w-3.5" weight="fill" />
              Apply {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiffRow({
  label,
  icon,
  current,
  detected,
  selected,
  onToggle,
  disabled,
}: {
  label: string;
  icon: any;
  current?: string | null;
  detected?: string | null;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const hasDiff = detected && (!current || current.trim() !== detected.trim());

  return (
    <div
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer ${
        disabled
          ? "border-border/40 bg-surface/30 opacity-60 cursor-not-allowed"
          : selected
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-surface hover:bg-surface-hover/50"
      }`}
    >
      <div className="pt-0.5">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={onToggle}
          className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
          <span className="text-fg-subtle">{icon}</span>
          <span>{label}</span>
          {hasDiff && !disabled && (
            <span className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[9.5px] font-semibold">
              {!current ? "Fill New" : "Update"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11.5px] pt-0.5">
          <div className="truncate text-fg-subtle">
            <span className="text-[10px] uppercase font-semibold text-fg-muted block">Current:</span>
            {current ? (
              <span className="text-fg truncate block" title={current}>
                {current}
              </span>
            ) : (
              <span className="italic text-fg-muted">— empty —</span>
            )}
          </div>

          <div className="truncate">
            <span className="text-[10px] uppercase font-semibold text-fg-muted block">From Resume:</span>
            {detected ? (
              <span className="font-medium text-primary truncate block" title={detected}>
                {detected}
              </span>
            ) : (
              <span className="italic text-fg-muted">— not detected —</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
