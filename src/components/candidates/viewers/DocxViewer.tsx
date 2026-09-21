import { useEffect, useRef, useState } from "react";
import { ThemedOrb } from "../../common/Spinner";

interface Props {
  data: Uint8Array;
  scale: number;
}

export function DocxViewer({ data, scale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const target = containerRef.current;
    if (!target) return;
    target.innerHTML = "";

    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

    import("docx-preview")
      .then(({ renderAsync }) => {
        if (!active) return;
        return renderAsync(buffer, target, undefined, {
          className: "docx",
          inWrapper: true,
          hideWrapperOnPrint: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: true,
          useBase64URL: true,
        });
      })
      .then(() => {
        if (!active) return;
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.warn("Standard docx-preview parse failed, attempting HTML/text fallback recovery:", err);

        // Fallback recovery: check if data is HTML or plain text (e.g. from a previous web edit)
        try {
          const raw = new TextDecoder().decode(buffer);
          if (raw.includes("<p>") || raw.includes("<h1>") || raw.includes("<div>") || raw.includes("<ul>")) {
            // Safely parse and sanitize HTML to eliminate stored XSS risks
            const parser = new DOMParser();
            const doc = parser.parseFromString(raw, "text/html");

            // Strip executable or dangerous elements
            const dangerousTags = doc.querySelectorAll("script, iframe, object, embed, base, form, link, meta, style");
            dangerousTags.forEach((el) => el.remove());

            // Strip all inline event handlers (on*) and javascript: links
            const allElements = doc.querySelectorAll("*");
            allElements.forEach((el) => {
              for (const attr of Array.from(el.attributes)) {
                if (
                  attr.name.toLowerCase().startsWith("on") ||
                  attr.value.toLowerCase().trim().startsWith("javascript:") ||
                  attr.value.toLowerCase().trim().startsWith("data:text/html")
                ) {
                  el.removeAttribute(attr.name);
                }
              }
            });

            const section = document.createElement("section");
            section.className = "docx p-12 sm:p-16 max-w-[850px] min-h-[1050px] bg-white text-slate-900 shadow-2xl rounded-xs mx-auto text-[14.5px] leading-relaxed font-['Times_New_Roman',serif]";

            // Safely append sanitized child nodes without innerHTML
            while (doc.body.firstChild) {
              section.appendChild(doc.body.firstChild);
            }
            target.appendChild(section);
            setLoading(false);
            return;
          }
        } catch {
          // Ignore decoding error and show standard error message below
        }

        setError("Failed to render Word (.docx) document");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [data]);

  return (
    <div className="relative flex-1 overflow-y-auto overflow-x-auto p-6 bg-slate-100 dark:bg-zinc-950 flex justify-center">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3.5 bg-surface/85 backdrop-blur-xs select-none animate-fade-in">
          <ThemedOrb state="searching" size={64} />
          <span className="text-xs font-medium text-fg-subtle">Rendering Word document layout…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 p-6 text-center text-red-500">
          <p className="text-sm font-medium">{error}</p>
          <p className="text-xs text-fg-subtle">You can open this resume in MS Word using the button above.</p>
        </div>
      )}

      <div
        className="w-full flex justify-center transition-transform duration-150 origin-top"
        style={{ transform: scale !== 1.0 ? `scale(${scale})` : undefined }}
      >
        <div
          ref={containerRef}
          className="docx-preview-container max-w-full [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_.docx-document-wrapper]:bg-transparent [&_.docx-document-wrapper]:p-0 [&_section.docx]:shadow-2xl [&_section.docx]:mb-6 [&_section.docx]:rounded-xs [&_section.docx]:bg-white [&_section.docx]:text-slate-900 [&_section.docx-document]:shadow-2xl [&_section.docx-document]:mb-6 [&_section.docx-document]:rounded-xs [&_section.docx-document]:bg-white [&_section.docx-document]:text-slate-900"
        />
      </div>
    </div>
  );
}
