# RecDesk Architectural Brainstorms — 2026-10-04

This folder contains focused, point-to-point architectural brainstorms tailored to real-world agency recruitment workflows, complete with edge cases, failure mode analysis, and technical implementation specs.

---

### Documents Index

1. **[Brainstorm 1: Eliminating the "Internal vs. External" Submission Split & Adding Pipeline](file:///c:/Users/Samee/Desktop/Projects/RecDesk/2026-10-04/brainstorm-1-submissions.md)**
   - Eliminates the artificial "Internal Submission" split (1 Submission = 1 Client Submission).
   - Introduces **"Pipeline / Talent Bench"** status for high-value candidates whose rate, location, or timing didn't fit a specific role.
   - Frees up `client_feedback` for actual client comments/notes.
   - Cleans backend SQL queries in `dashboard.rs` and `candidate.rs`.
   - Prevents dashboard counter discrepancies and simplifies UI to zero redundant toggles.

2. **[Brainstorm 2: Recruiter-Centric Candidate Sorting & Technical Signals](file:///c:/Users/Samee/Desktop/Projects/RecDesk/2026-10-04/brainstorm-2-candidate-view-sorting.md)**
   - Replaces useless alphabetical candidate name sorting with high-signal recruiting dimensions.
   - New sorting keys: Candidate Current Role/Title, Years of Experience (YoE), and Match Score.
   - Surfaces core technology stack pills (e.g. `[Go] [K8s] [AWS]`) directly in candidate table rows.
   - Outlines edge cases for null experience, responsive screen widths, and fast client-side sorting.

3. **[Brainstorm 3: "Auto-Fill Profile from Resume" in Candidate Detail Panel](file:///c:/Users/Samee/Desktop/Projects/RecDesk/2026-10-04/brainstorm-3-resume-autofill-extraction.md)**
   - Brings the local Rust resume extraction engine into `CandidateDetailPanel.tsx` for existing candidates.
   - 1-click trigger (`⚡ Auto-Fill from Resume`) on the candidate's attached resume card.
   - Smart Field Merge Modal comparing current vs extracted data with "Fill Empty Fields Only" safety default.
   - Comprehensive edge-case handling for flat scanned image PDFs, file moves, and PII protection.

4. **[Brainstorm 4: High-Accuracy Skills Engine & Candidate Detail Panel Redesign](file:///c:/Users/Samee/Desktop/Projects/RecDesk/2026-10-04/brainstorm-4-skills-and-panel-redesign.md)**
   - Upgrades local Rust skill extraction to 99% accuracy via a 500+ curated tech taxonomy and section-aware parsing (no slow AI models or API fees).
   - Replaces the 160px bottom notes box in `CandidateDetailPanel` with interactive "Skills & Tools" badges (`+ Add`, `✕ Remove`).
   - Moves Recruiter Notes to a dedicated header icon + centered modal (`RecruiterNotesDialog`) with active note indicator dot.
   - Removes redundant "Added On" date from panel header for clean, uncluttered space.
