import { completeOpenRouterChat } from "./openRouterClient";
import { type TextLine } from "./resumeSectionParser";
import { lineContainsPii } from "./piiStripper";

export interface RawBlock {
  id: number;
  text: string;
}

export interface SkillCategoryMapping {
  category?: string;
  item_blocks: number[];
}

export interface EducationDegree {
  institution: string;
  degree: string;
  dates?: string;
  location?: string;
  raw_blocks?: number[];
}

export interface CredentialAward {
  title: string;
  year?: string;
  bullet_blocks?: number[];
}

export interface EducationCredentialMapping {
  degrees?: EducationDegree[];
  credentials_and_awards?: CredentialAward[];
  degree_blocks?: number[];
  certification_blocks?: number[];
}

export interface ExperienceMapping {
  company?: string;
  role?: string;
  dates?: string;
  location?: string;
  raw_header_block?: number;
  bullet_blocks: number[];
}

export interface AdditionalSectionMapping {
  heading: string;
  bullet_blocks: number[];
}

export interface BlockIdResumeStructure {
  candidate_name: string;
  pii_blocks: number[];
  summary_blocks: number[];
  skills: SkillCategoryMapping[];
  education_and_credentials?: EducationCredentialMapping;
  education_and_certifications?: EducationCredentialMapping;
  experience: ExperienceMapping[];
  additional_sections?: AdditionalSectionMapping[];
}

/**
 * Chunks extracted text lines into clean, indexed text blocks.
 */
export function chunkDocumentIntoBlocks(lines: (TextLine | string)[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let id = 0;

  for (const item of lines) {
    const rawText = typeof item === "string" ? item : item.text;
    const clean = rawText.replace(/\r\n/g, "\n").trim();
    if (!clean) continue;

    // Filter obvious PDF footer artifacts like "Page 1 of 3", "Page 2/4"
    if (/^page\s+\d+(\s+of\s+\d+|\/\d+)?$/i.test(clean)) continue;

    blocks.push({
      id: id++,
      text: clean,
    });
  }

  return blocks;
}

/**
 * Builds the strict system prompt for the AI Block-ID mapping
 */
function buildPromptMessages(blocks: RawBlock[]): { role: "system" | "user"; content: string }[] {
  const numberedList = blocks.map((b) => `[${b.id}]: ${b.text}`).join("\n");

  const systemPrompt = `You are an elite, highly precise Resume Structure Analyzer.
Your task is to analyze an indexed list of resume text blocks and map their integer IDs into a structured JSON schema following the exact universal client submission layout.

UNIVERSAL CLIENT SUBMISSION FORMAT SPECIFICATION:
1. "candidate_name": The candidate's full name in Title Case (e.g. "Terry Eppler", "Priti I. Goswami"). Extract ONLY the name (strip any job titles, degrees, or contact info mixed into the header). IMPORTANT: If the name contains nicknames or quotes, use single quotes (e.g. "Adetutu 'Jacob' Falana").
2. "pii_blocks": List ALL block IDs containing contact info to be stripped (emails, phone numbers, LinkedIn URLs, GitHub URLs, portfolio URLs, home addresses, city/state of residence, postal codes).
3. "summary_blocks": Block IDs belonging to Executive Summary, Professional Summary, Profile, or Overview.
4. "skills": Array of skill categories with category title and item blocks (e.g. "Agentic AI", "Large Language Models", "Cloud & LLMOps", "Machine & Deep Learning", "Programming Languages", "Core Competencies", "Tools & Methodologies").
5. "education_and_credentials":
   - "degrees": Array of educational degrees (institution, degree/major, dates, location, raw_blocks).
   - "credentials_and_awards": Array of certifications, licenses, honors, medals, or awards (e.g. "FEMA - Under Secretary's Medal", "US EPA - Gold Medal", "AWS Certified Solutions Architect", "PMP®", "CSM®", "SAFe 5®").
6. "experience": Array of job positions in reverse chronological order:
   - "company": Company / Organization name and division (e.g. "US EPA – Headquarters", "Citigroup", "Bank of America")
   - "role": Job title (e.g. "Senior AI Engineer", "Data Scientist", "Product Owner")
   - "dates": Employment date range (e.g. "Oct 2021 - Oct 2025", "Aug 2007 – Oct 2021")
   - "location": Job location (e.g. "Washington, DC", "Dallas, TX", "Remote")
   - "bullet_blocks": Array of block IDs for accomplishment bullets and responsibilities under this job
7. "additional_sections": Array of any other sections (e.g. "PUBLICATIONS", "VOLUNTEER EXPERIENCE", "LANGUAGES").

CRITICAL RULES:
- Output ONLY valid JSON.
- DO NOT rewrite, paraphrase, or alter candidate wording. Text is referenced verbatim using block IDs.
- Ensure all double quotes inside string fields are escaped.

JSON SCHEMA TO RETURN:
{
  "candidate_name": "Terry Eppler",
  "pii_blocks": [1, 2],
  "summary_blocks": [3],
  "skills": [
    {
      "category": "Agentic AI",
      "item_blocks": [4]
    }
  ],
  "education_and_credentials": {
    "degrees": [
      {
        "institution": "University of Maryland",
        "degree": "Bachelor of Science in Management",
        "dates": "2000 – 2003",
        "location": "College Park, MD",
        "raw_blocks": [5, 6]
      }
    ],
    "credentials_and_awards": [
      {
        "title": "FEMA - Under Secretary's Medal",
        "year": "2008",
        "bullet_blocks": [7, 8]
      }
    ]
  },
  "experience": [
    {
      "company": "US EPA – Headquarters",
      "role": "Senior AI Engineer",
      "dates": "Oct 2021 - Oct 2025",
      "location": "Washington, DC",
      "bullet_blocks": [9, 10]
    }
  ],
  "additional_sections": []
}`;

  const userPrompt = `Here is the indexed list of resume text blocks:\n\n${numberedList}\n\nMap these blocks into the required JSON schema now.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

/**
 * Resilient JSON parser that repairs unescaped inner quotes and common LLM syntax issues.
 */
export function robustParseJson<T>(rawText: string): T {
  let text = rawText.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Attempt 1: Standard JSON.parse
  try {
    return JSON.parse(text);
  } catch {
    // Attempt 2: Repair unescaped quotes in string values line by line
    const repaired = text
      .split("\n")
      .map((line) => {
        // Match key: "value" patterns
        const match = line.match(/^(\s*"[a-zA-Z0-9_]+"\s*:\s*)"(.*)"(\s*,?\s*)$/);
        if (match) {
          const prefix = match[1];
          const innerVal = match[2];
          const suffix = match[3];
          // Replace any unescaped double quotes inside the inner string
          const escapedInner = innerVal.replace(/(?<!\\)"/g, '\\"');
          return `${prefix}"${escapedInner}"${suffix}`;
        }
        return line;
      })
      .join("\n")
      .replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas

    try {
      return JSON.parse(repaired);
    } catch {
      // Attempt 3: Aggressive slice between first { and last }
      const firstBrace = repaired.indexOf("{");
      const lastBrace = repaired.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        const sliced = repaired.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(sliced);
        } catch {}
      }

      // Attempt 4: Clean all unescaped quotes between colons and commas
      const relaxed = repaired.replace(
        /:\s*"([^"]*(?:"[^"]*)*)"(\s*[,}])/g,
        (_, p1, p2) => {
          return `: "${p1.replace(/(?<!\\)"/g, "'")}"${p2}`;
        }
      );
      try {
        return JSON.parse(relaxed);
      } catch (finalErr) {
        console.error("Failed to parse AI JSON response after all repair attempts:", rawText);
        throw new Error("The AI returned an invalid JSON response structure. Please try again.");
      }
    }
  }
}

/**
 * Runs Block-ID cognitive analysis on the document via OpenRouter
 */
export async function parseResumeWithBlockIdAI(
  blocks: RawBlock[],
  model?: string
): Promise<{ structure: BlockIdResumeStructure; rawBlocks: RawBlock[] }> {
  if (blocks.length === 0) {
    throw new Error("No text blocks found in document.");
  }

  const messages = buildPromptMessages(blocks);

  const responseText = await completeOpenRouterChat(messages, {
    model,
    temperature: 0.05,
    response_format: { type: "json_object" },
  });

  const structure = robustParseJson<BlockIdResumeStructure>(responseText);

  // Fallback candidate name if empty
  if (!structure.candidate_name) {
    const firstNonPii = blocks.find((b) => !lineContainsPii(b.text));
    structure.candidate_name = firstNonPii ? firstNonPii.text.slice(0, 40) : "Candidate";
  }

  return { structure, rawBlocks: blocks };
}

/**
 * Assembles the structured JSON into exact client-formatted HTML following the sample resume:
 * Sequence: Candidate Name -> PROFESSIONAL SUMMARY: -> SKILLS: -> EDUCATION & CREDENTIALS: -> WORK EXPERIENCE:
 */
export function reassembleHtmlFromBlocks(
  structure: BlockIdResumeStructure,
  blocks: RawBlock[]
): string {
  const blockMap = new Map<number, string>();
  blocks.forEach((b) => blockMap.set(b.id, b.text));

  const getBlocksText = (ids: number[] = []): string[] =>
    ids.map((id) => blockMap.get(id) || "").filter((t) => t.length > 0);

  const candidateName = (structure.candidate_name || "Candidate").trim();

  // Helper for bullet rendering
  const renderBullets = (items: string[]) => {
    return items
      .map((item) => {
        const clean = item.replace(/^[•\-\*\u2022\u2023\u25E6]\s*/, "").trim();
        return `<p style="margin-left: 0; margin-top: 2px; margin-bottom: 4px; line-height: 1.45;">• ${escapeHtml(
          clean
        )}</p>`;
      })
      .join("\n");
  };

  const sections: string[] = [];

  // 1. Candidate Name (Centered, Bold, 11pt, Times New Roman, no PII)
  sections.push(
    `<h1 style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 12px; margin-top: 0; line-height: 1.25;">${escapeHtml(
      candidateName
    )}</h1>`
  );

  // 2. PROFESSIONAL SUMMARY: (11pt Bold, Bullets for each sentence after period)
  const summaryBullets = getBlocksText(structure.summary_blocks);
  if (summaryBullets.length > 0) {
    sections.push(
      `<h2 style="font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-top: 12px; margin-bottom: 4px; line-height: 1.3;">PROFESSIONAL SUMMARY:</h2>`
    );

    // Split summary by period into distinct bullet points
    const fullSummary = summaryBullets.join(" ");
    const summarySentences = fullSummary
      .split(/(?<=\.)\s+|\n+/)
      .map((s) => s.replace(/^[•\-\*\u2022\u2023\u25E6]\s*/, "").trim())
      .filter((s) => s.length > 5);

    if (summarySentences.length > 0) {
      for (const sentence of summarySentences) {
        sections.push(
          `<p style="font-size: 10pt; margin-left: 0; margin-top: 2px; margin-bottom: 3px; line-height: 1.4;">• ${escapeHtml(
            sentence
          )}</p>`
        );
      }
    } else {
      sections.push(renderBullets(summaryBullets));
    }
  }

  // 3. SKILLS: (11pt Bold Heading, 10pt items)
  if (structure.skills && structure.skills.length > 0) {
    sections.push(
      `<h2 style="font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-top: 12px; margin-bottom: 4px; line-height: 1.3;">SKILLS:</h2>`
    );

    for (const skillGroup of structure.skills) {
      const items = getBlocksText(skillGroup.item_blocks);
      if (items.length === 0) continue;

      const categoryLabel = skillGroup.category ? skillGroup.category.trim().replace(/:+$/, "") : "";
      const itemsText = items
        .map((it) => it.replace(/^[•\-\*\u2022\u2023\u25E6]\s*/, "").trim())
        .join(", ");

      if (categoryLabel) {
        sections.push(
          `<p style="font-size: 10pt; margin-top: 2px; margin-bottom: 2px; line-height: 1.4;"><strong>${escapeHtml(
            categoryLabel
          )}:</strong> ${escapeHtml(itemsText)}</p>`
        );
      } else {
        sections.push(renderBullets(items));
      }
    }
  }

  // 4. EDUCATION & CREDENTIALS: (11pt Bold Heading, 10pt items)
  const eduCreds = structure.education_and_credentials;
  const degrees = eduCreds?.degrees || [];
  const credentials = eduCreds?.credentials_and_awards || [];
  
  // Backward compatibility check if AI returned older format
  const legacyDegreeBlocks = getBlocksText(eduCreds?.degree_blocks);
  const legacyCertBlocks = getBlocksText(eduCreds?.certification_blocks);

  const hasEducation = degrees.length > 0 || credentials.length > 0 || legacyDegreeBlocks.length > 0 || legacyCertBlocks.length > 0;

  if (hasEducation) {
    sections.push(
      `<h2 style="font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-top: 12px; margin-bottom: 4px; line-height: 1.3;">EDUCATION &amp; CREDENTIALS:</h2>`
    );

    // Render structured degrees
    if (degrees.length > 0) {
      for (const deg of degrees) {
        const inst = deg.institution ? deg.institution.trim() : "";
        const dates = deg.dates ? deg.dates.trim() : "";
        const degreeInfo = [deg.degree, deg.location].filter(Boolean).join(" - ");

        sections.push(
          `<p style="font-size: 10pt; display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; margin-bottom: 1px; line-height: 1.35;"><span>• <strong>${escapeHtml(
            inst
          )}</strong></span><span style="font-weight: bold;">${escapeHtml(dates)}</span></p>`
        );
        if (degreeInfo) {
          sections.push(
            `<p style="font-size: 10pt; margin-left: 14px; margin-top: 0; margin-bottom: 3px; line-height: 1.35;">${escapeHtml(
              degreeInfo
            )}</p>`
          );
        }
      }
    } else if (legacyDegreeBlocks.length > 0) {
      sections.push(renderBullets(legacyDegreeBlocks));
    }

    // Render credentials / awards / honors
    if (credentials.length > 0) {
      for (const cred of credentials) {
        const title = cred.title ? cred.title.trim() : "";
        const year = cred.year ? cred.year.trim() : "";
        const bullets = getBlocksText(cred.bullet_blocks || []);

        if (title) {
          sections.push(
            `<p style="font-size: 10pt; display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px; margin-bottom: 1px; line-height: 1.35;"><span><strong>${escapeHtml(
              title
            )}</strong></span><span style="font-weight: bold;">${escapeHtml(year)}</span></p>`
          );
        }

        if (bullets.length > 0) {
          sections.push(renderBullets(bullets));
        }
      }
    } else if (legacyCertBlocks.length > 0) {
      sections.push(renderBullets(legacyCertBlocks));
    }
  }

  // 5. WORK EXPERIENCE: (11pt Bold Heading, 10pt Bold job headers with enter spacing between jobs)
  if (structure.experience && structure.experience.length > 0) {
    sections.push(
      `<h2 style="font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-top: 14px; margin-bottom: 4px; line-height: 1.3;">WORK EXPERIENCE:</h2>`
    );

    structure.experience.forEach((exp, idx) => {
      const companyLocation = [exp.company, exp.location].filter(Boolean).join(" - ");
      const dates = exp.dates ? exp.dates.trim() : "";
      const role = exp.role ? exp.role.trim() : "";

      // Space / Enter between experience items (14px top margin)
      const topMargin = idx === 0 ? "6px" : "14px";

      // Header Row (Left: Company - Location, Right: Dates) in 10pt Bold
      if (companyLocation || dates) {
        sections.push(
          `<p style="font-size: 10pt; font-weight: bold; display: flex; justify-content: space-between; align-items: baseline; margin-top: ${topMargin}; margin-bottom: 1px; line-height: 1.35;"><span><strong>${escapeHtml(
            companyLocation
          )}</strong></span><span style="font-weight: bold;">${escapeHtml(dates)}</span></p>`
        );
      }

      // Role Line in 10pt Bold
      if (role) {
        sections.push(
          `<p style="font-size: 10pt; font-weight: bold; margin-top: 0; margin-bottom: 3px; line-height: 1.35;"><strong>${escapeHtml(
            role
          )}</strong></p>`
        );
      }

      // Accomplishment bullets in 10pt
      const bullets = getBlocksText(exp.bullet_blocks);
      if (bullets.length > 0) {
        sections.push(renderBullets(bullets));
      }
    });
  }

  // 6. ADDITIONAL SECTIONS (Projects, Publications, Languages, etc.)
  if (structure.additional_sections && structure.additional_sections.length > 0) {
    for (const sec of structure.additional_sections) {
      const bullets = getBlocksText(sec.bullet_blocks);
      if (bullets.length === 0) continue;

      const heading = sec.heading ? `${sec.heading.toUpperCase().trim().replace(/:+$/, "")}:` : "ADDITIONAL INFORMATION:";
      sections.push(
        `<h2 style="font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-top: 14px; margin-bottom: 4px; line-height: 1.3;">${escapeHtml(
          heading
        )}</h2>`
      );
      sections.push(renderBullets(bullets));
    }
  }

  return sections.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
