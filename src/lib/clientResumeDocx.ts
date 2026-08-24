/**
 * Client Resume DOCX Generator — assembles a parsed resume into the
 * universal client-ready Word document format.
 *
 * Format:
 *   NAME (centered, bold, uppercase, Times New Roman 14pt)
 *   SECTION HEADING (bold, uppercase, TNR 12pt)
 *   • Bullet content (TNR 11pt)
 *   Subheading (bold, TNR 11pt)
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from "docx";
import type { ParsedResume, ResumeSection, ContentBlock } from "./resumeSectionParser";
import { sortSectionsToClientOrder } from "./resumeSectionParser";

// ─── Style Constants ─────────────────────────────────────────────────────────

const FONT = "Times New Roman";
const NAME_SIZE = 22; // 11pt × 2 (half-points)
const HEADING_SIZE = 22; // 11pt × 2
const BODY_SIZE = 20; // 10pt × 2

// ─── Heading Label Overrides ─────────────────────────────────────────────────

function getSectionHeadingLabel(section: ResumeSection): string {
  // Use canonical labels for known sections
  switch (section.type) {
    case "summary":
      return "PROFESSIONAL SUMMARY:";
    case "skills":
      return "SKILLS:";
    case "education":
      return "EDUCATION & CREDENTIALS:";
    case "experience":
      return "WORK EXPERIENCE:";
    case "projects":
      return "PROJECTS:";
    case "awards":
      return "AWARDS & HONORS:";
    case "volunteer":
      return "VOLUNTEER EXPERIENCE:";
    case "languages":
      return "LANGUAGES:";
    case "publications":
      return "PUBLICATIONS:";
    case "certification":
      return "CERTIFICATIONS:";
    case "other":
      return `${section.heading.toUpperCase().replace(/:+$/, "")}:`;
    default:
      return `${section.heading.toUpperCase().replace(/:+$/, "")}:`;
  }
}

// ─── DOCX Builders ───────────────────────────────────────────────────────────

function nameParagraph(name: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: name.toUpperCase(),
        bold: true,
        font: FONT,
        size: NAME_SIZE,
      }),
    ],
  });
}

function sectionHeadingParagraph(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({
        text: label,
        bold: true,
        font: FONT,
        size: HEADING_SIZE,
      }),
    ],
  });
}

function subheadingParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [
      new TextRun({
        text,
        bold: true,
        font: FONT,
        size: BODY_SIZE,
      }),
    ],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 360 }, // 0.25 inch indent
    children: [
      new TextRun({
        text: "•  ",
        font: FONT,
        size: BODY_SIZE,
      }),
      new TextRun({
        text,
        font: FONT,
        size: BODY_SIZE,
      }),
    ],
  });
}

function textParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: BODY_SIZE,
      }),
    ],
  });
}

function contentBlockToParagraph(block: ContentBlock): Paragraph {
  switch (block.type) {
    case "subheading":
      return subheadingParagraph(block.text);
    case "bullet":
      return bulletParagraph(block.text);
    case "text":
      return textParagraph(block.text);
    default:
      return textParagraph(block.text);
  }
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * Generate a client-formatted DOCX from a parsed resume.
 * Returns raw byte array suitable for writing to file.
 */
export async function generateClientResumeDocx(
  parsed: ParsedResume,
): Promise<number[]> {
  const paragraphs: Paragraph[] = [];

  // 1. Name at top
  paragraphs.push(nameParagraph(parsed.candidateName));

  // 2. Sections in canonical order
  const ordered = sortSectionsToClientOrder(parsed.sections);

  for (const section of ordered) {
    // Skip empty sections
    if (section.content.length === 0) continue;

    // Section heading
    const label = getSectionHeadingLabel(section);
    paragraphs.push(sectionHeadingParagraph(label));

    // Section content
    for (const block of section.content) {
      paragraphs.push(contentBlockToParagraph(block));
    }
  }

  // Fallback: if no sections were found, add a note
  if (paragraphs.length <= 1) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "No resume content could be extracted. Please verify the uploaded file.",
            font: FONT,
            size: BODY_SIZE,
            italics: true,
          }),
        ],
      }),
    );
  }

  // 3. Build document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch (Narrow)
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  // 4. Pack to bytes
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  return Array.from(new Uint8Array(arrayBuffer));
}

/**
 * Generate a simple HTML preview string from a parsed resume.
 * Used for the in-app preview before download.
 */
export function generatePreviewHtml(parsed: ParsedResume): string {
  const parts: string[] = [];

  // Name
  parts.push(
    `<h1 style="text-align:center;font-family:'Times New Roman',serif;font-weight:bold;text-transform:uppercase;font-size:18px;margin-bottom:16px;">${escapeHtml(parsed.candidateName)}</h1>`,
  );

  const ordered = sortSectionsToClientOrder(parsed.sections);

  for (const section of ordered) {
    if (section.content.length === 0) continue;

    const label = getSectionHeadingLabel(section);
    parts.push(
      `<h2 style="font-family:'Times New Roman',serif;font-weight:bold;text-transform:uppercase;font-size:14px;margin-top:20px;margin-bottom:8px;">${escapeHtml(label)}</h2>`,
    );

    for (const block of section.content) {
      if (block.type === "subheading") {
        parts.push(
          `<p style="font-family:'Times New Roman',serif;font-weight:bold;font-size:12px;margin:8px 0 4px;">${escapeHtml(block.text)}</p>`,
        );
      } else if (block.type === "bullet") {
        parts.push(
          `<p style="font-family:'Times New Roman',serif;font-size:12px;margin:2px 0;padding-left:20px;">• ${escapeHtml(block.text)}</p>`,
        );
      } else {
        parts.push(
          `<p style="font-family:'Times New Roman',serif;font-size:12px;margin:2px 0;">${escapeHtml(block.text)}</p>`,
        );
      }
    }
  }

  return parts.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
