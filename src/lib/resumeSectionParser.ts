/**
 * Resume Section Parser — classifies lines of a resume into structured sections.
 * Uses heuristic pattern matching for deterministic, instant classification.
 * Zero content modification: all text is preserved verbatim.
 */

import {
  stripPiiFromLine,
  isLocationLine,
  isContactLabelLine,
} from "./piiStripper";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SectionType =
  | "summary"
  | "skills"
  | "education"
  | "certification"
  | "experience"
  | "projects"
  | "awards"
  | "volunteer"
  | "languages"
  | "publications"
  | "other";

export interface ContentBlock {
  type: "subheading" | "bullet" | "text";
  text: string;
}

export interface ResumeSection {
  type: SectionType;
  heading: string;
  content: ContentBlock[];
}

export interface ParsedResume {
  candidateName: string;
  sections: ResumeSection[];
  originalText: string;
}

export interface TextLine {
  text: string;
  isBold?: boolean;
  isHeading?: boolean;
}

// ─── Flexible Section Header Classifier ──────────────────────────────────────

const BULLET_PREFIX_RE = /^[•\*\-▪–—·●►⬥◆◇○▸▹]\s*/;
const NUMBERED_PREFIX_RE = /^\d{1,2}[.)]\s+/;

function isBulletLine(line: string): boolean {
  return BULLET_PREFIX_RE.test(line.trim()) || NUMBERED_PREFIX_RE.test(line.trim());
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(BULLET_PREFIX_RE, "").replace(NUMBERED_PREFIX_RE, "").trim();
}

/** Clean a header candidate string to its core words */
function cleanHeaderString(str: string): string {
  return str
    .replace(BULLET_PREFIX_RE, "")
    .replace(NUMBERED_PREFIX_RE, "")
    .replace(/[:\-–—|]+$/, "")
    .replace(/\(.*?\)/g, "")
    .trim();
}

export function classifySectionHeading(line: string): SectionType | null {
  const cleaned = cleanHeaderString(line);
  if (!cleaned || cleaned.length > 70 || cleaned.length < 3) return null;

  const lower = cleaned.toLowerCase();

  // Summary patterns
  if (
    /^(summary|professional\s+summary|profile|executive\s+summary|career\s+summary|objective|career\s+objective|about(\s+me)?|overview|professional\s+profile|personal\s+statement|background|bio)$/i.test(
      cleaned
    ) ||
    /^(summary\s+of\s+qualifications|professional\s+overview|career\s+profile)$/i.test(cleaned)
  ) {
    return "summary";
  }

  // Skills patterns
  if (
    /^(skills|technical\s+skills|core\s+competencies|key\s+skills|areas?\s+of\s+expertise|competencies|tools?\s+(&|and)\s+technologies|technologies|proficiencies|technical\s+competencies|technical\s+proficiencies|technical\s+stack|core\s+skills|expertise|skills\s+(&|and)\s+tools)$/i.test(
      cleaned
    ) ||
    (lower.includes("skill") && cleaned.length < 35) ||
    (lower.includes("technolog") && cleaned.length < 35) ||
    (lower.includes("competenc") && cleaned.length < 35)
  ) {
    return "skills";
  }

  // Education patterns
  if (
    /^(education|academic\s+background|academic\s+qualifications|qualifications|academic\s+credentials|degrees?|educational\s+background|academics)$/i.test(
      cleaned
    ) ||
    (lower.includes("educat") && cleaned.length < 35)
  ) {
    return "education";
  }

  // Certifications patterns
  if (
    /^(certifications?|licenses?\s+(&|and)\s+certifications?|certifications?\s+(&|and)\s+licenses?|professional\s+certifications?|accreditations?|credentials?|licenses?)$/i.test(
      cleaned
    ) ||
    (lower.includes("certif") && cleaned.length < 35)
  ) {
    return "certification";
  }

  // Experience patterns
  if (
    /^(experience|work\s+experience|professional\s+experience|employment(\s+history)?|career\s+history|relevant\s+experience|work\s+history|professional\s+background|internships?|work\s+record|experience\s+history)$/i.test(
      cleaned
    ) ||
    (lower.includes("experience") && cleaned.length < 35) ||
    (lower.includes("employment") && cleaned.length < 35)
  ) {
    return "experience";
  }

  // Projects patterns
  if (
    /^(projects?|key\s+projects?|selected\s+projects?|personal\s+projects?|notable\s+projects?|side\s+projects?|academic\s+projects?)$/i.test(
      cleaned
    ) ||
    (lower.includes("project") && cleaned.length < 30)
  ) {
    return "projects";
  }

  // Awards patterns
  if (
    /^(awards?|honors?|awards?\s+(&|and)\s+honors?|achievements?|recognitions?|accomplishments?)$/i.test(
      cleaned
    ) ||
    (lower.includes("award") && cleaned.length < 30) ||
    (lower.includes("honor") && cleaned.length < 30)
  ) {
    return "awards";
  }

  // Volunteer patterns
  if (
    /^(volunteer(\s+experience)?|community(\s+service)?|volunteering|social\s+work|civic\s+engagement)$/i.test(
      cleaned
    ) ||
    (lower.includes("volunteer") && cleaned.length < 35)
  ) {
    return "volunteer";
  }

  // Languages patterns
  if (
    /^(languages?|language\s+skills?|linguistic\s+skills?)$/i.test(cleaned) ||
    (lower.includes("language") && cleaned.length < 25)
  ) {
    return "languages";
  }

  // Publications patterns
  if (
    /^(publications?|research|papers?|published\s+work|research\s+papers?|presentations?)$/i.test(
      cleaned
    ) ||
    (lower.includes("publication") && cleaned.length < 35)
  ) {
    return "publications";
  }

  return null;
}

/**
 * Detect if a line is an unknown/custom section heading.
 */
function isGenericHeading(line: string): boolean {
  const cleaned = cleanHeaderString(line);
  if (!cleaned || cleaned.length > 50 || cleaned.length < 3) return false;
  if (isBulletLine(line)) return false;

  // ALL CAPS check (at least 3 uppercase letters and no lowercase letters)
  const alphaChars = cleaned.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length >= 3 && alphaChars === alphaChars.toUpperCase()) {
    return true;
  }

  return false;
}

/**
 * Detect experience subheadings: "Company Name | Role | Date Range"
 */
const DATE_RANGE_RE =
  /\b(19|20)\d{2}\s*[-–—to]+\s*(19|20)?\d{0,4}\s*(present|current|now)?\b|\b(present|current|now)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(19|20)\d{2}\b/i;

function isExperienceSubheading(line: string): boolean {
  if (line.length > 120 || line.length < 5) return false;
  if (isBulletLine(line)) return false;

  const hasSeparators = /[|—–]/.test(line);
  const hasDate = DATE_RANGE_RE.test(line);

  if (hasSeparators && hasDate) return true;
  if (hasDate && line.length < 80) return true;

  return false;
}

// ─── Name Extraction ─────────────────────────────────────────────────────────

const TITLE_KEYWORDS = [
  "engineer", "developer", "architect", "manager", "lead", "designer",
  "recruiter", "sourcer", "specialist", "director", "consultant", "analyst",
  "administrator", "coordinator", "programmer", "scientist", "executive",
  "associate", "intern", "supervisor", "technician", "auditor", "strategist",
  "representative", "accountant", "officer", "vp", "head of",
];

function isLikelyName(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2 || trimmed.length > 45) return false;
  if (trimmed.includes("@") || trimmed.includes("http") || trimmed.includes("www.")) return false;
  if (/resume|curriculum|page\s+\d|curriculum\s+vitae/i.test(trimmed)) return false;
  if (/^\d/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (TITLE_KEYWORDS.some((k) => lower.includes(k))) return false;

  const alphaRatio = trimmed.replace(/[^a-zA-Z\s]/g, "").length / trimmed.length;
  return alphaRatio > 0.75;
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export function parseResumeSections(lines: TextLine[]): ParsedResume {
  let candidateName = "CANDIDATE";
  const sections: ResumeSection[] = [];
  const rawTextLines: string[] = lines.map((l) => l.text.trim()).filter(Boolean);
  const originalText = rawTextLines.join("\n");

  // ─── Phase 1: Find header boundary (first recognized section heading) ───────
  let firstHeadingIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text.trim();
    if (!text) continue;

    const sectionType = classifySectionHeading(text);
    if (sectionType !== null) {
      firstHeadingIndex = i;
      break;
    }
    if (lines[i].isHeading && isGenericHeading(text) && i > 0) {
      firstHeadingIndex = i;
      break;
    }
  }

  // ─── Phase 2: Extract candidate name ────────────────────────────────────────
  const headerLimit = firstHeadingIndex >= 0 ? firstHeadingIndex : Math.min(8, lines.length);
  for (let i = 0; i < headerLimit; i++) {
    const text = lines[i].text.trim();
    if (!text) continue;

    if (lines[i].isHeading || lines[i].isBold || i === 0) {
      if (isLikelyName(text)) {
        candidateName = text;
        break;
      }
    }
  }

  if (candidateName === "CANDIDATE") {
    // Fallback: take first clean non-PII line
    for (let i = 0; i < headerLimit; i++) {
      const text = lines[i].text.trim();
      if (isLikelyName(text)) {
        candidateName = text;
        break;
      }
    }
  }

  // ─── Phase 3: Check for preamble/summary content before first heading ──────
  let currentSection: ResumeSection | null = null;
  let hasCertification = false;

  const startIndex = firstHeadingIndex >= 0 ? firstHeadingIndex : 0;

  // If there are non-contact text lines before the first heading, capture them as SUMMARY
  if (firstHeadingIndex > 0) {
    const preambleBlocks: ContentBlock[] = [];
    for (let i = 0; i < firstHeadingIndex; i++) {
      const text = lines[i].text.trim();
      if (!text || text === candidateName) continue;
      if (isLocationLine(text) || isContactLabelLine(text)) continue;

      const stripped = stripPiiFromLine(text);
      if (stripped && stripped.length > 5 && !isLikelyName(stripped)) {
        preambleBlocks.push({
          type: "bullet",
          text: stripBulletPrefix(stripped),
        });
      }
    }
    if (preambleBlocks.length > 0) {
      sections.push({
        type: "summary",
        heading: "SUMMARY",
        content: preambleBlocks,
      });
    }
  }

  // ─── Phase 4: Parse all section blocks ──────────────────────────────────────
  for (let i = startIndex; i < lines.length; i++) {
    const rawText = lines[i].text.trim();
    if (!rawText) continue;

    // Ignore repeated candidate name in body headers
    if (rawText.toLowerCase() === candidateName.toLowerCase()) continue;

    // Check if this line is a section heading
    const sectionType = classifySectionHeading(rawText);
    if (sectionType !== null) {
      if (currentSection) sections.push(currentSection);

      if (sectionType === "certification") hasCertification = true;

      currentSection = {
        type: sectionType,
        heading: rawText,
        content: [],
      };
      continue;
    }

    // Check if it's a generic uppercase heading
    if (isGenericHeading(rawText) && (lines[i].isHeading || lines[i].isBold || rawText.length < 35)) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        type: "other",
        heading: rawText,
        content: [],
      };
      continue;
    }

    // If we haven't encountered a heading yet, initialize default SUMMARY
    if (!currentSection) {
      currentSection = {
        type: "summary",
        heading: "SUMMARY",
        content: [],
      };
    }

    // Classify line content within the active section
    if (isBulletLine(rawText)) {
      currentSection.content.push({
        type: "bullet",
        text: stripBulletPrefix(rawText),
      });
    } else if (
      currentSection.type === "experience" &&
      isExperienceSubheading(rawText)
    ) {
      currentSection.content.push({
        type: "subheading",
        text: rawText,
      });
    } else if (
      (lines[i].isBold || lines[i].isHeading) &&
      rawText.length < 80 &&
      !rawText.endsWith(".")
    ) {
      currentSection.content.push({
        type: "subheading",
        text: rawText,
      });
    } else {
      currentSection.content.push({
        type: "bullet",
        text: rawText,
      });
    }
  }

  // Flush last section
  if (currentSection) sections.push(currentSection);

  // ─── Phase 5: Merge certification into education if present ────────────────
  if (hasCertification) {
    const eduIdx = sections.findIndex((s) => s.type === "education");
    const certIdx = sections.findIndex((s) => s.type === "certification");

    if (eduIdx >= 0 && certIdx >= 0) {
      sections[eduIdx].heading = "EDUCATION & CERTIFICATIONS";
      sections[eduIdx].content.push({
        type: "subheading",
        text: "Certifications",
      });
      sections[eduIdx].content.push(...sections[certIdx].content);
      sections.splice(certIdx, 1);
    } else if (certIdx >= 0 && eduIdx < 0) {
      sections[certIdx].type = "education";
      sections[certIdx].heading = "EDUCATION & CERTIFICATIONS";
    }
  }

  return { candidateName, sections, originalText };
}

/**
 * Extract plain text lines from HTML content.
 */
export function htmlToTextLines(html: string): TextLine[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lines: TextLine[] = [];

  function processElement(el: HTMLElement) {
    const tag = el.tagName.toLowerCase();

    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      const text = el.textContent?.trim();
      if (text) {
        lines.push({ text, isBold: true, isHeading: true });
      }
      return;
    }

    if (tag === "li") {
      const text = el.textContent?.trim();
      if (text) {
        lines.push({ text: `• ${text}`, isBold: false });
      }
      return;
    }

    if (["p", "div", "tr"].includes(tag)) {
      // Check if this container has child block elements or <br>
      const hasBlockChildren = el.querySelector("p, div, h1, h2, h3, h4, h5, h6, li, tr");
      if (hasBlockChildren) {
        el.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            processElement(child as HTMLElement);
          } else if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim();
            if (text) lines.push({ text, isBold: false });
          }
        });
        return;
      }

      // Single paragraph or line: split by newline or <br>
      const innerHtml = el.innerHTML;
      if (innerHtml.includes("<br") || innerHtml.includes("\n")) {
        const splitText = el.innerText || el.textContent || "";
        splitText.split("\n").forEach((part) => {
          const trimmed = part.trim();
          if (trimmed) {
            lines.push({
              text: trimmed,
              isBold:
                tag === "strong" ||
                el.querySelector("strong, b") !== null ||
                el.style.fontWeight === "bold",
            });
          }
        });
        return;
      }

      const text = el.textContent?.trim();
      if (text) {
        const isBold =
          tag === "strong" ||
          el.querySelector("strong, b") !== null ||
          el.style.fontWeight === "bold" ||
          parseInt(el.style.fontWeight || "0") >= 700;
        lines.push({ text, isBold });
      }
      return;
    }

    // Default: traverse children
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        processElement(child as HTMLElement);
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) lines.push({ text, isBold: false });
      }
    });
  }

  doc.body.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      processElement(child as HTMLElement);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) lines.push({ text, isBold: false });
    }
  });

  return lines;
}

/**
 * Extract plain text lines from raw text string.
 */
export function plainTextToLines(raw: string): TextLine[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => ({
      text,
      isBold: text === text.toUpperCase() && text.length < 50 && /[A-Z]/.test(text),
    }));
}

/**
 * Sort sections into the canonical client format order.
 * SUMMARY → SKILLS → EDUCATION → EXPERIENCE → extras (in original order)
 */
export function sortSectionsToClientOrder(sections: ResumeSection[]): ResumeSection[] {
  const order: SectionType[] = ["summary", "skills", "education", "experience"];
  const sorted: ResumeSection[] = [];
  const extras: ResumeSection[] = [];

  for (const type of order) {
    const found = sections.filter((s) => s.type === type);
    sorted.push(...found);
  }

  for (const section of sections) {
    if (!order.includes(section.type)) {
      extras.push(section);
    }
  }

  return [...sorted, ...extras];
}
