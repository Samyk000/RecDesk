# RecDesk — Deferred Architectural Work & Future Enhancements

> **NOTE**: This document serves as a short, organized backlog for tasks deferred for future planning and implementation. Do not implement without explicit user direction.

---

## 1. Data Lifecycle & Retention Tool
- **Goal**: Administrative bulk cleanup and pruning of historical closed jobs and outdated candidate submissions.
- **Location**: `src/pages/Settings.tsx` & `src-tauri/src/commands/data.rs`.
- **Key Concepts**:
  - Filter criteria: closed/inactive jobs older than 30/60/90/180 days; orphaned rejected candidates.
  - Action levels: Soft Archive (`archived = 1`) or Hard Purge (permanent deletion + `VACUUM`).
  - Safety checks: impact count preview modal and confirmation before execution.

---

## 2. Jobs Table Infinite Pagination
- **Goal**: Cursor- or offset-based infinite scrolling for `Jobs.tsx` when requisition count scales beyond 300 concurrent jobs.
- **Location**: `src/pages/Jobs.tsx`, `src/hooks/useQueries.ts`, and `src-tauri/src/commands/job.rs`.
- **Key Concepts**:
  - Backend pagination: add `limit` / `offset` (or cursor) to `get_jobs`, projecting lightweight summary columns.
  - Frontend hook: `useInfiniteJobs` matching `useInfiniteCandidatesWithJob` with `InfiniteScrollTrigger`.
  - Maintain server-side or client-side sorting parity across page boundaries.

---

## 3. Data Import Query Cache Invalidation [COMPLETED]
- **Status**: Implemented in `src/pages/Settings.tsx`. `invalidateAllDataQueries()` comprehensively invalidates `["clients"]`, `["jobs"]`, `["candidates"]`, `["candidatesWithJob"]`, `["dashboard"]`, and `["globalSearch"]` upon JSON and Excel import.

---

## 4. SQLite WAL Mode Snapshot Safety
- **Goal**: Safe, non-blocking snapshot backups when SQLite operates under Write-Ahead Logging (WAL) mode.
- **Location**: `src-tauri/src/commands/data.rs` & `src-tauri/src/db.rs`.
- **Key Concepts**:
  - Direct file copy of `.db` file in WAL mode can capture dirty pages or miss pending writes in `-wal` and `-shm` files.
  - Leverage SQLite's online backup API or `VACUUM INTO ?` command to generate clean, self-contained single-file snapshots safely while the database is live.
