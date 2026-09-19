import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

// Ensure PDF.js worker is properly configured for offline desktop execution
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}

interface RawTextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface ExtractedDocumentContent {
  text: string;
  embeddedLinks: string[];
}

/**
 * Extracts clean, layout-aware text and embedded hyperlinked URLs from a local resume file.
 * Handles PDF (with 2-column spatial sorting), DOCX (via Mammoth), and plain text.
 */
export async function extractDocumentText(
  filePath: string,
  data: Uint8Array
): Promise<ExtractedDocumentContent> {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    return extractPdfDocument(data);
  }

  if (ext === "docx" || ext === "doc") {
    return extractDocxDocument(data);
  }

  // Plain text / Markdown / RTF fallback
  const decoder = new TextDecoder("utf-8");
  const rawText = decoder.decode(data);
  return {
    text: rawText,
    embeddedLinks: extractUrlsFromString(rawText),
  };
}

async function extractPdfDocument(data: Uint8Array): Promise<ExtractedDocumentContent> {
  const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const loadingTask = pdfjs.getDocument({ data: safeBuffer, verbosity: 0 });
  const pdf = await loadingTask.promise;
  const numPages = Math.min(pdf.numPages, 5); // Focus on first 5 pages for resume details

  let fullText = "";
  const embeddedLinks: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const pageWidth = viewport.width;

    // 1. Recover embedded hyperlink annotations (e.g. LinkedIn icon links, mailto links)
    try {
      const annotations = await page.getAnnotations();
      for (const ann of annotations) {
        if (ann.subtype === "Link" && typeof ann.url === "string" && ann.url.trim()) {
          embeddedLinks.push(ann.url.trim());
        }
      }
    } catch {
      // Ignore annotation read failures gracefully
    }

    // 2. Extract text items with spatial coordinates
    const content = await page.getTextContent();
    const items: RawTextItem[] = [];

    for (const rawItem of content.items) {
      if (!("str" in rawItem) || !rawItem.str || !rawItem.str.trim()) continue;
      const str = rawItem.str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
      if (!str) continue;

      const tx = rawItem.transform;
      const fontSize = Math.hypot(tx[0], tx[1]);
      const x = tx[4];
      const y = pageHeight - tx[5]; // Convert PDF coordinate system to top-down

      items.push({ text: str, x, y, fontSize });
    }

    if (items.length === 0) continue;

    // 3. Layout Detection: Check for 2-column template layout
    // If a clear vertical divider exists with substantial content on both left and right,
    // read the left column top-to-bottom first, then the right column, preventing horizontal interleaving.
    const isMultiColumn = checkMultiColumnLayout(items, pageWidth);

    let pageLines: string[] = [];

    if (isMultiColumn) {
      const splitX = pageWidth * 0.38; // Typical sidebar split boundary
      const leftItems = items.filter((it) => it.x < splitX);
      const rightItems = items.filter((it) => it.x >= splitX);

      pageLines = [
        ...groupItemsIntoLines(leftItems),
        "\n--- SECTION BREAK ---\n",
        ...groupItemsIntoLines(rightItems),
      ];
    } else {
      pageLines = groupItemsIntoLines(items);
    }

    fullText += pageLines.join("\n") + "\n\n";
  }

  return {
    text: fullText.trim(),
    embeddedLinks: Array.from(new Set(embeddedLinks)),
  };
}

/**
 * Checks if a PDF page uses a 2-column layout (e.g. sidebar on left, main content on right).
 */
function checkMultiColumnLayout(items: RawTextItem[], pageWidth: number): boolean {
  if (items.length < 20) return false;
  const splitX = pageWidth * 0.38;
  const leftCount = items.filter((it) => it.x < splitX).length;
  const rightCount = items.filter((it) => it.x >= splitX).length;

  // If both left and right have at least 25% of the content, it's a 2-column layout
  return leftCount > items.length * 0.22 && rightCount > items.length * 0.35;
}

/**
 * Groups spatially ordered text items into coherent horizontal lines.
 */
function groupItemsIntoLines(items: RawTextItem[]): string[] {
  if (items.length === 0) return [];

  // Sort primarily top-to-bottom (y), then left-to-right (x)
  items.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: string[] = [];
  let currentLine: RawTextItem[] = [];

  for (const item of items) {
    if (currentLine.length === 0) {
      currentLine.push(item);
    } else {
      const prev = currentLine[currentLine.length - 1];
      // If within 4px vertically, they belong to the same visual line
      if (Math.abs(item.y - prev.y) <= 4.5) {
        currentLine.push(item);
      } else {
        lines.push(currentLine.map((it) => it.text).join(" "));
        currentLine = [item];
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.map((it) => it.text).join(" "));
  }

  return lines;
}

async function extractDocxDocument(data: Uint8Array): Promise<ExtractedDocumentContent> {
  const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: safeBuffer });
    const text = result.value || "";
    return {
      text: text.trim(),
      embeddedLinks: extractUrlsFromString(text),
    };
  } catch (err) {
    console.warn("Mammoth text extraction fallback:", err);
    const decoder = new TextDecoder("utf-8");
    const raw = decoder.decode(data);
    return {
      text: raw.trim(),
      embeddedLinks: extractUrlsFromString(raw),
    };
  }
}

function extractUrlsFromString(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;:)\]]+$/, ""))));
}
