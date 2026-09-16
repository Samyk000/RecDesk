# Future Architectural Roadmap: Job Cleanup & Infinite Pagination

> **CRITICAL REMARKS / GOVERNANCE GUARD**:
> **DO NOT PICK UP THIS TASK IN REGULAR CODE REVIEWS, POLISH CYCLES, OR REFACTORING INITIATIVES.**
> This roadmap document is for future reference only and MUST NOT be implemented or modified during any review unless explicitly requested and approved by the user.

---

## 1. Executive Summary & Problem Context
In recruitment workflows, active requisition volume fluctuates. As jobs close, fill, or expire after months of inactivity, their operational relevance diminishes. Without lifecycle management, older jobs and associated candidate history accumulate in the local database.

This document outlines two prospective solutions to preserve performance and declutter the user experience when database volume scales:
1. **Settings Cleanup / Retention Tool**: Administrative bulk-pruning or archival of historical jobs and outdated candidate submissions.
2. **Infinite Pagination in `Jobs.tsx`**: Transitioning from full-list fetch to cursor- or offset-based infinite scrolling if active job volume exceeds 300 requisitions.

---

## 2. Feature Specification: Job & Candidate Cleanup in Settings

### 2.1 Proposed User Interface (`src/pages/Settings.tsx` or Cleanup Dialog)
Add a dedicated **"Data Lifecycle & Retention"** section with safe, progressive cleanup controls:

- **Filter Criteria**:
  - Closed / Inactive jobs older than **30 days / 60 days / 90 days / 180 days**.
  - Orphaned candidate records with status `rejected` or `archived` not attached to any active requisition.
- **Action Levels**:
  - **Level 1: Soft Archive**: Flag records as `archived = 1` so they are excluded from main views and pipeline searches without physical data loss.
  - **Level 2: Hard Purge (Permanent Cleanup)**: Physically delete eligible closed jobs, associated candidate screening logs, notes, and local file attachments to recover disk space.
- **Safety Safeguards**:
  - **Count Preview**: Displays exact impact before execution (e.g., *"This will remove 42 closed jobs and 318 historical candidate submissions older than 90 days"*).
  - **Double Confirmation**: Requires typing `"DELETE"` or confirming a modal prompt.
  - **SQLite Vacuum**: Automatically executes `VACUUM` post-purge to defragment the SQLite database file and reclaim disk pages.

### 2.2 Proposed Backend Command (`src-tauri/src/commands/data.rs`)
```rust
#[tauri::command]
pub fn purge_historical_data(
    state: State<'_, AppState>,
    older_than_days: u32,
    include_candidates: bool,
) -> AppResult<PurgeSummary> {
    // 1. Begin atomic transaction
    // 2. Identify candidate jobs with status = 'closed' and closed_at < cutoff
    // 3. Delete linked candidates (or detach if candidate has multiple job links)
    // 4. Delete jobs
    // 5. Run PRAGMA incremental_vacuum / VACUUM
    // 6. Return exact counts deleted
}
```

---

## 3. Feature Specification: Job Table Infinite Scrolling (`Jobs.tsx`)

### 3.1 Trigger Threshold
- Only required if active job volume routinely exceeds **300 concurrent jobs**.
- Below 300 jobs, SQLite query latency is $<2\text{ms}$ and React table rendering is $<10\text{ms}$.

### 3.2 Proposed Architecture
- **Backend**:
  - Add `limit: Option<i64>` and `offset: Option<i64>` (or cursor based on `(updated_at, id)`) to `get_jobs`.
  - Provide `get_jobs_count` or return `{ items: Vec<JobWithStats>, total: i64, has_more: bool }`.
  - Omit heavy text fields (`refined_jd`, `screening_questions`, `notes`) from the list query projection, fetching them only in `JobDetail.tsx`.
- **Frontend**:
  - Introduce `useInfiniteJobs` via `@tanstack/react-query`'s `useInfiniteQuery`.
  - Integrate `InfiniteScrollTrigger` at the bottom of the table tbody, identical to the implementation in `Candidates.tsx`.
  - Maintain client-side sorting or translate `useTableSort` parameters to backend SQL `ORDER BY` clauses for seamless multi-page sorting.

---

## 4. Implementation Status
- **Status**: Deferred / Brainstorming Only
- **Pre-requisites**: Explicit user instruction to begin implementation.
