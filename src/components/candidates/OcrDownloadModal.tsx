import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Cpu, DownloadSimple, X, CheckCircle } from "@phosphor-icons/react";
import { Spinner } from "../common/Spinner";
import { apiOcr } from "../../lib/api";
import { OcrDownloadProgressPayload, OcrModelInfo } from "../../types";
import { toast } from "sonner";
import { errorMessage } from "../../lib/utils";

interface Props {
  onClose: () => void;
  onDownloaded: () => void;
}

export function OcrDownloadModal({ onClose, onDownloaded }: Props) {
  const [modelInfo, setModelInfo] = useState<OcrModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<OcrDownloadProgressPayload | null>(null);

  useEffect(() => {
    let active = true;
    apiOcr
      .getStatus()
      .then((info: OcrModelInfo) => {
        if (!active) return;
        setModelInfo(info);
        if (info.is_downloaded) {
          onDownloaded();
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to check OCR model status:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unlistenPromise = listen<OcrDownloadProgressPayload>("ocr-download-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.is_complete) {
        setDownloading(false);
        toast.success("OCR Engine downloaded and ready");
        onDownloaded();
      }
    });

    return () => {
      active = false;
      unlistenPromise.then((fn) => fn());
    };
  }, [onDownloaded]);

  const handleStartDownload = async () => {
    if (!modelInfo) return;
    setDownloading(true);
    try {
      await apiOcr.downloadModel(modelInfo.id);
    } catch (err: unknown) {
      console.error("Download error:", err);
      toast.error(`Download failed: ${errorMessage(err)}`);
      setDownloading(false);
    }
  };

  const handleCancelDownload = async () => {
    if (modelInfo && downloading) {
      await apiOcr.cancelDownload(modelInfo.id);
      setDownloading(false);
      setProgress(null);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-[fade-in_0.15s_ease-out]">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl overflow-hidden animate-[scale-in_0.15s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg">Download Local OCR Engine</h3>
              <p className="text-xs text-fg-subtle">PaddleOCR PP-OCRv6 Offline Document Engine</p>
            </div>
          </div>
          <button
            onClick={handleCancelDownload}
            className="rounded-md p-1 text-fg-subtle hover:bg-surface-active hover:text-fg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Spinner />
              <span className="text-xs text-fg-subtle">Checking OCR engine status…</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-fg-muted leading-relaxed">
                To edit scanned PDF resumes and reconstruct editable typography, RecDesk uses a lightweight,
                privacy-first local OCR model that runs entirely on your device with 0 cloud transmission.
              </p>

              <div className="rounded-lg border border-border bg-surface-hover/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-fg">Model Size:</span>
                  <span className="font-mono text-fg-muted">~{modelInfo?.size_mb || 18} MB (one-time)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-fg">Engine Architecture:</span>
                  <span className="text-fg-muted">ONNX Document Runtime</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-fg">Privacy & Security:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> 100% Offline & Local
                  </span>
                </div>
              </div>

              {/* Progress bar during download */}
              {downloading && progress && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-subtle flex items-center gap-1.5">
                      <Spinner /> Downloading model…
                    </span>
                    <span className="font-mono font-medium text-fg">{progress.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-fg-subtle text-right font-mono">
                    {(progress.downloaded_bytes / (1024 * 1024)).toFixed(1)} MB /{" "}
                    {(progress.total_bytes / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/80 bg-surface-hover/30 px-5 py-3">
          <button
            onClick={handleCancelDownload}
            disabled={downloading && progress?.percentage === 100}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg-subtle hover:bg-surface-active hover:text-fg"
          >
            Cancel
          </button>

          <button
            onClick={handleStartDownload}
            disabled={loading || downloading}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-fg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Spinner />
                <span>Downloading…</span>
              </>
            ) : (
              <>
                <DownloadSimple className="h-3.5 w-3.5" />
                <span>Download & Enable</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
