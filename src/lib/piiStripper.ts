/**
 * PII Stripper — removes contact info (email, phone, LinkedIn, URLs, location)
 * from resume header zones only. Content within sections is never modified.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const PHONE_RE =
  /(\+?\d{1,3}[\s.\-]?)?(\(?\d{3}\)?[\s.\-]?)?\d{3}[\s.\-]?\d{4}/g;

const LINKEDIN_RE =
  /(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/(in|pub|company)\/\S+/gi;

const GITHUB_RE = /(https?:\/\/)?github\.com\/\S+/gi;

const GENERIC_URL_RE = /https?:\/\/\S+/g;

const PORTFOLIO_RE = /\b(portfolio|website|blog)\s*[:\-]?\s*\S+/gi;

/** Lines that are purely a location label in the header */
const LOCATION_LINE_RE =
  /^[A-Z][a-zA-Z\s.\-]+,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|ON|BC|QC|AB|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|United States|USA|Canada|UK|United Kingdom|India|Germany|Australia|France)\b(\s*\d{5}(-\d{4})?)?$/i;

const CONTACT_LABEL_RE =
  /^\s*(phone|tel|telephone|cell|mobile|fax|email|e-mail|address|location|contact)\s*[:\-]/i;

/** Separator-delimited contact lines: "email | phone | linkedin | city, state" */
const SEPARATOR_RE = /[|•·;]/;

/**
 * Strip PII from a single line that is in the header zone.
 * Returns the cleaned line, or empty string if the entire line was PII.
 */
export function stripPiiFromLine(line: string): string {
  let cleaned = line;

  // Remove emails
  cleaned = cleaned.replace(EMAIL_RE, "");
  // Remove phone numbers
  cleaned = cleaned.replace(PHONE_RE, "");
  // Remove LinkedIn URLs
  cleaned = cleaned.replace(LINKEDIN_RE, "");
  // Remove GitHub URLs
  cleaned = cleaned.replace(GITHUB_RE, "");
  // Remove generic URLs
  cleaned = cleaned.replace(GENERIC_URL_RE, "");
  // Remove portfolio mentions
  cleaned = cleaned.replace(PORTFOLIO_RE, "");

  // Clean up leftover separators: "|  |  |" → ""
  cleaned = cleaned
    .split(SEPARATOR_RE)
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .join(" | ");

  // If it's just separators/punctuation/whitespace left, discard
  if (/^[\s|•·;,\-–—]*$/.test(cleaned)) return "";

  return cleaned.trim();
}

/**
 * Detect if a standalone line is purely a location (City, State).
 * Only used for header zone lines.
 */
export function isLocationLine(line: string): boolean {
  return LOCATION_LINE_RE.test(line.trim());
}

/**
 * Detect if a line starts with a contact label like "Phone:", "Email:", etc.
 */
export function isContactLabelLine(line: string): boolean {
  return CONTACT_LABEL_RE.test(line.trim());
}

/**
 * Check if a line contains any PII patterns.
 */
export function lineContainsPii(line: string): boolean {
  return (
    EMAIL_RE.test(line) ||
    PHONE_RE.test(line) ||
    LINKEDIN_RE.test(line) ||
    GITHUB_RE.test(line) ||
    GENERIC_URL_RE.test(line)
  );
}
