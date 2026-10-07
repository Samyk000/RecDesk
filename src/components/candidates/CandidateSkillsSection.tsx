import { useState, useMemo } from "react";
import { Plus, Tag, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { getCandidateSkills, setCandidateSkills } from "../../lib/candidateUtils";
import type { Candidate, CandidateInput } from "../../types";

interface CandidateSkillsSectionProps {
  candidate: Candidate;
  onSaveField: (patch: Partial<CandidateInput>) => void;
}

export function CandidateSkillsSection({
  candidate,
  onSaveField,
}: CandidateSkillsSectionProps) {
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  const candidateSkills = useMemo(
    () => getCandidateSkills(candidate),
    [candidate.submission_details]
  );

  const handleAddSkill = (skillName?: string) => {
    const raw = (skillName ?? newSkillInput).trim();
    if (!raw) return;

    // Split on commas, semicolons, pipes, or newlines (e.g. "AWS, Node, Python")
    const parts = raw
      .split(/[,;|\n]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    if (parts.length === 0) return;

    let addedCount = 0;
    const updated = [...candidateSkills];

    for (const part of parts) {
      if (!updated.some((s: string) => s.toLowerCase() === part.toLowerCase())) {
        updated.push(part);
        addedCount++;
      }
    }

    if (addedCount === 0 && parts.length === 1) {
      toast.info(`"${parts[0]}" is already in skills list`);
      setNewSkillInput("");
      setIsAddingSkill(false);
      return;
    }

    const newDetails = setCandidateSkills(candidate.submission_details, updated);
    onSaveField({ submission_details: newDetails });
    if (parts.length > 1) {
      toast.success(`Added ${addedCount} skill${addedCount === 1 ? "" : "s"}`);
    }
    setNewSkillInput("");
    setIsAddingSkill(false);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = candidateSkills.filter(
      (s: string) => s.toLowerCase() !== skillToRemove.toLowerCase(),
    );
    const newDetails = setCandidateSkills(candidate.submission_details, updated);
    onSaveField({ submission_details: newDetails });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
          <Tag className="h-4 w-4 text-fg-subtle" weight="bold" />
          <span>Skills & Tools</span>
          {candidateSkills.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
              {candidateSkills.length}
            </span>
          )}
        </div>
        {!isAddingSkill && candidateSkills.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingSkill(true)}
            className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 cursor-pointer gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Skill
          </Button>
        )}
      </div>

      {/* Inline Add Skill Input */}
      {isAddingSkill && (
        <div className="flex items-center gap-1.5 animate-fade-in">
          <Input
            value={newSkillInput}
            onChange={(e) => setNewSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSkill();
              } else if (e.key === "Escape") {
                setIsAddingSkill(false);
                setNewSkillInput("");
              }
            }}
            autoFocus
            placeholder="Type skill(s) e.g. AWS, Node, Python & press Enter…"
            className="h-7.5 text-xs flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => handleAddSkill()}
            className="h-7.5 px-2.5 text-xs"
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAddingSkill(false);
              setNewSkillInput("");
            }}
            className="h-7.5 px-2 text-xs text-fg-subtle"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Skills Badges List */}
      {candidateSkills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 max-h-[140px] overflow-y-auto scrollbar-thin">
          {candidateSkills.map((skill: string) => (
            <span
              key={skill}
              className="group inline-flex items-center gap-1 rounded-md border border-border/80 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-fg shadow-2xs transition-colors hover:border-border"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                title={`Remove ${skill}`}
                className="rounded p-0.5 text-fg-subtle hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {!isAddingSkill && (
            <button
              type="button"
              onClick={() => setIsAddingSkill(true)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-[11.5px] font-medium text-primary hover:bg-primary/10 hover:border-primary/60 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Skill</span>
            </button>
          )}
        </div>
      ) : (
        !isAddingSkill && (
          <div className="flex items-center gap-2 py-1">
            <span className="text-xs text-fg-subtle">No skills listed yet.</span>
            <button
              type="button"
              onClick={() => setIsAddingSkill(true)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Skill</span>
            </button>
          </div>
        )
      )}
    </div>
  );
}
