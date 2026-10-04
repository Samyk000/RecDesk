# Brainstorm 1: Eliminating the "Internal vs. External" Submission Split & Adding Pipeline

> **Date**: 2026-10-04  
> **Status**: Ready for Review / Alignment  
> **Focus**: 
> 1. Simplifying the submission pipeline to mirror real-world agency recruitment (1 Submission = 1 Client Submission).
> 2. Adding the **"Pipeline / Talent Bench"** status for high-value candidates whose rate, location, or timing didn't fit a specific role.
> 3. Eliminating phantom internal states, cleaning SQL queries, and preventing broken dashboard counters.

---

## 1. Executive Summary & Domain Truth

In recruitment agency operations, **"Submission" has one universal definition: presenting a vetted candidate to the Client / Hiring Manager (external).**

Internal vetting, pre-screens, and lead qualification belong exclusively to the **Screen / Shortlist** stage. 

The previous implementation introduced an artificial split:
- It stored `"internal"` vs `"client"` inside the `client_feedback` database column.
- It defaulted newly submitted candidates to `"internal"`.
- It excluded `"internal"` candidates from Dashboard counters, Sidebar badges, and Calendar submissions.
- Consequently, candidates marked as "Submitted" silently vanished from activity metrics unless a recruiter opened the detail panel and manually clicked an "External" toggle.

Furthermore, when a recruiter speaks with a great candidate whose rate, location, or timing doesn't work for *this specific role*, the previous system forced the recruiter to choose between `not_interested` or `rejected`. 
- `rejected` makes the candidate look like a failure and hides them under the "Hide Rejected" toggle.
- `not_interested` sounds like a dead lead.

**Goal**: 
1. Eliminate the "Internal Submission" concept entirely. Every submission is a real client submission.
2. Introduce **`pipeline`** (Display: **`Pipeline`** or **`Pipelined`**) as a first-class status for active talent pool assets ready to be matched to future requisitions.

---

## 2. Core Architectural Changes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE LIFECYCLE                             │
│                                                                        │
│   [Lead / Sourced]                                                     │
│          │                                                             │
│          ▼                                                             │
│   [Screened / Vetted] ──► Call with candidate                          │
│          │                                                             │
│          ├───────────────────────┬────────────────────────┐            │
│          ▼                       ▼                        ▼            │
│   [Fits this role]      [GREAT CANDIDATE,        [Not qualified]       │
│          │               Mismatched for role]             │            │
│          │                       │                        ▼            │
│          ▼                       ▼                   [Rejected]        │
│   [SUBMITTED]             [PIPELINED] ◄─── (Saved to Talent Pool)      │
│   (Client Review)                │                                     │
│          │                       │ (2 weeks later: new job opens)      │
│          ▼                       ▼                                     │
│   [Interviewing]          [Assign / Copy to New Job]                   │
│          │                       │                                     │
│          ▼                       ▼                                     │
│   [Placed / Offer]        [SUBMITTED to Client]                        │
└────────────────────────────────────────────────────────────────────────┘
```

### A. Frontend Component Cleanup
1. **`CandidateDetailPanel.tsx`**:
   - **Remove**: The `Internal` vs `External` pill button toggle (`SubmissionSubStageSection`, lines ~1097–1161).
   - **Retain**: `SubmittedDatePicker` for explicit date/time tracking (`submitted_at`).
   - **Retain**: Direct Client Rejection button (`Mark as Client Rejected`) and Client Feedback field.
2. **`StatusChangeDialog.tsx`**:
   - **Remove**: Hardcoded defaulting `patch.client_feedback = candidate.client_feedback || "internal"`.
   - **Behavior**: Selecting "Submitted" updates `submission_status = "submitted"` and timestamps `submitted_at = now()`. No background manipulation of `client_feedback`.
3. **`CandidateForm.tsx`**:
   - **Remove**: `client_feedback: status === "submitted" ? "internal" : ...`.
   - **Behavior**: Leaves `client_feedback` as `null` until actual feedback from the client is received.
4. **`candidateUtils.ts`**:
   - **Remove**: `Int` vs `Ext` micro-badges in `getCandidateSubStageBadge`. When a candidate is submitted, the status badge simply reads **Submitted** (amber).
   - **Update**: `isExternalSubmission()` simplified: if `submission_status === 'submitted'`, it returns `true`.
5. **Adding `pipeline` to `SUBMISSION_STATUSES`**:
   - Key: `"pipeline"` | Label: `"Pipelined"` | Theme: Violet / Purple (`text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20`).
   - Filter pill added to `Candidates.tsx` alongside other stages.
   - Preserved permanently when "Hide Rejected" is active.

### B. Backend SQL & Command Cleanup
1. **`dashboard.rs`**:
   - **Current SQL**:
     ```sql
     WHERE (submission_status = 'submitted' AND (client_feedback IS NULL OR client_feedback != 'internal'))
        OR (submitted_at IS NOT NULL AND TRIM(submitted_at) != '' AND (client_feedback IS NULL OR client_feedback != 'internal') AND (rejection_reason IS NULL OR rejection_reason NOT LIKE '%"internal"%'))
     ```
   - **New Clean SQL**:
     ```sql
     WHERE submission_status = 'submitted'
        OR (submitted_at IS NOT NULL AND TRIM(submitted_at) != '' AND submission_status NOT IN ('lead', 'screen', 'pipeline'))
     ```
   - *Result*: Fast, clean index scans; zero reliance on fragile string matching.
2. **`candidate.rs`**:
   - Clean up identical filter clauses in `get_candidates_with_job` and search queries.

### C. Repurposing `client_feedback`
`client_feedback` will now store its natural, intended value: **actual client comments and feedback**:
- Examples: *"Hiring manager requested GitHub repo"*, *"Strong technical background, scheduling Round 1"*, *"Passed on candidate — lacks distributed systems experience"*.
- It will no longer be hijacked as a binary discriminator flag.

---

## 3. Edge Cases & Safety Precautions

| # | Edge Case / Risk | Failure Mode | Prevention & Mitigation |
|---|------------------|--------------|-------------------------|
| 1 | **Legacy Database Records** | Existing records in `workspace.db` contain literal strings `"internal"` or `"client"` in `client_feedback`. | Run a safe, non-destructive migration on app startup:<br>`UPDATE candidates SET client_feedback = NULL WHERE client_feedback IN ('internal', 'client');`<br>Prevents dummy strings from appearing as actual feedback text. |
| 2 | **Status Restoration / Undo** | Recruiter accidentally marks candidate as "Submitted", then restores previous status back to "Screen". | `submitted_at` remains recorded in status history, but active status is `screen`. Metrics queries only count candidates whose active status or milestone qualifies, avoiding phantom counts. |
| 3 | **Rejection Classification** | Candidate was rejected during internal screening vs rejected after client submission. | Rejections during screen have `submission_status = 'rejected'` and `submitted_at IS NULL`. Rejections by client have `submitted_at IS NOT NULL` or `rejection_reason` originating from client screening/interview. No confusing "internal submission rejection" state needed. |
| 4 | **Pipeline Metrics Protection** | Candidates in `pipeline` must not falsely inflate external client submissions or active interview metrics on Dashboard. | SQL queries strictly count `submission_status IN ('submitted', 'interview', 'placed')`. Pipeline candidates are tracked in the talent bench, not as client-facing submissions. |
| 5 | **Excel Import & Export** | Importing spreadsheets where historical columns contain "Internal" / "Client". | Update `excelImport.ts`: If incoming row has `submission_status === "submitted"`, map directly to submitted. Sanitize `client_feedback` so incoming values like "internal" don't pollute feedback notes. |
| 6 | **Re-engaging Pipelined Candidates** | Recruiter gets a new job 3 weeks later and wants to submit a pipelined candidate. | 1-click "Assign / Copy to Job" using existing `ChangeJobDialog.tsx`, seamlessly porting their resume, skills, and target rate to the new requisition. |

---

## 4. Expected Impact
- **Fewer Clicks**: No extra toggle step needed when submitting candidates.
- **100% Metric Accuracy**: Dashboard, Sidebar counter, and Calendar will perfectly agree with the actual count of submitted candidates.
- **Zero Lost Talent**: High-value candidates with rate/location mismatches are saved in your active Pipeline instead of being buried in Rejected.
- **Zero Risk to Candidate Data**: No fields are deleted from SQLite; data integrity is completely preserved.
