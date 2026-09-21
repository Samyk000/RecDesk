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
  Tag,
  FileText,
  ArrowRight,
  UploadSimple,
  FilePdf,
  FileDoc,
  Trash,
} from "@phosphor-icons/react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useParseResume } from "../../hooks/useQueries";
import { apiFiles } from "../../lib/api";
import { extractDocumentText } from "../../lib/resumeParser";
import { ThemedOrb } from "../common/Spinner";
import { errorMessage } from "../../lib/utils";
import type { ExtractedCandidateProfile } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (profile: ExtractedCandidateProfile, sourceFilePath?: string) => void;
}

type TabMode = "file" | "text";

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
  const [activeTab, setActiveTab] = useState<TabMode>("file");
  const [rawText, setRawText] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    path: string;
    name: string;
    size: number;
  } | null>(null);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [extracted, setExtracted] = useState<ExtractedCandidateProfile | null>(null);

  const parseMutation = useParseResume();

  // Reset state whenever dialog opens
  useEffect(() => {
    if (open) {
      setRawText("");
      setSelectedFile(null);
      setExtracted(null);
      setIsProcessingFile(false);
      setProcessingStatus("");
      setActiveTab("file");
    }
  }, [open]);

  // Handle local file selection via Tauri native dialog
  async function handleSelectFile() {
    try {
      const result = await openDialog({
        multiple: false,
        filters: [{ name: "Resume / CV", extensions: ["pdf", "docx", "doc", "txt", "rtf"] }],
      });

      if (!result || typeof result !== "string") return;

      const path = result;
      const name = path.split(/[\\/]/).pop() ?? "resume";

      setIsProcessingFile(true);
      setProcessingStatus("Reading document file…");

      const bytesArray = await apiFiles.readResumeBytes(path);
      const data = new Uint8Array(bytesArray);

      setSelectedFile({
        path,
        name,
        size: data.byteLength,
      });

      setProcessingStatus("Extracting layout & contact details…");
      const { text, embeddedLinks } = await extractDocumentText(path, data);

      if (!text.trim()) {
        throw new Error("Could not extract readable text from this document. It may be scanned or empty.");
      }

      setProcessingStatus("Analyzing profile fields…");

      parseMutation.mutate(
        { text, filename: name, embeddedLinks },
        {
          onSuccess: (profile) => {
            setExtracted(profile);
            setIsProcessingFile(false);
            setProcessingStatus("");
            toast.success(`Resume parsed: ${profile.name || "Candidate"}`);
          },
          onError: (err) => {
            setIsProcessingFile(false);
            setProcessingStatus("");
            toast.error(`Parsing failed: ${errorMessage(err)}`);
          },
        }
      );
    } catch (err) {
      setIsProcessingFile(false);
      setProcessingStatus("");
      toast.error(errorMessage(err));
    }
  }

  function handlePasteResumeSample() {
    setRawText(SAMPLE_RESUME);
    setExtracted(null);
  }

  function handleParseRawText() {
    if (!rawText.trim()) {
      toast.error("Please paste resume text first");
      return;
    }

    parseMutation.mutate(
      { text: rawText },
      {
        onSuccess: (data) => {
          setExtracted(data);
          toast.success("Resume details extracted successfully!");
        },
        onError: (err) => {
          toast.error(`Extraction failed: ${errorMessage(err)}`);
        },
      }
    );
  }

  function handleApply() {
    if (!extracted) return;
    onApply(extracted, selectedFile?.path);
    onOpenChange(false);
    toast.success(selectedFile ? "Form auto-filled & resume attached!" : "Candidate form auto-filled!");
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FilePdf className="h-6 w-6 text-red-500" />;
    if (ext === "docx" || ext === "doc") return <FileDoc className="h-6 w-6 text-blue-500" />;
    return <FileText className="h-6 w-6 text-primary" />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-xl overflow-hidden p-0 flex flex-col shadow-float">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-4 pr-12">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lightning className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-fg">
                Resume Auto-Fill
              </DialogTitle>
              <p className="text-xs text-fg-subtle">
                Attach a resume file or paste text to instantly auto-fill candidate details.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-surface-hover/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "file"
                ? "border-primary text-primary"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            <UploadSimple className="h-3.5 w-3.5" />
            Attach Resume File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "text"
                ? "border-primary text-primary"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Paste Raw Text
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4 scrollbar-thin">
          {activeTab === "file" ? (
            <div className="space-y-3">
              {/* Dropzone / File Picker Card */}
              {!selectedFile ? (
                <button
                  type="button"
                  onClick={handleSelectFile}
                  disabled={isProcessingFile}
                  className="group relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface p-6 text-center transition-all hover:border-primary hover:bg-primary/5 cursor-pointer"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <UploadSimple className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-fg">
                    Choose a resume from your computer
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    Supports <span className="font-medium text-fg">PDF, DOCX, DOC, TXT</span>. RecDesk automatically extracts candidate details.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-fg shadow-sm group-hover:border-primary/50">
                    Browse Local File…
                  </div>
                </button>
              ) : (
                /* Selected File Card */
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3.5 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(selectedFile.name)}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fg truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-fg-subtle">
                        {formatBytes(selectedFile.size)} • File attached
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSelectFile}
                      disabled={isProcessingFile}
                      className="h-7 text-xs"
                    >
                      Change File
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setExtracted(null);
                      }}
                      className="text-fg-subtle hover:text-red-500 p-1 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Processing Progress Indicator */}
              {isProcessingFile && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs text-fg shadow-2xs animate-fade-in">
                  <ThemedOrb state="working" size={20} className="shrink-0" />
                  <span className="font-medium">{processingStatus}</span>
                </div>
              )}
            </div>
          ) : (
            /* Paste Raw Text Tab */
            <div className="space-y-3">
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
                rows={6}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-fg placeholder:text-fg-subtle/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary scrollbar-thin resize-y"
              />

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <span className="text-[11px] text-fg-subtle">
                  Instant on-device layout extraction.
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  className="h-8 gap-1.5 px-3.5 text-xs font-medium cursor-pointer"
                  onClick={handleParseRawText}
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
            </div>
          )}

          {/* Interactive Extracted Profile Card */}
          {extracted && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3.5 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-primary/15 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                  <Check className="h-4 w-4" />
                  Recognized Candidate Details
                </span>
                <span className="text-[11px] text-fg-subtle">
                  Review & tweak before applying
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-fg-muted flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-primary" /> Full Name
                  </label>
                  <Input
                    value={extracted.name}
                    onChange={(e) => setExtracted({ ...extracted, name: e.target.value })}
                    className="h-8 text-xs font-semibold bg-surface"
                    placeholder="Candidate Name"
                  />
                </div>

                {/* Role / Current Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-fg-muted flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-primary" /> Current Role / Title
                  </label>
                  <Input
                    value={extracted.current_role ?? ""}
                    onChange={(e) => setExtracted({ ...extracted, current_role: e.target.value })}
                    className="h-8 text-xs font-medium bg-surface"
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-fg-muted flex items-center gap-1">
                    <EnvelopeSimple className="h-3.5 w-3.5 text-primary" /> Email Address
                  </label>
                  <Input
                    value={extracted.email ?? ""}
                    onChange={(e) => setExtracted({ ...extracted, email: e.target.value })}
                    className="h-8 text-xs bg-surface"
                    placeholder="e.g. candidate@example.com"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-fg-muted flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number
                  </label>
                  <Input
                    value={extracted.phone ?? ""}
                    onChange={(e) => setExtracted({ ...extracted, phone: e.target.value })}
                    className="h-8 text-xs bg-surface"
                    placeholder="e.g. (555) 019-2834"
                  />
                </div>

                {/* Location */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-fg-muted flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Location
                  </label>
                  <Input
                    value={extracted.location ?? ""}
                    onChange={(e) => setExtracted({ ...extracted, location: e.target.value })}
                    className="h-8 text-xs bg-surface"
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>

                {/* LinkedIn */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-fg-muted flex items-center gap-1">
                    <LinkedinLogo className="h-3.5 w-3.5 text-blue-500" /> LinkedIn Profile URL
                  </label>
                  <Input
                    value={extracted.linkedin_url ?? ""}
                    onChange={(e) => setExtracted({ ...extracted, linkedin_url: e.target.value })}
                    className="h-8 text-xs bg-surface"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              {/* Skills Tags */}
              {extracted.skills && extracted.skills.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-medium text-fg-subtle flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Detected Skills ({extracted.skills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto scrollbar-thin">
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

              {/* Apply Action Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-primary/15">
                <span className="text-[11px] text-fg-subtle">
                  {selectedFile ? "File will be automatically attached on save" : "Ready to populate form"}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  className="gap-1.5 px-4 text-xs font-semibold cursor-pointer shadow-raise"
                  onClick={handleApply}
                >
                  Apply to Candidate Form
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
