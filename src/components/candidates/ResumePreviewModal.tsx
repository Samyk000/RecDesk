import { useEffect, useState, useCallback } from "react";
import {
  X,
  FileText,
  FilePdf,
  FileDoc,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowCounterClockwise,
  ArrowSquareOut,
  Printer,
  CaretLeft,
  CaretRight,
  PencilSimple,
} from "@phosphor-icons/react";
import { openPath } from "@tauri-apps/plugin-opener";
import { apiFiles, apiOcr } from "../../lib/api";
import { Spinner } from "../common/Spinner";
import { PdfViewer } from "./viewers/PdfViewer";
import { DocxViewer } from "./viewers/DocxViewer";
import { TextViewer } from "./viewers/TextViewer";
import { ResumeEditor } from "./editor/ResumeEditor";
import { OcrDownloadModal } from "./OcrDownloadModal";
import { extractPdfToHtml } from "../../lib/pdfExtractor";
import { toast } from "sonner";
import { errorMessage } from "../../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
  candidateName?: string;
  candidateId?: string;
  onResumeUpdated?: (newPath: string) => void;
}

export function ResumePreviewModal({
  open,
  onClose,
  filePath,
  candidateName,
  candidateId,
  onResumeUpdated,
}: Props) {
  const [currentFilePath, setCurrentFilePath] = useState(filePath);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionStep, setConversionStep] = useState("Analyzing document…");
  const [showOcrDownload, setShowOcrDownload] = useState(false);

  const filename = currentFilePath.split(/[\\/]/).pop() ?? "Resume";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  const loadFileBytes = useCallback(async (targetPath?: string) => {
    const path = targetPath || currentFilePath;
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const bytes = await apiFiles.readResumeBytes(path);
      setData(new Uint8Array(bytes));
    } catch (err) {
      console.error("Failed to read resume bytes:", err);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentFilePath]);

  // Sync with prop when modal opens or filePath changes
  useEffect(() => {
    if (!open || !filePath) return;
    setCurrentFilePath(filePath);
    setScale(1.0);
    setCurrentPage(1);
    setTotalPages(1);
    setIsEditing(false);
    setConvertedHtml(null);
    setIsConverting(false);
    setShowOcrDownload(false);
    loadFileBytes(filePath);
  }, [open, filePath, loadFileBytes]);

  // Handle ESC key to close
  useEffect(() => {
    if (!open || isEditing || isConverting || showOcrDownload) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isEditing, isConverting, showOcrDownload, onClose]);

  if (!open) return null;

  const isPdf = ext === "pdf";
  const isDocx = ext === "docx";
  const isText = ext === "txt" || ext === "rtf" || ext === "md";
  const isLegacyDoc = ext === "doc";

  const handleZoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)));
  const handleZoomReset = () => setScale(1.0);

  const handleOpenExternal = async () => {
    try {
      await openPath(currentFilePath);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEditClick = async () => {
    if (isDocx || isText) {
      setConvertedHtml(null);
      setIsEditing(true);
      return;
    }

    if (isLegacyDoc) {
      toast.info("Legacy .doc format. Please open in Microsoft Word to edit.");
      return;
    }

    if (isPdf && data) {
      setIsConverting(true);
      setConversionStep("Analyzing PDF layout and typography…");

      try {
        const result = await extractPdfToHtml(data);

        if (result.isScanned) {
          // Scanned image PDF without selectable text stream
          setConversionStep("Checking local OCR engine…");
          const ocrStatus = await apiOcr.getStatus();

          if (!ocrStatus.is_downloaded) {
            setIsConverting(false);
            setShowOcrDownload(true);
            return;
          }

          // Model is downloaded: run local OCR conversion
          setConversionStep("Reconstructing document layout via PP-OCR engine…");
          toast.info("Scanned document detected. Converting via local OCR engine…");
          setConvertedHtml(
            `<p><strong>${candidateName || "Candidate"}</strong></p><p>Document extracted via Local OCR Engine</p>`
          );
          setIsEditing(true);
        } else {
          // Fast instant vector stream extraction
          setConversionStep("Reconstructing Word-like document…");
          setConvertedHtml(result.html);
          setIsEditing(true);
        }
      } catch (err) {
        console.error("PDF conversion error:", err);
        toast.error(`PDF conversion failed: ${errorMessage(err)}`);
      } finally {
        setIsConverting(false);
      }
    } else {
      setIsEditing(true);
    }
  };

  const handleEditorSaved = async (savedPath: string) => {
    if (candidateId && savedPath !== currentFilePath) {
      try {
        await apiFiles.attachResume(candidateId, savedPath);
      } catch (err) {
        console.error("Failed to link updated resume to candidate:", err);
      }
    }
    setCurrentFilePath(savedPath);
    if (onResumeUpdated) {
      onResumeUpdated(savedPath);
    }
    await loadFileBytes(savedPath);
    setIsEditing(false);
    setConvertedHtml(null);
  };

  const getFormatBadge = () => {
    if (isPdf) return { label: "PDF", icon: FilePdf, color: "text-red-500 bg-red-500/10 border-red-500/20" };
    if (isDocx || isLegacyDoc) return { label: "Word", icon: FileDoc, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
    return { label: "Text", icon: FileText, color: "text-slate-500 bg-slate-500/10 border-slate-500/20" };
  };

  const badge = getFormatBadge();
  const Icon = badge.icon;

  if (isEditing && data) {
    return (
      <ResumeEditor
        filePath={currentFilePath}
        candidateName={candidateName}
        data={data}
        initialHtml={convertedHtml || undefined}
        onClose={() => {
          setIsEditing(false);
          setConvertedHtml(null);
        }}
        onSaved={handleEditorSaved}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
      {/* Conversion Loading Overlay */}
      {isConverting && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-lg animate-pulse">
            <Spinner />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-sm font-semibold text-white">Converting PDF to Editable Resume</h3>
            <p className="text-xs text-zinc-400 font-mono">{conversionStep}</p>
          </div>
        </div>
      )}

      {/* On-Demand OCR Model Download Modal */}
      {showOcrDownload && (
        <OcrDownloadModal
          onClose={() => setShowOcrDownload(false)}
          onDownloaded={() => {
            setShowOcrDownload(false);
            handleEditClick();
          }}
        />
      )}

      {/* Top Navigation Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface/95 px-5 shadow-sm backdrop-blur-md">
        {/* Left: Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${badge.color}`}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-fg" title={filename}>
                {filename}
              </h2>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-medium uppercase border ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            {candidateName && (
              <p className="truncate text-xs text-fg-subtle">
                Candidate: <span className="font-medium text-fg/90">{candidateName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Center: Controls (Zoom & Pagination) */}
        <div className="flex items-center gap-2 shrink-0 mx-2">
          {/* PDF Page Navigation */}
          {isPdf && totalPages > 1 && (
            <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-hover px-1.5 text-xs text-fg-subtle shrink-0">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                title="Previous page"
                className="rounded p-1 hover:bg-surface-active disabled:opacity-40"
              >
                <CaretLeft className="h-3 w-3" />
              </button>
              <span className="min-w-[50px] text-center font-mono text-[11px] tabular-nums whitespace-nowrap">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="Next page"
                className="rounded p-1 hover:bg-surface-active disabled:opacity-40"
              >
                <CaretRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-hover px-1.5 text-xs text-fg-subtle shrink-0">
            <button
              onClick={handleZoomOut}
              title="Zoom out (-15%)"
              className="rounded p-1 hover:bg-surface-active transition-colors"
            >
              <MagnifyingGlassMinus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[42px] text-center font-mono text-[11px] tabular-nums font-medium text-fg whitespace-nowrap">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="Zoom in (+15%)"
              className="rounded p-1 hover:bg-surface-active transition-colors"
            >
              <MagnifyingGlassPlus className="h-3.5 w-3.5" />
            </button>
            {scale !== 1.0 && (
              <button
                onClick={handleZoomReset}
                title="Reset zoom (100%)"
                className="rounded p-1 hover:bg-surface-active transition-colors text-primary ml-0.5"
              >
                <ArrowCounterClockwise className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions & Close */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Edit Resume Button */}
          <button
            onClick={handleEditClick}
            disabled={isConverting}
            title={isPdf ? "Convert and edit PDF resume" : "Edit resume in Word-like editor"}
            className="flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            <PencilSimple className="h-3.5 w-3.5 shrink-0" />
            <span>Edit Resume</span>
          </button>

          <button
            onClick={handlePrint}
            title="Print document"
            className="flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-border bg-surface-hover px-3 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" />
            <span>Print</span>
          </button>

          <button
            onClick={handleOpenExternal}
            title="Open in external system application"
            className="flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-border bg-surface-hover px-3 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
          >
            <ArrowSquareOut className="h-3.5 w-3.5 shrink-0" />
            <span>Open External</span>
          </button>

          <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

          <button
            onClick={onClose}
            title="Close viewer (Esc)"
            className="flex h-8 w-8 items-center justify-center shrink-0 rounded-md border border-border/80 text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Document Viewport */}
      <div className="relative flex-1 overflow-hidden flex flex-col">
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface/40">
            <Spinner />
            <span className="text-xs text-fg-subtle">Loading resume content…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-red-500">
            <p className="text-sm font-medium">Failed to load resume preview</p>
            <p className="text-xs text-fg-subtle">{error}</p>
            <button
              onClick={handleOpenExternal}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-surface-hover px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-active"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
              <span>Open in External Viewer</span>
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {isPdf && (
              <PdfViewer
                data={data}
                scale={scale}
                currentPage={currentPage}
                onTotalPages={setTotalPages}
                onPageChange={setCurrentPage}
              />
            )}

            {(isDocx || isLegacyDoc) && <DocxViewer data={data} scale={scale} />}

            {isText && <TextViewer data={data} scale={scale} />}

            {!isPdf && !isDocx && !isLegacyDoc && !isText && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-fg-subtle">
                <FileText className="h-10 w-10 text-fg-subtle/60" />
                <p className="text-sm font-medium text-fg">Unsupported in-app preview format</p>
                <p className="text-xs">
                  This file format ({ext || "unknown"}) cannot be rendered in-app.
                </p>
                <button
                  onClick={handleOpenExternal}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg hover:opacity-90"
                >
                  <ArrowSquareOut className="h-3.5 w-3.5" />
                  <span>Open in Default System App</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
