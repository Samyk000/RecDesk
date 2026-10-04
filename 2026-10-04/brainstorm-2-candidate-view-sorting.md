# Brainstorm 2: Recruiter-Centric Candidate Sorting & Technical Signals

> **Date**: 2026-10-04  
> **Status**: Ready for Review / Alignment  
> **Focus**: Replacing generic administrative sorting (like alphabetical names) with high-signal recruitment metrics: Job Titles, Candidate Roles, Core Technologies/Skills, Years of Experience (YoE), and Match Scores.

---

## 1. Executive Summary & Domain Truth

In technical and agency recruitment, **a candidate's name is the lowest-signal data point for triage and pipeline management**. 

Recruiters evaluate talent against job requisitions based on:
1. **Target Role / Title**: (*e.g., Staff Infrastructure Engineer vs Fullstack Developer*)
2. **Years of Experience (YoE)**: (*e.g., Hiring manager has a hard requirement for 8+ years*)
3. **Core Tech Stack / Key Technologies**: (*e.g., Go, Kubernetes, AWS, Terraform*)
4. **Requisition Fit / Match Score**: (*e.g., 90% fit vs 60% fit*)
5. **Freshness / Last Activity**: (*e.g., who was updated or submitted today*)

Sorting candidates alphabetically (A–Z by name) provides zero operational value to a recruiter. The table and sorting architecture must directly serve recruiter triage speed.

---

## 2. Proposed Table & Sorting Architecture

### A. New Sorting Keys in `Candidates.tsx`

Currently, `SortKey` is limited to:
`"job_title" | "client_name" | "location" | "date_added" | "last_updated"`

We propose expanding `SortKey` to high-signal recruiter fields:

```typescript
export type RecruiterSortKey =
  | "candidate_title"   // Candidate's current professional title (A-Z / Z-A)
  | "experience_years"  // Numeric seniority (High -> Low, Low -> High)
  | "match_score"       // Fit percentage (100% -> 0%)
  | "job_title"         // Requisition applied to
  | "client_name"       // Client account
  | "last_updated"      // Recency / Freshness (Default)
  | "date_added";       // Sourcing date
```

#### Comparison Logic Specifications:
```typescript
const COMPARE: (a: CandidateWithJob, b: CandidateWithJob, key: RecruiterSortKey) => number = (a, b, key) => {
  if (key === "candidate_title") {
    const tA = (a.current_title ?? "").trim();
    const tB = (b.current_title ?? "").trim();
    if (!tA && !tB) return 0;
    if (!tA) return 1; // Empty titles sink to bottom
    if (!tB) return -1;
    return tA.localeCompare(tB);
  }
  if (key === "experience_years") {
    const expA = a.experience_years ?? -1;
    const expB = b.experience_years ?? -1;
    return expA - expB; // Natural numeric comparison
  }
  if (key === "match_score") {
    const scoreA = a.match_score ?? -1;
    const scoreB = b.match_score ?? -1;
    return scoreA - scoreB;
  }
  if (key === "job_title") return a.job_title.localeCompare(b.job_title);
  if (key === "client_name") return a.client_name.localeCompare(b.client_name);
  if (key === "date_added") return a.date_added.localeCompare(b.date_added);
  return a.last_updated.localeCompare(b.last_updated);
};
```

---

### B. Table Layout & Column Redesign

#### Current Table Columns:
`[Checkbox] | [Name + Title Subtitle] | [Job] | [Client] | [Status] | [Location] | [Added] | [Updated] | [Actions]`

#### Proposed Recruiter-First Columns:
```
┌──────┬──────────────────────┬─────────────┬──────────────────────────┬──────────────┬─────────────┬───────────┐
│ [ ]  │ CANDIDATE & ROLE     │ EXPERIENCE  │ CORE TECH / SKILLS       │ JOB & CLIENT │ STATUS      │ UPDATED   │
├──────┼──────────────────────┼─────────────┼──────────────────────────┼──────────────┼─────────────┼───────────┤
│ [ ]  │ Alex Rivera          │   8 yrs     │ [Go] [Kubernetes] [AWS]  │ Senior SRE   │ Submitted   │ 2h ago    │
│      │ Lead Cloud Architect │             │                          │ CloudCorp    │             │           │
├──────┼──────────────────────┼─────────────┼──────────────────────────┼──────────────┼─────────────┼───────────┤
│ [ ]  │ Elena Rostova        │   11 yrs    │ [Rust] [Distributed Sys] │ Systems Dev  │ Round 2     │ Yesterday │
│      │ Principal Engineer   │             │                          │ FinTech Labs │             │           │
└──────┴──────────────────────┴─────────────┴──────────────────────────┴──────────────┴─────────────┴───────────┘
```

1. **Candidate & Role**:
   - Primary: Candidate Name (bold, clickable to open panel).
   - Secondary: `current_title` with dedicated sort header button ("Sort by Role").
2. **Experience (YoE)**:
   - Dedicated compact column with sort toggle (`SortIcon`).
   - Clean badge (e.g., `8 yrs` or `12 yrs`). Highlights seniority at a glance.
3. **Core Tech / Skills**:
   - Displays 2–3 key technology pills extracted from candidate profile/resume (e.g., `React`, `TypeScript`, `Node.js`).
   - If more exist, displays a subtle `+2` badge that expands on hover.
4. **Job & Client**:
   - Displays target job title and client name cleanly stacked.
5. **Status**:
   - Clean dropdown with sub-stage indicator (e.g., `Submitted`, `Round 1`, `Round 2`, `Placed`).
6. **Updated**:
   - Relative timestamp (`"2h ago"`, `"Yesterday"`) for instant activity tracking.

---

## 3. Edge Cases & Technical Considerations

| # | Edge Case / Scenario | Risk | Solution & Design Choice |
|---|----------------------|------|--------------------------|
| 1 | **Missing / Null Experience Years** | Newly added or scraped candidate has `experience_years == null`. When sorting descending (highest YoE first), nulls could float to the top. | Sentinel value `-1`: Null/undefined experience values always sort to the very bottom, whether sorting ascending or descending, so the recruiter always sees known data first. |
| 2 | **Empty Candidate Title** | Candidate created with only a name and no title yet. | Render subtle em-dash `—` or `"Unspecified Title"`. When sorting by title, null/empty strings sink to the bottom. |
| 3 | **Candidates with Dozens of Skills** | Profile has 25 skills; table row could blow out or cause horizontal overflow. | Render max 3 primary tech badges with `overflow-hidden` and `text-[10.5px]`. Append `+N` badge with tooltip showing remaining skills. |
| 4 | **Window Resizing / Small Screens** | On narrower laptop displays (e.g. 1280px width), adding columns could cause horizontal scrolling. | Responsive CSS classes (`hidden xl:table-cell`): Location and Client details gracefully collapse, preserving Candidate, Role, Experience, and Status as permanent visible anchors. |
| 5 | **Sorting Performance on Large Lists** | Re-sorting 500+ candidates in client memory on every toggle. | Pre-compile sanitized sort keys (`useMemo`) or index on candidate load. Client-side array sort for 500 items takes $<1\text{ms}$ in modern V8. |

---

## 4. Expected Impact
- **Instant Candidate Screening**: A recruiter can immediately sort by **Experience** to find all 8+ year candidates, or sort by **Role** to group all Cloud Architects together.
- **Immediate Tech Signal**: Tech stack is visible directly in the table row without opening the side panel for every single candidate.
- **Zero Useless Fluff**: Completely removes administrative sorting patterns that don't match recruiting reality.
