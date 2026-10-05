import JSZip from "jszip";

export interface DocxParseResult {
  html: string;
  primaryFont: string;
  primaryFontSize: string; // e.g. "11pt" or "14px"
}

// Map common OOXML font names to standard web/system font stacks
const FONT_MAP: Record<string, string> = {
  calibri: "Calibri, Candara, Segoe, sans-serif",
  "calibri light": "Calibri, Candara, Segoe, sans-serif",
  aptos: "Aptos, Calibri, 'Segoe UI', sans-serif",
  "aptos display": "Aptos, Calibri, 'Segoe UI', sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  "times new roman": "Times New Roman, Times, serif",
  times: "Times New Roman, Times, serif",
  georgia: "Georgia, serif",
  garamond: "Garamond, Baskerville, serif",
  cambria: "Cambria, Georgia, serif",
  "plus jakarta sans": "Plus Jakarta Sans, sans-serif",
  inter: "Inter, sans-serif",
  roboto: "Roboto, sans-serif",
  "segoe ui": "Segoe UI, sans-serif",
  "jetbrains mono": "JetBrains Mono, monospace",
  "courier new": "Courier New, monospace",
  consolas: "Consolas, monospace",
};

function normalizeFontFamily(rawFont?: string | null): string | undefined {
  if (!rawFont) return undefined;
  const cleaned = rawFont.replace(/['"]+/g, "").trim();
  const lower = cleaned.toLowerCase();
  for (const [key, stack] of Object.entries(FONT_MAP)) {
    if (lower === key || lower.startsWith(key)) {
      return stack;
    }
  }
  return cleaned;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function extractDocxToStyledHtml(buffer: ArrayBuffer): Promise<DocxParseResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentXmlFile = zip.file("word/document.xml");
    if (!documentXmlFile) {
      throw new Error("Invalid DOCX archive: word/document.xml not found");
    }

    const rawDocXml = await documentXmlFile.async("string");
    // Strip XML namespace prefixes (w:p -> p, w:val -> val) for universal querySelector compatibility
    const cleanDocXml = rawDocXml
      .replace(/<w:([a-zA-Z0-9_-]+)/g, "<$1")
      .replace(/<\/w:([a-zA-Z0-9_-]+)/g, "</$1")
      .replace(/\sw:([a-zA-Z0-9_-]+)=/g, " $1=");

    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanDocXml, "text/xml");

    // Optional: parse styles.xml for document-wide defaults
    let defaultDocFont = "Calibri, Candara, Segoe, sans-serif";
    let defaultDocSizePt = 11;
    const stylesXmlFile = zip.file("word/styles.xml");
    if (stylesXmlFile) {
      try {
        const rawStylesXml = await stylesXmlFile.async("string");
        const cleanStylesXml = rawStylesXml
          .replace(/<w:([a-zA-Z0-9_-]+)/g, "<$1")
          .replace(/<\/w:([a-zA-Z0-9_-]+)/g, "</$1")
          .replace(/\sw:([a-zA-Z0-9_-]+)=/g, " $1=");
        const stylesDoc = parser.parseFromString(cleanStylesXml, "text/xml");
        const docDefaults = stylesDoc.querySelector("docDefaults");
        if (docDefaults) {
          const rFonts = docDefaults.querySelector("rFonts");
          const asciiFont = rFonts?.getAttribute("ascii") || rFonts?.getAttribute("w:ascii") || rFonts?.getAttribute("hAnsi") || rFonts?.getAttribute("w:hAnsi");
          if (asciiFont) {
            const mapped = normalizeFontFamily(asciiFont);
            if (mapped) defaultDocFont = mapped;
          }
          const sz = docDefaults.querySelector("sz");
          const szVal = sz?.getAttribute("val") || sz?.getAttribute("w:val");
          if (szVal) {
            const halfPoints = parseInt(szVal, 10);
            if (!isNaN(halfPoints) && halfPoints > 0) {
              defaultDocSizePt = halfPoints / 2;
            }
          }
        }
      } catch {
        // Silently use defaults if styles.xml fails to parse
      }
    }

    const fontTally: Record<string, number> = {};
    const sizeTally: Record<number, number> = {};

    function recordFont(font: string) {
      const normalized = normalizeFontFamily(font) || font;
      fontTally[normalized] = (fontTally[normalized] || 0) + 1;
    }

    function recordSize(pt: number) {
      sizeTally[pt] = (sizeTally[pt] || 0) + 1;
    }

    const body = doc.querySelector("body");
    if (!body) {
      throw new Error("word/document.xml missing <body> element");
    }

    const htmlParts: string[] = [];
    let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

    function flushList() {
      if (!currentList) return;
      htmlParts.push(`<${currentList.type}>`);
      for (const item of currentList.items) {
        htmlParts.push(`<li>${item}</li>`);
      }
      htmlParts.push(`</${currentList.type}>`);
      currentList = null;
    }

    function parseRun(runEl: Element): string {
      const rPr = runEl.querySelector("rPr");
      let text = "";
      const textNodes = runEl.querySelectorAll("t, tab, br");
      textNodes.forEach((t) => {
        if (t.tagName.toLowerCase().endsWith("tab")) {
          text += "&nbsp;&nbsp;&nbsp;&nbsp;";
        } else if (t.tagName.toLowerCase().endsWith("br")) {
          text += "<br/>";
        } else {
          text += escapeHtml(t.textContent || "");
        }
      });

      if (!text) return "";

      const styles: string[] = [];
      let isBold = false;
      let isItalic = false;
      let isUnderline = false;
      let isStrike = false;
      let highlightColor: string | null = null;

      if (rPr) {
        const b = rPr.querySelector("b");
        if (b && b.getAttribute("w:val") !== "0" && b.getAttribute("w:val") !== "false") {
          isBold = true;
        }

        const i = rPr.querySelector("i");
        if (i && i.getAttribute("w:val") !== "0" && i.getAttribute("w:val") !== "false") {
          isItalic = true;
        }

        const u = rPr.querySelector("u");
        if (u && u.getAttribute("w:val") !== "none") {
          isUnderline = true;
        }

        const strike = rPr.querySelector("strike");
        if (strike && strike.getAttribute("w:val") !== "0" && strike.getAttribute("w:val") !== "false") {
          isStrike = true;
        }

        const color = rPr.querySelector("color");
        const colorVal = color?.getAttribute("w:val");
        if (colorVal && colorVal !== "auto" && colorVal.length === 6) {
          styles.push(`color: #${colorVal}`);
        }

        const highlight = rPr.querySelector("highlight");
        const highlightVal = highlight?.getAttribute("w:val");
        if (highlightVal && highlightVal !== "none") {
          highlightColor = highlightVal;
        }

        const rFonts = rPr.querySelector("rFonts");
        const fontName = rFonts?.getAttribute("w:ascii") || rFonts?.getAttribute("w:hAnsi");
        if (fontName) {
          const mapped = normalizeFontFamily(fontName);
          if (mapped) {
            styles.push(`font-family: ${mapped}`);
            recordFont(mapped);
          }
        }

        const sz = rPr.querySelector("sz");
        const szVal = sz?.getAttribute("w:val");
        if (szVal) {
          const halfPoints = parseInt(szVal, 10);
          if (!isNaN(halfPoints) && halfPoints > 0) {
            const pt = halfPoints / 2;
            styles.push(`font-size: ${pt}pt`);
            recordSize(pt);
          }
        }
      }

      let formatted = text;
      if (styles.length > 0) {
        formatted = `<span style="${styles.join("; ")}">${formatted}</span>`;
      }
      if (isBold) formatted = `<strong>${formatted}</strong>`;
      if (isItalic) formatted = `<em>${formatted}</em>`;
      if (isUnderline) formatted = `<u>${formatted}</u>`;
      if (isStrike) formatted = `<s>${formatted}</s>`;
      if (highlightColor) formatted = `<mark style="background-color: ${highlightColor}">${formatted}</mark>`;

      return formatted;
    }

    function parseParagraph(pEl: Element): { html: string; isListItem: boolean; listType: "ul" | "ol" } {
      const pPr = pEl.querySelector("pPr");
      const pStyles: string[] = [];
      let align = "left";
      let isListItem = false;
      let listType: "ul" | "ol" = "ul";
      let headingTag: "h1" | "h2" | "h3" | null = null;
      let maxFontSize = 0;
      let hasBold = false;

      if (pPr) {
        // Alignment
        const jc = pPr.querySelector("jc");
        const jcVal = jc?.getAttribute("w:val");
        if (jcVal === "center") {
          align = "center";
          pStyles.push("text-align: center");
        } else if (jcVal === "right") {
          align = "right";
          pStyles.push("text-align: right");
        } else if (jcVal === "both") {
          align = "justify";
          pStyles.push("text-align: justify");
        }

        // List item
        const numPr = pPr.querySelector("numPr");
        if (numPr) {
          isListItem = true;
          // Most resumes use bullet lists
          listType = "ul";
        }

        // Heading style
        const pStyle = pPr.querySelector("pStyle");
        const styleVal = pStyle?.getAttribute("w:val")?.toLowerCase() || "";
        if (styleVal.includes("heading1") || styleVal.includes("title")) {
          headingTag = "h1";
        } else if (styleVal.includes("heading2")) {
          headingTag = "h2";
        } else if (styleVal.includes("heading3")) {
          headingTag = "h3";
        }
      }

      // Parse child runs
      const runFragments: string[] = [];
      const children = Array.from(pEl.children);

      for (const child of children) {
        const tag = child.tagName.toLowerCase();
        if (tag.endsWith("r")) {
          const runStr = parseRun(child);
          if (runStr) runFragments.push(runStr);

          // Track font size & bold for heading inference
          const rPr = child.querySelector("rPr");
          if (rPr) {
            const szVal = rPr.querySelector("sz")?.getAttribute("w:val");
            if (szVal) {
              const pt = parseInt(szVal, 10) / 2;
              if (pt > maxFontSize) maxFontSize = pt;
            }
            if (rPr.querySelector("b")) hasBold = true;
          }
        } else if (tag.endsWith("hyperlink")) {
          const innerRuns = Array.from(child.querySelectorAll("r")).map(parseRun).join("");
          if (innerRuns) {
            runFragments.push(innerRuns);
          }
        }
      }

      const innerContent = runFragments.join("");
      const textOnly = innerContent.replace(/<[^>]+>/g, "").trim();

      // Heading inference if not explicitly marked with pStyle
      if (!headingTag && !isListItem && textOnly.length > 0) {
        if (maxFontSize >= 18 || (maxFontSize >= 16 && hasBold && align === "center")) {
          headingTag = "h1";
        } else if (maxFontSize >= 13 && hasBold && textOnly.length < 50) {
          headingTag = "h2";
        } else if (maxFontSize >= 12 && hasBold && textOnly.length < 70) {
          headingTag = "h3";
        }
      }

      if (!innerContent) {
        return { html: "<p><br/></p>", isListItem: false, listType: "ul" };
      }

      const styleAttr = pStyles.length > 0 ? ` style="${pStyles.join("; ")}"` : "";

      if (isListItem) {
        return { html: innerContent, isListItem: true, listType };
      }

      if (headingTag) {
        return { html: `<${headingTag}${styleAttr}>${innerContent}</${headingTag}>`, isListItem: false, listType: "ul" };
      }

      return { html: `<p${styleAttr}>${innerContent}</p>`, isListItem: false, listType: "ul" };
    }

    function parseTable(tblEl: Element): string {
      const rows = tblEl.querySelectorAll("tr");
      const rowHtmls: string[] = [];

      rows.forEach((tr) => {
        const cells = tr.querySelectorAll("tc");
        const cellHtmls: string[] = [];

        cells.forEach((tc) => {
          const pElements = tc.querySelectorAll("p");
          const pContent: string[] = [];
          pElements.forEach((p) => {
            const parsed = parseParagraph(p);
            pContent.push(parsed.html);
          });
          cellHtmls.push(`<td style="padding: 4px 8px; vertical-align: top;">${pContent.join("")}</td>`);
        });

        rowHtmls.push(`<tr>${cellHtmls.join("")}</tr>`);
      });

      return `<table style="width: 100%; border-collapse: collapse; margin: 4px 0;"><tbody>${rowHtmls.join("")}</tbody></table>`;
    }

    // Traverse body elements
    const bodyChildren = Array.from(body.children);
    for (const child of bodyChildren) {
      const tag = child.tagName.toLowerCase();
      if (tag.endsWith("p")) {
        const parsed = parseParagraph(child);
        if (parsed.isListItem) {
          if (!currentList || currentList.type !== parsed.listType) {
            flushList();
            currentList = { type: parsed.listType, items: [parsed.html] };
          } else {
            currentList.items.push(parsed.html);
          }
        } else {
          flushList();
          htmlParts.push(parsed.html);
        }
      } else if (tag.endsWith("tbl")) {
        flushList();
        htmlParts.push(parseTable(child));
      }
    }
    flushList();

    // Determine primary font family
    let primaryFont = defaultDocFont;
    let maxFontCount = 0;
    for (const [font, count] of Object.entries(fontTally)) {
      if (count > maxFontCount) {
        maxFontCount = count;
        primaryFont = font;
      }
    }

    // Determine primary body size
    let primarySizePt = defaultDocSizePt;
    let maxSizeCount = 0;
    for (const [sizeStr, count] of Object.entries(sizeTally)) {
      const size = Number(sizeStr);
      // Exclude large heading sizes from body text calculation
      if (size <= 12.5 && count > maxSizeCount) {
        maxSizeCount = count;
        primarySizePt = size;
      }
    }

    const primaryFontSize = `${primarySizePt}pt`;
    const finalHtml = htmlParts.join("");

    return {
      html: finalHtml || "<p>Empty document</p>",
      primaryFont,
      primaryFontSize,
    };
  } catch (err) {
    console.warn("High-fidelity JSZip docx parser failed, falling back to mammoth:", err);
    // Smooth fallback to mammoth
    const mammothModule = await import("mammoth");
    const mammoth = (mammothModule as any).default ?? mammothModule;
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    return {
      html: result?.value || "<p>Empty document</p>",
      primaryFont: "Calibri, Candara, Segoe, sans-serif",
      primaryFontSize: "11pt",
    };
  }
}
