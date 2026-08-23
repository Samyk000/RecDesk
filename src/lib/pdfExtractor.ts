import * as pdfjs from "pdfjs-dist";

// Initialize worker
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

export interface PdfExtractionResult {
  isScanned: boolean;
  html: string;
  pageCount: number;
  textCharCount: number;
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

  let totalText = "";
  const pageHtmls: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    const items: RawTextItem[] = [];

    for (const rawItem of content.items) {
      if (!("str" in rawItem) || !rawItem.str || !rawItem.str.trim()) continue;

      const str = rawItem.str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
      if (!str) continue;

      const tx = rawItem.transform;
      const fontSize = Math.hypot(tx[0], tx[1]);
      const x = tx[4];
      const y = pageHeight - tx[5]; // Convert PDF bottom-left origin to top-left origin
      const fontName = (rawItem.fontName || "").toLowerCase();
      const isBold = fontName.includes("bold") || fontName.includes("black") || fontName.includes("heavy");

      items.push({
        text: str,
        x,
        y,
        fontSize,
        fontName: rawItem.fontName,
        isBold,
      });

      totalText += str + " ";
    }

    if (items.length === 0) continue;

    // Calculate baseline font size for normal body text on this page
    const fontSizes = items.map((i) => Math.round(i.fontSize));
    fontSizes.sort((a, b) => a - b);
    const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 11;

    // Group items into visual lines (tolerance of vertical y distance < 3px)
    items.sort((a, b) => a.y - b.y || a.x - b.x);

    const lines: { y: number; fontSize: number; isBold: boolean; text: string }[] = [];
    let currentLine: RawTextItem[] = [];

    for (const item of items) {
      if (currentLine.length === 0) {
        currentLine.push(item);
      } else {
        const prev = currentLine[currentLine.length - 1];
        if (Math.abs(item.y - prev.y) <= 4.0) {
          currentLine.push(item);
        } else {
          // Flush current line
          lines.push(mergeLineItems(currentLine));
          currentLine = [item];
        }
      }
    }
    if (currentLine.length > 0) {
      lines.push(mergeLineItems(currentLine));
    }

    // Convert lines to semantic HTML
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

  return {
    isScanned: false,
    html: pageHtmls.join("<hr/><br/>"),
    pageCount,
    textCharCount: trimmedTextLength,
  };
}

function mergeLineItems(items: RawTextItem[]): { y: number; fontSize: number; isBold: boolean; text: string } {
  items.sort((a, b) => a.x - b.x);
  const text = items.map((i) => i.text).join(" ");
  const maxFontSize = Math.max(...items.map((i) => i.fontSize));
  const hasBold = items.some((i) => i.isBold);
  const avgY = items.reduce((acc, i) => acc + i.y, 0) / items.length;

  return {
    y: avgY,
    fontSize: maxFontSize,
    isBold: hasBold,
    text,
  };
}

function formatLinesToHtml(
  lines: { y: number; fontSize: number; isBold: boolean; text: string }[],
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

    // Check for Candidate Name (First Line of First Page if large or bold)
    if (isFirstPage && i === 0 && (line.fontSize >= medianFontSize * 1.3 || line.isBold)) {
      closeLists();
      result.push(`<h1>${escapeHtml(text)}</h1>`);
      continue;
    }

    // Section Header Detection
    const isSectionHeader =
      SECTION_KEYWORD_REGEX.test(text) ||
      (line.fontSize >= medianFontSize * 1.25 && text.length < 50) ||
      (line.isBold && text.length < 40 && text === text.toUpperCase() && text.length > 3);

    if (isSectionHeader) {
      closeLists();
      result.push(`<h2>${escapeHtml(text)}</h2>`);
      continue;
    }

    // Subheading (Job title / Date / University)
    if (line.fontSize >= medianFontSize * 1.12 || (line.isBold && text.length < 80)) {
      closeLists();
      result.push(`<h3>${escapeHtml(text)}</h3>`);
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
      result.push(`<li>${escapeHtml(bulletMatch[1] || text)}</li>`);
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
      result.push(`<li>${escapeHtml(numberedMatch[2] || text)}</li>`);
      continue;
    }

    // Standard paragraph
    closeLists();
    result.push(`<p>${escapeHtml(text)}</p>`);
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

  return result.join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
