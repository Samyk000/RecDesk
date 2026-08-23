import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../../common/Spinner";
import { FilePdf } from "@phosphor-icons/react";

interface Props {
  data: Uint8Array;
  scale: number;
  currentPage?: number;
  onTotalPages?: (total: number) => void;
  onPageChange?: (page: number) => void;
}

export function PdfViewer({ data, scale }: Props) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Generate safe Blob URL for native high-performance rendering in WebView
  const blobUrl = useMemo(() => {
    try {
      // Clone array buffer slice to avoid detached buffer issues
      const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const blob = new Blob([safeBuffer], { type: "application/pdf" });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("Failed to create PDF blob:", err);
      setLoadFailed(true);
      return null;
    }
  }, [data]);

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (loadFailed || !blobUrl) {
    return (
      <div className="flex h-full min-h-[400px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-red-500">
        <FilePdf className="h-10 w-10 text-red-500/80" />
        <p className="text-sm font-medium">Failed to process PDF data</p>
        <p className="text-xs text-fg-subtle">
          The PDF could not be loaded into memory. You can still open it externally.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-full bg-zinc-950/80 flex items-center justify-center overflow-hidden p-2 sm:p-4">
      {/* Subtle loader centered behind the fading iframe */}
      {!iframeLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <Spinner />
          <span className="text-xs text-fg-subtle">Preparing resume preview…</span>
        </div>
      )}

      <div
        className={`w-full h-full max-w-5xl rounded-md overflow-hidden shadow-2xl bg-zinc-900 transition-opacity duration-300 ease-out origin-top flex flex-col ${
          iframeLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transform: scale !== 1.0 ? `scale(${scale})` : undefined,
          height: scale > 1.0 ? `${100 / scale}%` : "100%",
        }}
      >
        <iframe
          src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
          title="PDF Resume Preview"
          className="w-full h-full border-0 bg-white"
          onLoad={() => setIframeLoaded(true)}
        />
      </div>
    </div>
  );
}
