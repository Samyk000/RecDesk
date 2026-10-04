# Brainstorm 4: High-Accuracy Skills Engine & Candidate Detail Panel Redesign

> **Date**: 2026-10-04  
> **Status**: Ready for Review / Alignment  
> **Focus**: 
> 1. Maximizing local Rust skills extraction accuracy (500+ curated taxonomy + section-aware parsing) without heavy AI models.
> 2. Redesigning `CandidateDetailPanel` to replace the bottom notes box with interactive "Skills & Tools" badges.
> 3. Moving Recruiter Notes to a focused modal triggered from the panel header.
> 4. Removing the redundant "Added On" date from the panel header for clean, uncluttered space.

---

## 1. Skill Detection Accuracy: Rust vs. AI Model

### The Current Flaw in Rust Extraction
In [`src-tauri/src/commands/ai.rs`](file:///c:/Users/Samee/Desktop/Projects/RecDesk/src-tauri/src/commands/ai.rs#L124-L130), the `common_skills` array is limited to **45 hardcoded terms**. 
Modern tech stacks contain hundreds of industry standards (`FastAPI`, `Snowflake`, `Kubernetes`, `Kafka`, `Spring Boot`, `Terraform`, `Next.js`, `Tailwind`, `PyTorch`, `Datadog`, etc.) that are completely ignored simply because they are missing from the list.

### Why Rust (Not an AI Model) is the Superior Solution
| Dimension | Heavy AI Model (LLM / Python) | Optimized Rust Engine |
| :--- | :--- | :--- |
| **Speed** | 3,000ms – 8,000ms per resume | **1ms – 3ms** (instantaneous) |
| **Cost & Internet** | Requires paid API keys (OpenAI) or internet | **100% Offline & Free** |
| **Machine Impact** | Burns battery & requires 4GB+ RAM (Ollama) | Zero CPU impact, lightweight binary |
| **Hallucination** | Can invent skills candidate doesn't have | **Deterministic**: Only detects actual resume text |

### The 3-Step Rust Accuracy Upgrade:
1. **500+ Industry Skill Taxonomy**:
   - Curate comprehensive categories:
     - **Languages**: Python, Java, TypeScript, JavaScript, Go, Rust, C++, C#, Ruby, PHP, Swift, Kotlin, SQL, Scala, Bash...
     - **Frontend**: React, Next.js, Vue, Angular, Svelte, Tailwind CSS, HTML5, CSS3, Redux, Webpack, Vite...
     - **Backend / Frameworks**: Node.js, Express, Django, FastAPI, Flask, Spring Boot, ASP.NET, Rails, GraphQL, REST...
     - **Cloud & DevOps**: AWS, Azure, GCP, Docker, Kubernetes, Terraform, Helm, Ansible, CI/CD, Linux, Datadog...
     - **Data & AI**: PostgreSQL, MySQL, MongoDB, Redis, Kafka, Snowflake, Spark, Airflow, PyTorch, Pandas, Scikit-learn...
2. **Section-Aware Extraction**:
   - Scan for resume section anchors: `"TECHNICAL SKILLS"`, `"CORE COMPETENCIES"`, `"SKILLS & TOOLS"`, `"TECHNOLOGIES"`.
   - Tokenize comma-separated and bulleted values in that section.
3. **Whole-Word Boundary Matching**:
   - Leverage `contains_skill_word`: guarantees `"Go"` does not match `"Google"`, `"C"` does not match `"CSS"`, and `"Java"` does not match `"JavaScript"`.

---

## 2. Candidate Detail Panel Redesign

### Current State vs. Proposed Layout

```
CURRENT:
┌──────────────────────────────────────────────────────┐
│ [Initials] ADDED ON OCT 04, 2026   [🪪 Info] [💼 Job]│  ◄── Header cluttered with date
├──────────────────────────────────────────────────────┤
│ Name, Title, Email, Phone, Rate, Resume, Status...   │
│                                                      │
│ ───────────────────────────────────────────────────  │
│ [Rich Text Editor: Notes about this candidate...]    │  ◄── 160px box used infrequently
└──────────────────────────────────────────────────────┘

PROPOSED:
┌──────────────────────────────────────────────────────┐
│ [Initials] Alex Rivera             [📝] [🪪] [💼] [✕]│  ◄── Clean header; 📝 opens Notes Modal
│            Senior Cloud Architect                    │      (dot on 📝 if notes exist)
├──────────────────────────────────────────────────────┤
│ Name, Title, Email, Phone, Rate, Resume, Status...   │
│                                                      │
│ ───────────────────────────────────────────────────  │
│ 🛠️ SKILLS & TECHNOLOGIES (8)          [+ Add Skill]  │  ◄── High-signal interactive badges
│ [React ✕] [TypeScript ✕] [AWS ✕] [Kubernetes ✕]      │
│ [Docker ✕] [Go ✕] [Terraform ✕] [PostgreSQL ✕]       │
└──────────────────────────────────────────────────────┘
```

### A. Header Clean-Up
- **Remove**: `<CalendarDots /> ADDED ON OCT 04, 2026` from `CandidateDetailPanel.tsx` (lines 423–427).
- *Reason*: Date added is already displayed in the main table on `Candidates.tsx`. Removing it cleans the header and creates space for quick action buttons.

### B. Recruiter Notes Modal (`RecruiterNotesDialog.tsx`)
- Place a **Notes Icon** (`Notebook` / `NotePencil`) in the top-right header action group.
- **Visual Cue**: If `candidate.recruiter_notes` contains text, render an indicator dot on the icon so the recruiter knows notes exist.
- Clicking the icon opens a center modal:
  - Clean, focused `RichTextEditor`.
  - Auto-saves on blur or close.
  - Keeps the side panel uncluttered while giving ample space to read or write detailed candidate notes.

### C. "Skills & Tools" Badges Card
- Positioned in the bottom section of `CandidateDetailPanel`:
  - **Count & Header**: `Skills & Technologies (N)` + `+ Add` button.
  - **Interactive Badges**:
    - Subtle rounded tags with accent background (`bg-primary/10 text-primary border-primary/20`).
    - Hovering reveals a small `✕` to remove the skill.
    - Inline input: Type skill name, press `Enter` to add.
  - **Storage**: Persisted in `submission_details.skills` (JSON string array). No SQL migration required.

---

## 3. Edge Cases & Technical Guardrails

| # | Edge Case | Risk | Mitigation |
|---|-----------|------|------------|
| 1 | **Database Schema Compatibility** | SQLite `candidates` table does not have a `skills` column. | Store skills inside `submission_details` JSON (`{ skills: ["React", "Go", ...] }`). Zero database migrations; 100% backwards-compatible. |
| 2 | **Large Skill Lists (25+ tags)** | Skills card could expand endlessly and cause vertical overflow. | `flex-wrap gap-1.5 max-h-[140px] overflow-y-auto scrollbar-thin`. |
| 3 | **Note Loss on Modal Dismiss** | Recruiter types a note and clicks outside the modal without saving. | Modal triggers auto-save immediately on change/blur and flushes pending edits on `onOpenChange(false)`. |
| 4 | **Casing Duplicates** | User types `"React"` when `"react"` is already present. | Deduplicate case-insensitively before saving (`unique_skills`). |

---

## 4. Expected Impact
- **Immediate Visual Technical Fit**: Recruiter opens candidate panel and instantly sees their exact tech stack badges.
- **Cleaner, Taller Panel**: Removing the permanent 160px rich editor gives more breathing room to the candidate's core pipeline details.
- **Instant Local Extraction**: Auto-filling from resume populates accurate skills without waiting on cloud AI APIs.
