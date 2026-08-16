# RecDesk

A **local-first** desktop app for managing your recruiting pipeline — track clients, jobs, and candidates in one place. Everything is stored in a SQLite database on your device, so your data stays yours.

> **Note:** RecDesk is in active development. Features and workflows will keep improving.

---

## Features

- **Clients** — maintain a roster of clients with contact details, hiring managers, and notes
- **Jobs** — create positions per client with location, work model, engagement type, and status
- **Candidates** — manage candidates per job with match scores, contact info, resumes, and recruiter notes
- **Pipeline tracking** — move candidates through stages (sourced → in touch → submitted → interview → rejected / not interested), with dates and rejection reasons
- **Job details** — refined job descriptions, boolean search strings, candidate pitch, and screening questions
- **Dashboard** — overview of active jobs, candidates needing action, and recent activity
- **Global search** — quickly find clients, jobs, and candidates (shortcut: `Ctrl/Cmd + K`)
- **Theme** — light, dark, or system appearance
- **Backup & restore** — export and import your data as JSON
- **Demo data** — seed the app with sample data to explore it

## Installation

Download the latest installer from the [Releases](https://github.com/Samyk000/RecDesk/releases) page:

- **Windows (recommended):** `RecDesk_<version>_x64-setup.exe`
- **Windows (MSI):** `RecDesk_<version>_x64_en-US.msi`

Since the installers are unsigned, Windows SmartScreen may warn you. Click **More info** → **Run anyway**.

## Getting started

1. Install RecDesk and launch it.
2. Optional: open **Settings → Data → Load demo data** to explore with sample clients, jobs, and candidates.
3. Start adding clients, then create jobs under each client, then add candidates to those jobs.

> Your data is stored locally (AppData on Windows) and persists across updates. Use **Settings → Data → Export backup** to keep a copy.

## Development

RecDesk is built with [Tauri v2](https://tauri.app/), Rust, and React (TypeScript + Vite).

### Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- Platform prerequisites for Tauri (e.g. WebView2 and MSVC build tools on Windows) — see the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Run in development

```bash
pnpm install
pnpm tauri dev
```

### Build the app

```bash
pnpm tauri build
```

The bundled installers are written to `src-tauri/target/release/bundle/`.

### Tests

```bash
cd src-tauri
cargo test
```

## Tech stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Shell    | Tauri v2                                     |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS     |
| State    | TanStack Query, Zustand                      |
| Storage  | SQLite (via rusqlite, bundled)               |

## License

Private project. All rights reserved.