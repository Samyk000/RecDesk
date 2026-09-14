use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedCandidateProfile {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub current_role: Option<String>,
    pub experience_years: Option<f64>,
    pub skills: Vec<String>,
    pub location: Option<String>,
    pub linkedin_url: Option<String>,
    pub notes_summary: Option<String>,
}

#[tauri::command]
pub async fn parse_resume_text(
    _app: AppHandle,
    text: String,
) -> Result<ExtractedCandidateProfile, String> {
    if text.trim().is_empty() {
        return Err("Pasted resume text is empty".into());
    }

    let profile = extract_profile_from_text(&text);
    Ok(sanitize_and_verify_profile(profile, &text))
}

pub fn extract_profile_from_text(raw: &str) -> ExtractedCandidateProfile {
    let clean_text = raw.replace("\r\n", "\n");
    let lines: Vec<&str> = clean_text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    // 1. Email extraction (RFC 5322 regex)
    let email_regex = Regex::new(r"(?i)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
    let email = email_regex
        .find(&clean_text)
        .map(|m| m.as_str().to_string());

    // 2. Phone extraction
    let phone_regex =
        Regex::new(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}").unwrap();
    let phone = phone_regex
        .find(&clean_text)
        .map(|m| m.as_str().to_string());

    // 3. LinkedIn URL extraction
    let linkedin_regex =
        Regex::new(r"(?i)(https?://)?([a-z]{2,3}\.)?linkedin\.com/in/[a-zA-Z0-9-_%]+/?").unwrap();
    let linkedin_url = linkedin_regex.find(&clean_text).map(|m| {
        let mut url_str = m.as_str().to_string();
        if !url_str.starts_with("http") {
            url_str = format!("https://{}", url_str);
        }
        url_str
    });

    // 4. Candidate Name & Current Role / Title Extraction
    let title_keywords = [
        "engineer", "developer", "architect", "manager", "lead", "designer",
        "recruiter", "sourcer", "specialist", "director", "consultant", "analyst",
        "administrator", "vp", "head of", "officer", "coordinator", "talent",
        "programmer", "scientist", "executive", "associate", "intern", "supervisor",
        "technician", "auditor", "strategist", "representative", "counsel", "accountant",
    ];

    let section_headers = [
        "summary", "profile", "objective", "experience", "work experience",
        "professional experience", "employment", "education", "skills",
        "certifications", "projects", "contact",
    ];

    let mut name = "New Candidate".to_string();
    let mut current_role = None;

    let title_prefix_regex = Regex::new(r"(?i)^(title|role|position|current position|current role|headline):\s*(.+)").unwrap();

    // Scan lines for name and title
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        // Check if line is a section header (e.g. "SUMMARY", "EXPERIENCE")
        let is_header = section_headers.iter().any(|h| lower == *h || lower.starts_with(&format!("{}:", h)));
        if is_header && i > 0 {
            continue;
        }

        // Check for candidate name (typically Line 1 or first clean alphabetical line)
        let is_name_candidate = trimmed.len() >= 2
            && trimmed.len() < 40
            && !trimmed.contains('@')
            && !trimmed.contains("http")
            && !trimmed.contains("www.")
            && !lower.contains("resume")
            && !lower.contains("curriculum")
            && !lower.contains("page ")
            && !lower.contains("phone:")
            && !lower.contains("email:")
            && !lower.contains("location:")
            && !trimmed.chars().all(|c| c.is_numeric() || c.is_whitespace() || c == '-' || c == '(' || c == ')');

        if is_name_candidate && name == "New Candidate" {
            let is_role_word = title_keywords.iter().any(|k| lower.contains(k));
            if !is_role_word {
                name = trimmed.to_string();
                continue;
            }
        }

        // Check for candidate professional title / role
        if current_role.is_none() && i < 15 {
            // Check for explicit title prefix: "Title: Senior Software Engineer"
            if let Some(cap) = title_prefix_regex.captures(trimmed) {
                if let Some(t_match) = cap.get(2) {
                    let extracted_t = t_match.as_str().trim();
                    if !extracted_t.is_empty() && extracted_t.len() < 80 {
                        current_role = Some(clean_role_title(extracted_t));
                        continue;
                    }
                }
            }

            // In resumes, Line 2 (directly after Name) is almost always the candidate's Headline / Title
            if i == 1 && name != "New Candidate" && is_name_candidate && !lower.contains("phone") && !lower.contains("email") {
                // If it's not a location string and < 70 chars, it's the title!
                if !is_likely_location(trimmed) && trimmed.len() < 70 {
                    current_role = Some(clean_role_title(trimmed));
                    continue;
                }
            }

            // Check if line contains a recognizable title keyword
            if title_keywords.iter().any(|k| lower.contains(k)) && trimmed.len() < 80 && !trimmed.contains('@') && !trimmed.contains("http") {
                current_role = Some(clean_role_title(trimmed));
            }
        }
    }

    // 5. Experience years extraction
    let exp_regex = Regex::new(r"(?i)(\d+(\.\d+)?)\+?\s*(years|yrs|year)\b").unwrap();
    let mut experience_years = None;
    if let Some(cap) = exp_regex.captures(&clean_text) {
        if let Some(num_match) = cap.get(1) {
            if let Ok(num) = num_match.as_str().parse::<f64>() {
                if (0.5..=50.0).contains(&num) {
                    experience_years = Some(num);
                }
            }
        }
    }

    // 6. Comprehensive Location Extraction
    let location = extract_location_from_text(&lines, &clean_text);

    // 7. Skills extraction
    let common_skills = [
        "React", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "C++", "C#", "Rust", "Go", "Golang",
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "SQL", "PostgreSQL", "MongoDB", "Redis", "GraphQL",
        "HTML", "CSS", "Tailwind", "Next.js", "Vue", "Angular", "Git", "CI/CD", "Linux", "Terraform",
        "Machine Learning", "Figma", "UI/UX", "Agile", "Scrum", "Tauri", "Svelte", "Ruby", "PHP",
        "Technical Recruiting", "Sourcing", "Executive Search", "Talent Acquisition", "Screening",
    ];

    let mut detected_skills = Vec::new();
    let lower_all = clean_text.to_lowercase();
    for skill in &common_skills {
        let skill_lower = skill.to_lowercase();
        if lower_all.contains(&skill_lower) {
            detected_skills.push(skill.to_string());
        }
    }

    ExtractedCandidateProfile {
        name,
        email,
        phone,
        current_role,
        experience_years,
        skills: detected_skills,
        location,
        linkedin_url,
        notes_summary: None,
    }
}

fn clean_role_title(title: &str) -> String {
    let mut cleaned = title.to_string();
    // Strip company or dates if joined with separators: "Senior Software Engineer | Google" or "Lead Recruiter — Acme"
    for sep in &["|", "—", "–", " at ", " @ "] {
        if let Some(idx) = cleaned.find(sep) {
            cleaned = cleaned[..idx].trim().to_string();
        }
    }
    cleaned
}

fn is_likely_location(text: &str) -> bool {
    let lower = text.to_lowercase();
    if lower.contains("remote") || lower.contains("area") || lower.contains("city") || lower.contains("metro") {
        return true;
    }
    // Check "City, ST"
    let us_state_regex = Regex::new(r"(?i)\b[A-Za-z\s.-]+,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|ON|BC|QC|AB)\b").unwrap();
    us_state_regex.is_match(text)
}

fn extract_location_from_text(lines: &[&str], full_text: &str) -> Option<String> {
    // A. Check for explicit location prefixes: "Location: Austin, TX"
    let explicit_loc_regex = Regex::new(
        r"(?i)\b(location|address|based in|residing in|city):\s*([^\n\r,|]+(?:,\s*[^\n\r,|]+)?)",
    )
    .unwrap();

    if let Some(cap) = explicit_loc_regex.captures(full_text) {
        if let Some(loc) = cap.get(2) {
            let loc_str = loc.as_str().trim();
            if !loc_str.is_empty() && loc_str.len() < 60 {
                return Some(loc_str.to_string());
            }
        }
    }

    // B. Check top 8 lines (header section) by splitting contact lines:
    // e.g. "alex@gmail.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/alex"
    let us_city_state_regex = Regex::new(
        r"(?i)\b([A-Z][a-zA-Z\s.-]+),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|ON|BC|QC|AB)\b(?:\s*\d{5})?",
    )
    .unwrap();

    let full_state_regex = Regex::new(
        r"(?i)\b([A-Z][a-zA-Z\s.-]+),\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|United States|USA|Canada|UK|United Kingdom|India|Germany|Australia|France)\b",
    )
    .unwrap();

    for line in lines.iter().take(8) {
        // Check for full line or piped tokens
        let tokens: Vec<&str> = line.split(&['|', '•', '·', ';'][..]).map(|t| t.trim()).collect();
        for token in tokens {
            if token.contains('@') || token.contains("http") || token.contains("linkedin.com") {
                continue;
            }

            if let Some(cap) = us_city_state_regex.captures(token) {
                if let Some(m) = cap.get(0) {
                    return Some(m.as_str().trim().to_string());
                }
            }

            if let Some(cap) = full_state_regex.captures(token) {
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
    if let Some(cap) = us_city_state_regex.captures(full_text) {
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
