use std::sync::LazyLock;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

static RE_EMAIL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").expect("valid email regex")
});

static RE_PHONE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}").expect("valid phone regex")
});

static RE_LINKEDIN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(https?://)?([a-z]{2,3}\.)?linkedin\.com/in/[a-zA-Z0-9-_%]+/?").expect("valid linkedin regex")
});

static RE_TITLE_PREFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(title|role|position|current position|current role|headline):\s*(.+)").expect("valid title prefix regex")
});

static RE_US_STATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b[A-Za-z\s.-]+,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|ON|BC|QC|AB)\b").expect("valid us state regex")
});

static RE_EXPLICIT_LOC: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(location|address|based in|residing in|city):\s*([^\n\r,|]+(?:,\s*[^\n\r,|]+)?)").expect("valid explicit loc regex")
});

static RE_US_CITY_STATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b([A-Z][a-zA-Z\s.-]+),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|ON|BC|QC|AB)\b(?:\s*\d{5})?").expect("valid us city state regex")
});

static RE_FULL_STATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b([A-Z][a-zA-Z\s.-]+),\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|United States|USA|Canada|UK|United Kingdom|India|Germany|Australia|France)\b").expect("valid full state regex")
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedCandidateProfile {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub current_role: Option<String>,
    pub skills: Vec<String>,
    pub location: Option<String>,
    pub linkedin_url: Option<String>,
    pub notes_summary: Option<String>,
}

#[tauri::command]
pub async fn parse_resume_text(
    _app: AppHandle,
    text: String,
    filename: Option<String>,
    embedded_links: Option<Vec<String>>,
) -> Result<ExtractedCandidateProfile, String> {
    if text.trim().is_empty() {
        return Err("Pasted resume text is empty".into());
    }

    let links = embedded_links.unwrap_or_default();
    let profile = extract_profile_from_text(&text, filename.as_deref(), &links);
    Ok(sanitize_and_verify_profile(profile, &text))
}

pub fn extract_profile_from_text(
    raw: &str,
    filename: Option<&str>,
    embedded_links: &[String],
) -> ExtractedCandidateProfile {
    let clean_text = raw.replace("\r\n", "\n");
    let lines: Vec<&str> = clean_text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    // 1. Email extraction: check embedded mailto links first, then RFC 5322 regex in text
    let mut email = None;
    for link in embedded_links {
        if link.to_lowercase().starts_with("mailto:") {
            let address = link["mailto:".len()..].split('?').next().unwrap_or("").trim();
            if RE_EMAIL.is_match(address) {
                email = Some(address.to_string());
                break;
            }
        }
    }
    if email.is_none() {
        email = RE_EMAIL.find(&clean_text).map(|m| {
            let s = m.as_str().trim();
            s.trim_end_matches(&['.', ',', ';', ')', ']'][..]).to_string()
        });
    }

    // 2. Phone extraction (validated against false-positive years e.g. 2018-2022)
    let phone = RE_PHONE
        .find_iter(&clean_text)
        .map(|m| m.as_str().trim().to_string())
        .find(|p| is_valid_phone(p));

    // 3. LinkedIn URL extraction: check embedded links first, then regex in text
    let mut linkedin_url = None;
    for link in embedded_links {
        if link.to_lowercase().contains("linkedin.com/in/") {
            linkedin_url = Some(clean_linkedin_url(link));
            break;
        }
    }
    if linkedin_url.is_none() {
        linkedin_url = RE_LINKEDIN.find(&clean_text).map(|m| clean_linkedin_url(m.as_str()));
    }

    // 4. Candidate Name Extraction (Multi-Signal Scoring Engine)
    let name = extract_candidate_name(&lines, filename);

    // 5. Current Role / Title Extraction (Dual-Zone: Header Headline + Experience Anchor)
    let current_role = extract_candidate_role(&lines, &name);

    // 6. Comprehensive Location Extraction
    let location = extract_location_from_text(&lines, &clean_text);

    // 7. Skills extraction with whole-word boundary matching
    let common_skills = [
        "React", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "C++", "C#", "Rust", "Go", "Golang",
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "SQL", "PostgreSQL", "MongoDB", "Redis", "GraphQL",
        "HTML", "CSS", "Tailwind", "Next.js", "Vue", "Angular", "Git", "CI/CD", "Linux", "Terraform",
        "Machine Learning", "Figma", "UI/UX", "Agile", "Scrum", "Tauri", "Svelte", "Ruby", "PHP",
        "Technical Recruiting", "Sourcing", "Executive Search", "Talent Acquisition", "Screening",
    ];

    let clean_text_lower = clean_text.to_lowercase();
    let mut detected_skills = Vec::new();
    for skill in &common_skills {
        let skill_lower = skill.to_lowercase();
        if contains_skill_word(&clean_text_lower, &skill_lower) {
            detected_skills.push(skill.to_string());
        }
    }

    ExtractedCandidateProfile {
        name,
        email,
        phone,
        current_role,
        skills: detected_skills,
        location,
        linkedin_url,
        notes_summary: None,
    }
}

/// Normalizes LinkedIn URLs by ensuring https://, stripping tracking query params and trailing slashes
fn clean_linkedin_url(raw: &str) -> String {
    let mut cleaned = raw.trim().to_string();
    if let Some(q_idx) = cleaned.find('?') {
        cleaned = cleaned[..q_idx].to_string();
    }
    cleaned = cleaned.trim_end_matches('/').to_string();
    if !cleaned.starts_with("http://") && !cleaned.starts_with("https://") {
        cleaned = format!("https://{}", cleaned);
    }
    cleaned
}

/// Extracts candidate name using multi-signal scoring (filename anchor, stopword filter, capitalization, positioning)
fn extract_candidate_name(lines: &[&str], filename: Option<&str>) -> String {
    // 1. Extract semantic name tokens from filename if available (e.g. "alex_rivera_resume.pdf" -> ["alex", "rivera"])
    let mut filename_tokens: Vec<String> = Vec::new();
    if let Some(fname) = filename {
        let base = fname.split('.').next().unwrap_or(fname).to_lowercase();
        let noise = [
            "resume", "cv", "curriculum", "vitae", "profile", "updated", "latest", "draft",
            "v1", "v2", "final", "2023", "2024", "2025", "2026", "software", "engineer", "dev",
        ];
        for part in base.split(&['-', '_', ' ', '.'][..]) {
            let trimmed = part.trim();
            if trimmed.len() >= 2 && !noise.contains(&trimmed) && !trimmed.chars().any(|c| c.is_ascii_digit()) {
                filename_tokens.push(trimmed.to_string());
            }
        }
    }

    let section_headers = [
        "summary", "profile", "objective", "experience", "work experience",
        "professional experience", "employment", "education", "skills",
        "certifications", "projects", "contact", "curriculum vitae", "resume",
        "references", "portfolio",
    ];

    let mut best_name = "New Candidate".to_string();
    let mut highest_score = -100i32;

    for (i, line) in lines.iter().take(8).enumerate() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        // Immediate Disqualifiers for Name
        if trimmed.is_empty()
            || trimmed.contains('@')
            || trimmed.contains("http")
            || trimmed.contains("www.")
            || trimmed.contains("linkedin.com")
            || trimmed.contains("github.com")
            || trimmed.contains(".com")
            || trimmed.contains(".org")
            || trimmed.contains(".net")
            || trimmed.chars().any(|c| c.is_ascii_digit())
            || section_headers.iter().any(|h| lower == *h || lower.starts_with(&format!("{}:", h)))
            || lower.contains("curriculum vitae")
            || lower.contains("page ")
            || lower.starts_with("phone:")
            || lower.starts_with("email:")
            || lower.starts_with("address:")
            || lower.starts_with("location:")
        {
            continue;
        }

        // Handle compound header line: "Alex Rivera | Senior Frontend Architect"
        let candidate_part = if trimmed.contains('|') || trimmed.contains('–') || trimmed.contains('—') || trimmed.contains(" - ") {
            let parts: Vec<&str> = trimmed
                .split(&['|', '–', '—'][..])
                .flat_map(|p| p.split(" - "))
                .map(|p| p.trim())
                .filter(|p| !p.is_empty())
                .collect();
            parts.first().copied().unwrap_or(trimmed)
        } else {
            trimmed
        };

        let words: Vec<&str> = candidate_part.split_whitespace().collect();
        let word_count = words.len();

        // Names are typically 2 to 4 words
        if !(2..=4).contains(&word_count) {
            continue;
        }

        if candidate_part.len() < 3 || candidate_part.len() > 35 {
            continue;
        }

        let mut score = 0i32;

        // Signal A: Line position (names are usually at the very top)
        if i == 0 {
            score += 40;
        } else if i == 1 {
            score += 25;
        } else if i == 2 {
            score += 15;
        }

        // Signal B: Filename token match (huge boost if matching file name)
        if !filename_tokens.is_empty() {
            let cand_lower = candidate_part.to_lowercase();
            let mut matches = 0;
            for token in &filename_tokens {
                if cand_lower.contains(token) {
                    matches += 1;
                }
            }
            if matches >= 2 {
                score += 100;
            } else if matches == 1 {
                score += 50;
            }
        }

        // Signal C: Capitalization (Title Case or ALL CAPS)
        let is_title_cased = words.iter().all(|w| {
            let mut chars = w.chars();
            chars.next().map_or(false, |c| c.is_uppercase())
        });
        let is_all_caps = candidate_part.chars().all(|c| !c.is_alphabetic() || c.is_uppercase());

        if is_title_cased || is_all_caps {
            score += 25;
        }

        // Signal D: Avoid common role nouns as names
        let role_words = ["engineer", "developer", "designer", "architect", "manager", "lead", "specialist"];
        if role_words.iter().any(|r| lower.contains(r)) {
            score -= 50;
        }

        if score > highest_score {
            highest_score = score;
            best_name = candidate_part.to_string();
        }
    }

    best_name
}

/// Extracts current role / title using dual-zone strategy:
/// 1. Top headline directly under candidate name
/// 2. First job entry under EXPERIENCE / WORK HISTORY
fn extract_candidate_role(lines: &[&str], candidate_name: &str) -> Option<String> {
    let title_keywords = [
        "engineer", "developer", "architect", "manager", "lead", "designer",
        "recruiter", "sourcer", "specialist", "director", "consultant", "analyst",
        "administrator", "vp", "head of", "officer", "coordinator", "talent",
        "programmer", "scientist", "executive", "associate", "intern", "supervisor",
        "technician", "auditor", "strategist", "representative", "counsel", "accountant",
        "sme", "devops", "platform", "full stack", "frontend", "backend",
    ];

    let name_lower = candidate_name.to_lowercase();

    // Zone 1: Scan top 8 lines for headline (lines directly under Name)
    for line in lines.iter().take(8) {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        if lower == name_lower || trimmed.contains('@') || trimmed.contains("http") || trimmed.contains("linkedin.com") {
            continue;
        }

        // Check for explicit prefix: "Title: Senior DevOps Engineer"
        if let Some(cap) = RE_TITLE_PREFIX.captures(trimmed) {
            if let Some(t_match) = cap.get(2) {
                let val = t_match.as_str().trim();
                if !val.is_empty() && val.len() < 80 {
                    return Some(clean_role_title(val));
                }
            }
        }

        // Check if line contains a recognizable title keyword and is concise
        if title_keywords.iter().any(|k| lower.contains(k)) && trimmed.len() < 80 && !is_likely_location(trimmed) {
            return Some(clean_role_title(trimmed));
        }
    }

    // Zone 2: Experience Section Anchor Fallback
    // If no headline was in the header, find the first position under "EXPERIENCE"
    let exp_headers = ["experience", "work experience", "professional experience", "employment history", "work history"];
    let mut in_experience = false;
    let mut exp_lines_checked = 0;

    for line in lines {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        if !in_experience {
            if exp_headers.iter().any(|h| lower == *h || lower.starts_with(&format!("{}:", h))) {
                in_experience = true;
            }
            continue;
        }

        exp_lines_checked += 1;
        if exp_lines_checked > 6 {
            break; // Stop after first entry
        }

        if title_keywords.iter().any(|k| lower.contains(k)) && trimmed.len() < 80 {
            return Some(clean_role_title(trimmed));
        }
    }

    None
}

fn is_valid_phone(s: &str) -> bool {
    let mut digit_count = 0;
    let mut d = [0u8; 8];
    for b in s.bytes() {
        if b.is_ascii_digit() {
            if digit_count < 8 {
                d[digit_count] = b - b'0';
            }
            digit_count += 1;
        }
    }
    if !(7..=15).contains(&digit_count) {
        return false;
    }
    // Reject year spans e.g. "2019-2023"
    if digit_count == 8 {
        let y1 = (d[0] as i32) * 1000 + (d[1] as i32) * 100 + (d[2] as i32) * 10 + (d[3] as i32);
        let y2 = (d[4] as i32) * 1000 + (d[5] as i32) * 100 + (d[6] as i32) * 10 + (d[7] as i32);
        if (1970..=2050).contains(&y1) && (1970..=2050).contains(&y2) {
            return false;
        }
    }
    true
}

fn contains_skill_word(h_lower: &str, s_lower: &str) -> bool {
    let mut start = 0;
    while let Some(pos) = h_lower[start..].find(s_lower) {
        let idx = start + pos;
        let end_idx = idx + s_lower.len();

        let left_bound = if idx == 0 {
            true
        } else {
            let prev = h_lower[..idx].chars().next_back().unwrap();
            !prev.is_alphanumeric() && prev != '#' && prev != '+'
        };

        let right_bound = if end_idx >= h_lower.len() {
            true
        } else {
            let next = h_lower[end_idx..].chars().next().unwrap();
            !next.is_alphanumeric() && next != '#' && next != '+'
        };

        if left_bound && right_bound {
            return true;
        }

        start = idx + s_lower.len();
        if start >= h_lower.len() {
            break;
        }
    }
    false
}

fn clean_role_title(title: &str) -> String {
    let mut cleaned = title.to_string();
    // Strip company or dates if joined with separators: "Senior Software Engineer | Google" or "Lead Recruiter — Acme"
    for sep in &["|", "—", "–", " at ", " @ "] {
        if let Some(idx) = cleaned.find(sep) {
            cleaned = cleaned[..idx].trim().to_string();
        }
    }
    // Strip trailing dates e.g. "(2021 - Present)" or "2021 - 2024"
    if let Some(idx) = cleaned.find('(') {
        cleaned = cleaned[..idx].trim().to_string();
    }
    cleaned
}

fn is_likely_location(text: &str) -> bool {
    let lower = text.to_lowercase();
    if lower.contains("remote") || lower.contains("area") || lower.contains("city") || lower.contains("metro") {
        return true;
    }
    RE_US_STATE.is_match(text)
}

fn extract_location_from_text(lines: &[&str], full_text: &str) -> Option<String> {
    // A. Check for explicit location prefixes: "Location: Austin, TX"
    if let Some(cap) = RE_EXPLICIT_LOC.captures(full_text) {
        if let Some(loc) = cap.get(2) {
            let loc_str = loc.as_str().trim();
            if !loc_str.is_empty() && loc_str.len() < 60 {
                return Some(loc_str.to_string());
            }
        }
    }

    // B. Check top 8 lines (header section) by splitting contact lines:
    for line in lines.iter().take(8) {
        let tokens: Vec<&str> = line.split(&['|', '•', '·', ';'][..]).map(|t| t.trim()).collect();
        for token in tokens {
            if token.contains('@') || token.contains("http") || token.contains("linkedin.com") {
                continue;
            }

            if let Some(cap) = RE_US_CITY_STATE.captures(token) {
                if let Some(m) = cap.get(0) {
                    return Some(m.as_str().trim().to_string());
                }
            }

            if let Some(cap) = RE_FULL_STATE.captures(token) {
                if let Some(m) = cap.get(0) {
                    return Some(m.as_str().trim().to_string());
                }
            }

            let lower = token.to_lowercase();
            if (lower.contains("remote") || lower.contains("area") || lower.contains("greater ")) && token.len() < 50 && token.len() > 3 {
                return Some(token.to_string());
            }
        }
    }

    // C. Fallback scan across full text for standard "City, State"
    if let Some(cap) = RE_US_CITY_STATE.captures(full_text) {
        if let Some(m) = cap.get(0) {
            let s = m.as_str().trim();
            if s.len() < 50 {
                return Some(s.to_string());
            }
        }
    }

    None
}

fn sanitize_and_verify_profile(
    mut profile: ExtractedCandidateProfile,
    source_text: &str,
) -> ExtractedCandidateProfile {
    let lower_source = source_text.to_lowercase();

    // Verify email exists in source text
    if let Some(ref em) = profile.email {
        if !lower_source.contains(&em.to_lowercase()) {
            profile.email = None;
        }
    }

    // Clean empty strings to None
    if let Some(ref loc) = profile.location {
        if loc.trim().is_empty() || loc.to_lowercase() == "n/a" || loc.to_lowercase() == "none" {
            profile.location = None;
        }
    }

    if let Some(ref li) = profile.linkedin_url {
        if li.trim().is_empty() || li.to_lowercase() == "n/a" || li.to_lowercase() == "none" {
            profile.linkedin_url = None;
        }
    }

    if let Some(ref role) = profile.current_role {
        if role.trim().is_empty() || role.to_lowercase() == "n/a" {
            profile.current_role = None;
        }
    }

    // Deduplicate skills
    let mut unique_skills = Vec::new();
    for s in profile.skills {
        let trimmed = s.trim().to_string();
        if !trimmed.is_empty() && !unique_skills.iter().any(|u: &String| u.eq_ignore_ascii_case(&trimmed)) {
            unique_skills.push(trimmed);
        }
    }
    profile.skills = unique_skills;

    profile
}
