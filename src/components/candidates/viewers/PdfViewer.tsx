import { useEffect, useState, useRef } from "react";
import { ResumeDocumentSkeleton } from "./ResumeDocumentSkeleton";
import { FilePdf } from "@phosphor-icons/react";

interface Props {
  data: Uint8Array;
  scale: number;
}

export function PdfViewer({ data, scale }: Props) {
  const [iframeReady, setIframeReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate safe Blob URL for native high-performance rendering in WebView
  useEffect(() => {
    let url: string | null = null;
    setIframeReady(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    try {
      const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const blob = new Blob([safeBuffer], { type: "application/pdf" });
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setLoadFailed(false);
    } catch (err) {
      console.error("Failed to create PDF blob:", err);
      setLoadFailed(true);
      setBlobUrl(null);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [data]);

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
    <div className="relative flex-1 w-full h-full bg-slate-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden p-2 sm:p-4">
      {/* Smooth Wavy Resume Document Skeleton (stays visible until PDF is painted & fitted) */}
      <div
        className={`absolute inset-0 flex items-center justify-center p-2 sm:p-4 transition-opacity duration-500 ease-in-out ${
          iframeReady ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <ResumeDocumentSkeleton scale={scale} />
      </div>

      {/* PDF Viewport (Cross-fades in once Chromium's PDF plugin finishes painting & fitting) */}
      <div
        className={`w-full h-full max-w-5xl rounded-md overflow-hidden shadow-2xl bg-white dark:bg-zinc-900 transition-opacity duration-500 ease-in-out origin-top flex flex-col ${
          iframeReady ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          transform: scale !== 1.0 ? `scale(${scale})` : undefined,
          height: scale > 1.0 ? `${100 / scale}%` : "100%",
        }}
      >
        <iframe
          src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
          title="PDF Resume Preview"
          className="w-full h-full border-0 bg-white dark:bg-zinc-900"
          onLoad={() => {
            // Edge/Chromium PDFium viewer takes ~900ms to initialize its plugin,
            // render the page, and calculate view=FitH zoom.
            // Keeping the skeleton on top during this window completely masks the black canvas
            // and the snap-from-center-to-fit jump.
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              setIframeReady(true);
            }, 950);
          }}
        />
      </div>
    </div>
  );
}
