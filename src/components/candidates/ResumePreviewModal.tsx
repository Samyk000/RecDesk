import { useEffect, useState, useCallback, useRef } from "react";
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
  PencilSimple,
  DownloadSimple,
} from "@phosphor-icons/react";
import { openPath } from "@tauri-apps/plugin-opener";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { apiFiles } from "../../lib/api";
import { ThemedOrb } from "../common/Spinner";
import { PdfViewer } from "./viewers/PdfViewer";
import { DocxViewer } from "./viewers/DocxViewer";
import { TextViewer } from "./viewers/TextViewer";
import { ResumeEditor } from "./editor/ResumeEditor";
import { extractPdfToHtml, ocrScannedPdf } from "../../lib/pdfExtractor";
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
  const [isEditing, setIsEditing] = useState(false);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionStep, setConversionStep] = useState("Analyzing document…");

  const filename = currentFilePath.split(/[\\/]/).pop() ?? "Resume";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  const isPdf = ext === "pdf";
  const isDocx = ext === "docx";
  const isText = ext === "txt" || ext === "rtf" || ext === "md";
  const isLegacyDoc = ext === "doc";

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

  const handlePrint = useCallback(() => {
    const docTitle = candidateName ? `${candidateName} - Resume` : filename.replace(/\.[^/.]+$/, "");

    // 1. If native PDF, print embedded iframe directly
    if (isPdf) {
      const pdfIframe = document.querySelector('iframe[title="PDF Resume Preview"]') as HTMLIFrameElement | null;
      if (pdfIframe?.contentWindow) {
        try {
          pdfIframe.contentWindow.focus();
          pdfIframe.contentWindow.print();
          return;
        } catch (err) {
          console.warn("Native PDF iframe print fallback:", err);
        }
      }
    }

    // 2. Extract rendered document content (Word document or Plain Text)
    const docxContainer = document.querySelector(".docx-preview-container") as HTMLElement | null;
    let contentToPrint = "";
    let isDocxContent = false;

    if (docxContainer && docxContainer.innerHTML.trim()) {
      isDocxContent = true;
      const clone = docxContainer.cloneNode(true) as HTMLElement;

      // Extract all <style> tags injected by docx-preview for fonts & formatting
      const styleTags = Array.from(clone.querySelectorAll("style"))
        .map((s) => s.outerHTML)
        .join("\n");

      // Extract all page sections, discarding any outer .docx-wrapper or .docx-document-wrapper
      const sections = clone.querySelectorAll("section");
      if (sections.length > 0) {
        const cleanSectionsHtml = Array.from(sections)
          .map((s) => {
            const sec = s as HTMLElement;
            sec.style.setProperty("box-shadow", "none", "important");
            sec.style.setProperty("border", "none", "important");
            sec.style.setProperty("margin", "0 auto", "important");
            sec.style.setProperty("margin-bottom", "0", "important");
            sec.style.setProperty("background", "#ffffff", "important");
            sec.style.setProperty("background-color", "#ffffff", "important");
            sec.style.setProperty("width", "100%", "important");
            sec.style.setProperty("max-width", "100%", "important");
            sec.style.setProperty("min-height", "auto", "important");
            return sec.outerHTML;
          })
          .join("\n");

        contentToPrint = `${styleTags}\n${cleanSectionsHtml}`;
      } else {
        // Fallback: forcefully strip wrapper backgrounds
        const wrappers = clone.querySelectorAll('.docx-wrapper, .docx-document-wrapper, [class*="-wrapper"]');
        wrappers.forEach((w) => {
          const el = w as HTMLElement;
          el.removeAttribute("style");
          el.style.setProperty("background", "transparent", "important");
          el.style.setProperty("background-color", "transparent", "important");
          el.style.setProperty("padding", "0", "important");
          el.style.setProperty("margin", "0", "important");
          el.style.setProperty("box-shadow", "none", "important");
          el.style.setProperty("display", "block", "important");
        });
        contentToPrint = clone.innerHTML;
      }
    } else if (isText && data) {
      try {
        const decoded = new TextDecoder().decode(data);
        contentToPrint = `<pre style="font-family: monospace; font-size: 10pt; line-height: 1.4; white-space: pre-wrap; margin: 0;">${escapeHtml(decoded)}</pre>`;
      } catch {
        contentToPrint = "<p>Unable to decode text document</p>";
      }
    }

    if (!contentToPrint) {
      window.print();
      return;
    }

    // Create an isolated, clean iframe for print
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(docTitle)}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 0; /* CRITICAL: removes Chromium browser header (date, title) and footer (URL, page #) */
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html {
              background: #ffffff !important;
              background-color: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            body {
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: ${isDocxContent ? "0 !important" : "15mm 15mm 15mm 15mm !important"};
              font-family: "Times New Roman", Times, serif;
              font-size: 11pt;
              line-height: 1.4;
              width: 100% !important;
            }
            /* Eliminate any wrapper background, padding, or margins */
            .docx-wrapper,
            .docx-document-wrapper,
            [class*="-wrapper"] {
              background: transparent !important;
              background-color: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              display: block !important;
              box-shadow: none !important;
              border: none !important;
            }
            /* Clean sections: 100% width, authentic page padding, zero drop-shadow */
            section.docx,
            section.docx-document,
            section {
              background: #ffffff !important;
              background-color: #ffffff !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 auto !important;
              margin-bottom: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: auto !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            section.docx:last-of-type,
            section.docx-document:last-of-type,
            section:last-of-type {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            article {
              margin: 0 !important;
            }
            h1, h2, h3 {
              page-break-after: avoid;
              break-after: avoid;
            }
            p, li, tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            strong, b {
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          ${contentToPrint}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Iframe print error:", err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 250);
  }, [candidateName, filename, isPdf, isText, data]);

  const handleDownloadCopy = useCallback(async () => {
    if (!data) return;
    try {
      const extUpper = ext ? ext.toUpperCase() : "FILE";
      const path = await saveDialog({
        title: `Save ${filename}`,
        defaultPath: filename,
        filters: ext ? [{ name: `${extUpper} Document`, extensions: [ext] }] : [],
      });
      if (!path) return;
      await writeFile(path, data);
      toast.success(`Resume saved to ${path.split(/[\\/]/).pop()}`);
    } catch (err) {
      console.error("Save copy error:", err);
      toast.error(`Failed to save: ${errorMessage(err)}`);
    }
  }, [data, ext, filename]);

  const handlePrintRef = useRef(handlePrint);
  handlePrintRef.current = handlePrint;

  // Sync with prop when modal opens or filePath changes
  useEffect(() => {
    if (!open || !filePath) return;
    setCurrentFilePath(filePath);
    setScale(1.0);
    setIsEditing(false);
    setConvertedHtml(null);
    setIsConverting(false);
    loadFileBytes(filePath);
  }, [open, filePath, loadFileBytes]);

  // Handle ESC key to close and Ctrl+P / Cmd+P to print cleanly
  useEffect(() => {
    if (!open || isEditing || isConverting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        handlePrintRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isEditing, isConverting, onClose]);

  if (!open) return null;

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
          // Scanned image PDF without selectable text stream: run real in-browser OCR
          setConversionStep("Scanned document detected. Initializing OCR engine…");
          toast.info("Scanned document detected. Recognizing text via OCR…");
          const ocrHtml = await ocrScannedPdf(data, (page, total) => {
            setConversionStep(`Recognizing text via OCR (Page ${page} of ${total})…`);
          });
          setConvertedHtml(ocrHtml);
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-[fade-in_0.2s_ease-out] print:hidden">
      {/* Conversion Loading Overlay */}
      {isConverting && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md gap-4 select-none animate-fade-in">
          <ThemedOrb state="working" size={64} />
          <div className="text-center space-y-1">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Converting PDF to Editable Resume</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{conversionStep}</p>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface/95 px-5 shadow-sm backdrop-blur-md print:hidden">
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

        {/* Right: Controls, Actions & Close */}
        <div className="flex items-center gap-2 shrink-0">
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

          <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

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

          {/* Non-PDF documents: Keep Download and Print in header (PDF already has them on embedded toolbar) */}
          {!isPdf && (
            <>
              <button
                onClick={handleDownloadCopy}
                disabled={!data}
                title={`Download copy of ${filename}`}
                className="flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-border bg-surface-hover px-3 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg disabled:opacity-50"
              >
                <DownloadSimple className="h-3.5 w-3.5 shrink-0" />
                <span>Download</span>
              </button>

              <button
                onClick={handlePrint}
                title="Print or Save as clean PDF (Ctrl+P)"
                className="flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-border bg-surface-hover px-3 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
              >
                <Printer className="h-3.5 w-3.5 shrink-0" />
                <span>Print / PDF</span>
              </button>
            </>
          )}

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
      <div className="relative flex-1 overflow-hidden flex flex-col bg-slate-100 dark:bg-zinc-950">
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 bg-slate-100 dark:bg-zinc-950 p-6 select-none animate-fade-in">
            <ThemedOrb state="searching" size={64} />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Reviewing resume content…</span>
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
            {isPdf && <PdfViewer data={data} scale={scale} />}

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
