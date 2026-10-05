import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Initialize local worker for offline desktop reliability
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface PdfExtractionResult {
  isScanned: boolean;
  html: string;
  pageCount: number;
  textCharCount: number;
  primaryFont?: string;
  primaryFontSize?: string;
}

interface RawTextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
}

const SECTION_KEYWORD_REGEX =
  /^(WORK\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT\s+HISTORY|EDUCATION|ACADEMIC\s+BACKGROUND|SKILLS|TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|PROJECTS|KEY\s+PROJECTS|SUMMARY|PROFESSIONAL\s+SUMMARY|PROFILE|OBJECTIVE|CERTIFICATIONS|LICENSES|HONORS|AWARDS|PUBLICATIONS|LANGUAGES|VOLUNTEER|INTERESTS)/i;

const BULLET_REGEX = /^[•\*\-▪–—·●►]\s*(.*)$/;
const NUMBERED_REGEX = /^(\d{1,2}[\.\)]|[a-zA-Z][\.\)])\s+(.*)$/;

export async function extractPdfToHtml(data: Uint8Array): Promise<PdfExtractionResult> {
  const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const loadingTask = pdfjs.getDocument({ data: safeBuffer, verbosity: 0 });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  try {
    let totalText = "";
    const pageHtmls: string[] = [];
    const fontTally: Record<string, number> = {};
    const sizeTally: Record<number, number> = {};

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      const pageHeight = viewport.height;
      const pageWidth = viewport.width;

      const items: RawTextItem[] = [];

      for (const rawItem of content.items) {
        if (!("str" in rawItem) || !rawItem.str || !rawItem.str.trim()) continue;

        const str = rawItem.str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
        if (!str) continue;

        const tx = rawItem.transform;
        const fontSize = Math.hypot(tx[0], tx[1]);
        const x = tx[4];
        const y = pageHeight - tx[5]; // Convert PDF bottom-left origin to top-left origin
        const rawFont = rawItem.fontName || "";
        const fontLower = rawFont.toLowerCase();
        const isBold = fontLower.includes("bold") || fontLower.includes("black") || fontLower.includes("heavy");

        if (fontLower.includes("times") || fontLower.includes("roman")) {
          fontTally["Times New Roman, Times, serif"] = (fontTally["Times New Roman, Times, serif"] || 0) + 1;
        } else if (fontLower.includes("calibri")) {
          fontTally["Calibri, Candara, Segoe, sans-serif"] = (fontTally["Calibri, Candara, Segoe, sans-serif"] || 0) + 1;
        } else if (fontLower.includes("arial") || fontLower.includes("helvetica")) {
          fontTally["Arial, Helvetica, sans-serif"] = (fontTally["Arial, Helvetica, sans-serif"] || 0) + 1;
        } else if (fontLower.includes("georgia")) {
          fontTally["Georgia, serif"] = (fontTally["Georgia, serif"] || 0) + 1;
        } else if (fontLower.includes("garamond")) {
          fontTally["Garamond, Baskerville, serif"] = (fontTally["Garamond, Baskerville, serif"] || 0) + 1;
        }

        const roundedSize = Math.round(fontSize * 2) / 2;
        sizeTally[roundedSize] = (sizeTally[roundedSize] || 0) + 1;

        items.push({
          text: str,
          x,
          y,
          fontSize,
          fontName: rawFont,
          isBold,
        });

        totalText += str + " ";
      }

      if (items.length === 0) continue;

      // Calculate baseline font size for normal body text on this page
      const fontSizes = items.map((i) => Math.round(i.fontSize));
      fontSizes.sort((a, b) => a - b);
      const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 11;

      // Group items into visual lines (tolerance of vertical y distance < 4px)
      items.sort((a, b) => a.y - b.y || a.x - b.x);

      const lines: { y: number; fontSize: number; isBold: boolean; isCentered: boolean; text: string }[] = [];
      let currentLine: RawTextItem[] = [];

      for (const item of items) {
        if (currentLine.length === 0) {
          currentLine.push(item);
        } else {
          const prev = currentLine[currentLine.length - 1];
          if (Math.abs(item.y - prev.y) <= 4.0) {
            currentLine.push(item);
          } else {
            lines.push(mergeLineItems(currentLine, pageWidth));
            currentLine = [item];
          }
        }
      }
      if (currentLine.length > 0) {
        lines.push(mergeLineItems(currentLine, pageWidth));
      }

      // Convert lines to semantic HTML preserving font sizes and alignments
      const pageHtml = formatLinesToHtml(lines, medianFontSize, pageNum === 1);
      pageHtmls.push(pageHtml);
    }

    const trimmedTextLength = totalText.replace(/\s+/g, "").length;
    if (trimmedTextLength < 50) {
      return {
        isScanned: true,
        html: "",
        pageCount,
        textCharCount: trimmedTextLength,
      };
    }

    // Determine primary font family
    let primaryFont = "Calibri, Candara, Segoe, sans-serif";
    let maxFontCount = 0;
    for (const [font, count] of Object.entries(fontTally)) {
      if (count > maxFontCount) {
        maxFontCount = count;
        primaryFont = font;
      }
    }

    // Determine primary body size
    let primarySizePt = 11;
    let maxSizeCount = 0;
    for (const [sizeStr, count] of Object.entries(sizeTally)) {
      const size = Number(sizeStr);
      if (size >= 8.5 && size <= 12 && count > maxSizeCount) {
        maxSizeCount = count;
        primarySizePt = size;
      }
    }

    return {
      isScanned: false,
      html: pageHtmls.join("<hr/><br/>"),
      pageCount,
      textCharCount: trimmedTextLength,
      primaryFont,
      primaryFontSize: `${primarySizePt}pt`,
    };
  } finally {
    try {
      await pdf.cleanup();
      await loadingTask.destroy();
    } catch {
      // Ignore cleanup errors
    }
  }
}

function mergeLineItems(
  items: RawTextItem[],
  pageWidth: number
): { y: number; fontSize: number; isBold: boolean; isCentered: boolean; text: string } {
  items.sort((a, b) => a.x - b.x);
  const text = items.map((i) => i.text).join(" ");
  const maxFontSize = Math.max(...items.map((i) => i.fontSize));
  const hasBold = items.some((i) => i.isBold);
  const avgY = items.reduce((acc, i) => acc + i.y, 0) / items.length;

  const minX = Math.min(...items.map((i) => i.x));
  const lastItem = items[items.length - 1];
  const maxX = lastItem.x + lastItem.text.length * (lastItem.fontSize * 0.52);
  const lineWidth = maxX - minX;

  // Check if line is centered on page (within 40px tolerance of page center)
  const isCentered =
    pageWidth > 0 &&
    lineWidth > 0 &&
    lineWidth < pageWidth * 0.85 &&
    Math.abs(minX + lineWidth / 2 - pageWidth / 2) < 40;

  return {
    y: avgY,
    fontSize: maxFontSize,
    isBold: hasBold,
    isCentered,
    text,
  };
}

function formatLinesToHtml(
  lines: { y: number; fontSize: number; isBold: boolean; isCentered: boolean; text: string }[],
  medianFontSize: number,
  isFirstPage: boolean
): string {
  const result: string[] = [];
  let inBulletList = false;
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();
    if (!text) continue;

    const roundPt = Math.max(9, Math.round(line.fontSize * 2) / 2);
    const centerAttr = line.isCentered ? "text-align: center;" : "";

    // Candidate Name (First Line of First Page)
    if (
      isFirstPage &&
      i === 0 &&
      (line.fontSize >= medianFontSize * 1.15 || line.isBold || (!text.includes("@") && text.length < 80))
    ) {
      closeLists();
      const splitDelim = text.match(/^([^–—|]+?)\s*[–—|]\s*(.+)$/);
      if (splitDelim && splitDelim[1].trim().length < 35 && splitDelim[1].trim().split(/\s+/).length <= 4) {
        const namePt = Math.max(16, roundPt);
        result.push(`<h1 style="font-size: ${namePt}pt; ${centerAttr}">${escapeHtml(splitDelim[1].trim())}</h1>`);
        result.push(`<h3 style="font-size: ${Math.round(namePt * 0.7)}pt; ${centerAttr}">${escapeHtml(splitDelim[2].trim())}</h3>`);
      } else {
        const namePt = Math.max(16, roundPt);
        result.push(`<h1 style="font-size: ${namePt}pt; ${centerAttr}">${escapeHtml(text)}</h1>`);
      }
      continue;
    }

    // Check compound section header
    let candidateHeader = text;
    let lookaheadUsed = false;
    if (i + 1 < lines.length) {
      const nextText = lines[i + 1].text.trim();
      const combined = `${text} ${nextText}`;
      if (SECTION_KEYWORD_REGEX.test(combined)) {
        candidateHeader = combined;
        lookaheadUsed = true;
      }
    }

    // Section Header Detection
    const isSectionHeader =
      SECTION_KEYWORD_REGEX.test(candidateHeader) ||
      (line.fontSize >= medianFontSize * 1.25 && candidateHeader.length < 50) ||
      (line.isBold && candidateHeader.length < 40 && candidateHeader === candidateHeader.toUpperCase() && candidateHeader.length > 3);

    if (isSectionHeader) {
      closeLists();
      const headerPt = Math.max(12, roundPt);
      result.push(`<h2 style="font-size: ${headerPt}pt; ${centerAttr}">${escapeHtml(candidateHeader)}</h2>`);
      if (lookaheadUsed) i++;
      continue;
    }

    // Subheading (Job title / Date / University)
    if (line.fontSize >= medianFontSize * 1.12 || (line.isBold && text.length < 80)) {
      closeLists();
      result.push(`<h3 style="font-size: ${roundPt}pt; ${centerAttr}">${escapeHtml(text)}</h3>`);
      continue;
    }

    // Bullet List Item
    const bulletMatch = text.match(BULLET_REGEX);
    if (bulletMatch) {
      if (!inBulletList) {
        closeLists();
        result.push("<ul>");
        inBulletList = true;
      }
      result.push(`<li style="font-size: ${roundPt}pt;">${escapeHtml(bulletMatch[1] || text)}</li>`);
      continue;
    }

    // Numbered List Item
    const numberedMatch = text.match(NUMBERED_REGEX);
    if (numberedMatch) {
      if (!inNumberedList) {
        closeLists();
        result.push("<ol>");
        inNumberedList = true;
      }
      result.push(`<li style="font-size: ${roundPt}pt;">${escapeHtml(numberedMatch[2] || text)}</li>`);
      continue;
    }

    // Standard paragraph
    closeLists();
    const pStyle = `font-size: ${roundPt}pt;${centerAttr ? ` ${centerAttr}` : ""}`;
    result.push(`<p style="${pStyle}">${escapeHtml(text)}</p>`);
  }

  closeLists();

  function closeLists() {
    if (inBulletList) {
      result.push("</ul>");
      inBulletList = false;
    }
    if (inNumberedList) {
      result.push("</ol>");
      inNumberedList = false;
    }
  }

  return result.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function ocrScannedPdf(
  data: Uint8Array,
  onProgress?: (page: number, total: number) => void,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const loadingTask = pdfjs.getDocument({ data: safeBuffer, verbosity: 0 });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const worker = await createWorker("eng", 1, {
    langPath: "/tessdata",
    gzip: true,
  });
  const pageHtmls: string[] = [];
  const canvas = document.createElement("canvas");

  try {
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      if (onProgress) onProgress(pageNum, pageCount);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");

      if (!ctx) continue;

      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

      const ret = await worker.recognize(canvas);
      const rawText = ret.data.text || "";

      const paragraphs = rawText
        .split("\n\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => `<p>${escapeHtml(p.replace(/\n/g, " "))}</p>`);

      pageHtmls.push(paragraphs.length > 0 ? paragraphs.join("") : "<p>No text detected on page</p>");
      page.cleanup();
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    try {
      await pdf.cleanup();
      await loadingTask.destroy();
    } catch {
      // Ignore cleanup errors
    }
    await worker.terminate();
  }

  return pageHtmls.join("<hr/><br/>");
}

