import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

function parseHexColor(colorStr?: string): string | undefined {
  if (!colorStr) return undefined;
  const trimmed = colorStr.trim().toLowerCase();
  if (
    trimmed === "inherit" ||
    trimmed === "initial" ||
    trimmed === "unset" ||
    trimmed === "currentcolor" ||
    trimmed === "transparent" ||
    trimmed.startsWith("var(")
  ) {
    return undefined;
  }

  // If 6-digit hex: #123456 or 123456
  const hex6Match = trimmed.match(/^#?([0-9a-f]{6})$/i);
  if (hex6Match) {
    return hex6Match[1].toUpperCase();
  }

  // If 3-digit hex: #123 -> 112233
  const hex3Match = trimmed.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex3Match) {
    return (
      hex3Match[1] + hex3Match[1] +
      hex3Match[2] + hex3Match[2] +
      hex3Match[3] + hex3Match[3]
    ).toUpperCase();
  }

  // If rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10)).toString(16).padStart(2, "0");
    const g = Math.min(255, parseInt(rgbMatch[2], 10)).toString(16).padStart(2, "0");
    const b = Math.min(255, parseInt(rgbMatch[3], 10)).toString(16).padStart(2, "0");
    return `${r}${g}${b}`.toUpperCase();
  }

  // Named CSS colors fallback
  const namedColors: Record<string, string> = {
    black: "000000",
    white: "FFFFFF",
    red: "DC2626",
    blue: "2563EB",
    green: "166534",
    gray: "6B7280",
    slate: "475569",
    yellow: "FBBF24",
    purple: "7C3AED",
  };

  if (namedColors[trimmed]) {
    return namedColors[trimmed];
  }

  return undefined;
}

export async function convertHtmlToDocxBytes(htmlContent: string): Promise<number[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const paragraphs: Paragraph[] = [];

  function extractRuns(element: HTMLElement): TextRun[] {
    const runs: TextRun[] = [];

    function traverse(
      n: Node,
      fmt: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strike?: boolean;
        color?: string;
        highlight?: string;
        font?: string;
        size?: number;
      }
    ) {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent;
        if (text) {
          const validatedColor = parseHexColor(fmt.color);
          const validatedHighlight = parseHexColor(fmt.highlight);

          runs.push(
            new TextRun({
              text,
              bold: fmt.bold,
              italics: fmt.italic,
              underline: fmt.underline ? {} : undefined,
              strike: fmt.strike,
              color: validatedColor,
              shading: validatedHighlight ? { fill: validatedHighlight } : undefined,
              font: fmt.font || "Times New Roman",
              size: fmt.size,
            })
          );
        }
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const nextFmt = { ...fmt };

        if (tag === "strong" || tag === "b") nextFmt.bold = true;
        if (tag === "em" || tag === "i") nextFmt.italic = true;
        if (tag === "u") nextFmt.underline = true;
        if (tag === "s" || tag === "strike") nextFmt.strike = true;
        if (tag === "mark") nextFmt.highlight = el.style.backgroundColor || "#FEF08A";
        if (el.style.backgroundColor && el.style.backgroundColor !== "transparent") {
          nextFmt.highlight = el.style.backgroundColor;
        }
        if (el.style.color && el.style.color !== "inherit") {
          nextFmt.color = el.style.color;
        }
        if (el.style.fontFamily) {
          nextFmt.font = el.style.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
        }
        if (el.style.fontSize) {
          const px = parseFloat(el.style.fontSize);
          if (!isNaN(px) && px > 0) {
            nextFmt.size = Math.round(px * 1.5);
          }
        }

        el.childNodes.forEach((child) => traverse(child, nextFmt));
      }
    }

    traverse(element, { font: "Times New Roman" });
    return runs.length > 0 ? runs : [new TextRun({ text: element.textContent || "", font: "Times New Roman" })];
  }

  function processNode(node: Node, parentAlign?: (typeof AlignmentType)[keyof typeof AlignmentType]) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      let align = parentAlign;
      const textAlign = el.style.textAlign;
      if (textAlign === "center") align = AlignmentType.CENTER;
      else if (textAlign === "right") align = AlignmentType.RIGHT;
      else if (textAlign === "justify") align = AlignmentType.JUSTIFIED;
      else if (textAlign === "left") align = AlignmentType.LEFT;

      if (tag === "h1") {
        paragraphs.push(
          new Paragraph({
            children: extractRuns(el),
            heading: HeadingLevel.HEADING_1,
            alignment: align,
            spacing: { before: 200, after: 120 },
          })
        );
      } else if (tag === "h2") {
        paragraphs.push(
          new Paragraph({
            children: extractRuns(el),
            heading: HeadingLevel.HEADING_2,
            alignment: align,
            spacing: { before: 160, after: 100 },
          })
        );
      } else if (tag === "h3") {
        paragraphs.push(
          new Paragraph({
            children: extractRuns(el),
            heading: HeadingLevel.HEADING_3,
            alignment: align,
            spacing: { before: 120, after: 80 },
          })
        );
      } else if (tag === "p") {
        paragraphs.push(
          new Paragraph({
            children: extractRuns(el),
            alignment: align,
            spacing: { after: 100, line: 276 },
          })
        );
      } else if (tag === "ul") {
        el.querySelectorAll(":scope > li").forEach((li) => {
          paragraphs.push(
            new Paragraph({
              children: extractRuns(li as HTMLElement),
              bullet: { level: 0 },
              alignment: align,
              spacing: { after: 60 },
            })
          );
        });
      } else if (tag === "ol") {
        el.querySelectorAll(":scope > li").forEach((li) => {
          paragraphs.push(
            new Paragraph({
              children: extractRuns(li as HTMLElement),
              bullet: { level: 0 },
              alignment: align,
              spacing: { after: 60 },
            })
          );
        });
      } else {
        node.childNodes.forEach((child) => processNode(child, align));
      }
    }
  }

  doc.body.childNodes.forEach((child) => processNode(child));

  const docxDocument = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: "" })],
      },
    ],
  });

  const blob = await Packer.toBlob(docxDocument);
  const arrayBuffer = await blob.arrayBuffer();
  return Array.from(new Uint8Array(arrayBuffer));
}
