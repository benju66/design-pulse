# Design Pulse

## 1. Project Overview

Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Design Coordination Tracker designed specifically for commercial construction. It bridges the gap between pre-construction estimates and architectural execution by transforming static, disconnected spreadsheets into an interactive, spatial, and auditable state-machine. 

By centralizing Value Engineering (VE) data and design updates into a single source of truth, Design Pulse eliminates "decision amnesia" and ensures that approved financial options seamlessly translate into actionable design coordination pipelines.

## 2. Core Features

- **Tri-State Master-Detail Grid:** A high-performance Value Engineering matrix featuring an Excel-like keyboard navigation experience. Supports flat dense tables, split detail panels, and pop-out isolated views for rapid data entry and evaluation.
- **Design Coordination Tracker:** A drag-and-drop Kanban pipeline for managing architectural and MEP drawing updates directly downstream from locked financial decisions.
- **Permits Tracker:** A specialized workspace for managing complex permit lifecycles, featuring both a high-fidelity Board view for status tracking and a Table view for granular detail management.
- **Bulk Import Engine:** A high-performance Excel/CSV processing pipeline that utilizes client-side chunking and set-based PostgreSQL operations to import hundreds of records instantly.
- **Advanced Multi-Select Filtering:** Powerful data exploration capabilities allowing for multiple concurrent selections across Building Areas, Cost Codes, and Disciplines.
- **Role-Based Access Control (RBAC):** Dynamic, granular permissions (Owner, GC Admin, Design Team, Viewer) controlled securely at the database level via PostgreSQL Row Level Security (RLS).
- **Financial Immutability & Audit Trails:** A robust soft-delete architecture paired with strict database triggers to lock approved budgets, ensure financial calculation accuracy, and track comprehensive historical changes.

## 3. Tech Stack Glossary

### Frontend
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand (Global State)
- **Data Fetching & Caching:** TanStack Query
- **Data Grid:** TanStack Table
- **Drag-and-Drop:** `@dnd-kit`
- **Spatial/Canvas:** `react-konva`

### Backend
- **Platform:** Supabase (PostgreSQL)
- **Security:** Row Level Security (RLS) & RPC Stored Procedures
- **Realtime:** WebSockets for live sync
- **Storage:** Supabase Storage
- **Microservices:** Python/FastAPI (Heavy PDF processing)

## 4. Local Setup & Installation

Follow these steps to run the Next.js development server locally.

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd design-pulse
   ```

2. **Install frontend dependencies:**
   Navigate to the Next.js directory and install the packages.
   ```bash
   cd designpulse-next
   npm install
   # or yarn install
   ```

3. **Database Schema:**
   The database architecture is defined in the `supabase_schema.sql` file located in the root directory. Execute this file in your Supabase SQL editor to scaffold the tables, RLS policies, functions, and triggers.

4. **Start the development server:**
   ```bash
   npm run dev
   # or yarn dev
   ```
   The application will be accessible at `http://localhost:3000`.

## 5. Environment Variables

Create a `.env.local` file inside the `designpulse-next` directory. Below is the required template (do not commit actual secret values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Procore Integration (OAuth)
NEXT_PUBLIC_PROCORE_CLIENT_ID=
```

## 6. Release Notes

---

### v0.8 — Procore Budget Import Engine & Versioned Estimate Baseline
**Released:** 2026-05-07

This release introduces a complete, enterprise-grade Procore budget import pipeline. Project teams can now ingest a Procore Budget Import Template (`.xlsx`) directly into Design Pulse, creating a versioned financial baseline that powers the waterfall chart, the `original_budget` metric, and future cross-version variance reporting — all without leaving the browser.

#### New Features

**Client-Side Procore Budget Parser (`procoreBudgetParser.ts`)**
A fully in-browser Excel parser that reads the **"Budget Line Items"** sheet from a Procore Budget Import Template without any server round-trip.
- _Two-tier budget resolution:_ **Tier 1** reads the *Manual Calculation* column (user-typed, always reliable). **Tier 2** reads the *Budget Amount* formula cache. If both return 0 (e.g., the file was uploaded without running Excel's Recalculate All first), the row is flagged with `is_budget_resolved: false` — surfacing an amber warning in the staging grid rather than silently importing $0.
- _`cellNumberResolved()`:_ New internal function that distinguishes `resolved=true` (real numeric value found) from `resolved=false` (NOCACHE formula or empty cell), eliminating the old bug where genuine $0 budgets and unresolvable formula cells were indistinguishable.
- _`_rawCols` cache:_ Every numeric column's value is captured per-row at parse time so the **column picker** can instantly remap all `budget_amount` values to a different column without re-reading the file.
- _`ParseResult`:_ The parser now returns `{ rows, availableHeaders }` — the list of discovered numeric column headers powers the staging grid's column picker dropdown.
- _`normalizeProcoreCode()`:_ Extracts the sub-code only (segment between `-` and `.`), `padStart(6, '0')` — correctly matches the 6-digit internal cost code format per AGENTS.md C32. iOS-safe: digit-loop validation, no regex lookbehind.
- _C19 compliance:_ Uses `exceljs/dist/exceljs.min.js` (browser-safe bundle) to prevent Next.js Webpack from bundling Node.js stream polyfills into the client build.

**Versioned Estimate Engine (Database)**
A three-RPC atomic pipeline manages the full import lifecycle:
1. `create_estimate_version` — Creates a draft version header (`is_finalized=false`).
2. `bulk_append_estimate_lines` — Inserts rows in 50-row sequential chunks. Includes a JSONB array guard (`jsonb_typeof(p_payload) = 'array'`), set-based `INSERT ... SELECT ... FROM jsonb_array_elements(...)`, a cross-ownership guard, and `ROUND(..., 2)` for cent-accurate storage.
3. `finalize_estimate_version` — Atomically stamps `is_finalized=true` and computes `total_budget = ROUND(SUM(budget_amount), 2)`. Syncs `project_settings.original_budget` when the version is active, using `SELECT ... FOR UPDATE` to prevent concurrent race conditions.

Additional supporting RPCs:
- `activate_estimate_version` — Atomically deactivates all current versions and activates the target in a single transaction (AGENTS.md C33).
- `delete_draft_estimate_version` — Guards deletion with `is_finalized` (not `total_budget != 0`), correctly allowing deletion of incomplete imports and blocking deletion of legitimately $0 finalized budgets.

**Staging Grid with Smart UX**
After uploading a file, a full inline staging grid lets users review, correct, and confirm all rows before committing to the database.
- _Dual amber badges:_ **"X unmatched"** (cost code not found in the cost code library) and **"X unresolved budget"** (NOCACHE rows) appear in the staging header, using `is_budget_resolved` — not `budget_amount === 0` — to avoid false alerts on intentional $0 lines.
- _Column picker:_ A **"Budget col:"** dropdown appears when the sheet has multiple numeric columns. Selecting a column instantly remaps all `budget_amount` values from the `_rawCols` cache. Any column picker change marks all rows as `is_budget_resolved: true`.
- _Inline budget editing:_ Each row's budget cell switches between formatted currency (unfocused) and raw number (focused). **Escape** cancels the edit and reverts to the value at focus time (AGENTS.md C18 — Excel-style UX). Any manual edit marks the row resolved, clearing its amber warning.
- _Platform-neutral tip:_ The upload zone displays a `Recalculate All` instruction with both **Ctrl+Alt+F9** (Windows) and **⌘ Opt F9** (Mac) shortcuts to guide users in populating formula caches before uploading.
- _Cost code remapping:_ Unmatched rows can be corrected inline using the `SmartCostCodeCombobox` — no re-import required.

**Version History Viewer**
Every entry in the Version History panel is now **clickable**, opening a `VersionLinesViewer` modal that displays all `project_estimates` line items for that version — cost code, type, description, and budget — in a searchable table. Activate and Delete buttons use `e.stopPropagation()` (justified — prevents the click from propagating to the card's `onView` handler, not related to click-outside detection).

**Enhanced Budget Waterfall RPC (`get_project_budget_waterfall`)**
The waterfall RPC has been upgraded to support:
- **`pending_impact`** — Sum of cost impacts from Draft/Pending opportunities (worst-case exposure).
- **`projected_position`** — `budget + locked_impact + pending_impact` (forward-looking projection).
- **`p_version_id UUID DEFAULT NULL`** — Optional parameter to query any historical version instead of only the active one.
- **FULL OUTER JOIN** between `budget_agg` and `opp_agg` — Surfaces "Unbudgeted" opportunities (VE items with no corresponding estimate line) and prevents join fan-out bugs on multi-line cost codes.

**Per-Project UI State Persistence (Zustand v2)**
`useUIStore` has been bumped to **version 2** with full migration support:
- `activeView: Record<string, ProjectView>` — Remembers the last visited sidebar view per project.
- `activeSettingsTab: Record<string, SettingsTab>` — Remembers the last active Settings tab per project.
- `navigateToSettings(projectId, tab)` — Compound action that updates both fields in a single `set()` call to prevent the one-frame flash (AGENTS.md C37).
- `veGridViewMode: VEGridViewMode` — Flat (shared across all projects) per AGENTS.md C36.
- Persisted state validity guards: `VALID_SETTINGS_TABS` and `VALID_PROJECT_VIEWS` Set constants with type guard functions prevent stale or renamed enum values from crashing navigation (AGENTS.md C35).

#### Bug Fixes

**TanStack Query Key Mismatch (`project-settings` → `project_settings`)**
`useImportEstimateMutation` and `useActivateEstimateVersion` were invalidating `['project-settings', projectId]` (hyphen) but `useProjectSettings` registers under `['project_settings', projectId]` (underscore). This mismatch caused the Project Info tab's `Original Budget` field to not refresh after import. Fixed to use the underscore form throughout.

**JSONB Payload Double-Encoding (`JSON.stringify` Revert)**
A previous attempt to fix JSONB serialization introduced `JSON.stringify(payload)` in the mutation hook. Because the Supabase JS client already stringifies the full params object, this caused PostgREST to receive a JSON _string_ instead of a JSON _array_ — triggering the `jsonb_typeof() = 'array'` guard in `bulk_append_estimate_lines` and silently inserting 0 rows (total budget = $0). Reverted to passing the raw array directly.

**`PERFORM id` → `PERFORM 1` in Project Settings Row-Lock**
`project_settings` uses `project_id` as its primary key (not `id`). The `PERFORM id FROM project_settings ...` row-lock pattern referenced a non-existent column. Fixed to `PERFORM 1 FROM project_settings ... FOR UPDATE` in both `finalize_estimate_version` and `activate_estimate_version`.

#### Internal / Architecture

| Item | Detail |
|------|--------|
| AGENTS.md §D | New **Architectural Organization** section: Anti-Monolith Component Rule, Domain-Driven Hook Separation, Custom Hook Extraction, FastAPI Backend Modularity |
| `is_finalized` column | `project_estimate_versions` — Added with `ADD COLUMN IF NOT EXISTS` for idempotent deployment on existing instances |
| `useMemo` for `knownCodes` | `ProjectEstimateTab` — Prevents `processFile` / `handleDrop` recreation on every render |
| `_rawCols` field | `EstimateStagingRow` — Optional `Record<string, number>` captured at parse time; stripped from DB payload by the mutation hook's explicit field map |
| `BudgetWaterfallRow` type | Added `pending_impact: number` and `projected_position: number` to match the enhanced RPC return shape |
| `exceljs` import | `procoreBudgetParser.ts` aligned with all other parsers: `exceljs/dist/exceljs.min.js` + `ExcelJSModule.default ?? ExcelJSModule` pattern (AGENTS.md C19) |


---

### v0.7 — Financial Intelligence & Master-Detail Architecture
**Released:** 2026-05-06

This release transforms Design Pulse into a full-fledged enterprise financial tool. We completely overhauled the budget tracking engine to provide perfect mathematical accuracy, and locked down the core grid interface to enforce a highly performant, Jira-style Master-Detail workflow.

#### New Features

**High-Fidelity Project Waterfall Analytics**
The top-level `BudgetSummaryV2` now features a multi-layered geometric CSS waterfall chart. It visualizes the flow of money by breaking down baseline budgets against "Locked Savings" and "Pending Exposure" (worst-case scenario unapproved options).
- _Architecture:_ Pure CSS geometric bars (no heavy charting libraries) with zero-JS native tooltips for instant hover inspection.
- _Backend:_ Powered by a new, highly optimized `get_project_budget_waterfall` CTE-based RPC that eliminates join fan-out bugs and calculates projected positions entirely on the server.

**Master-Detail Enforcement (Read-Only Grid V2)**
Grid V2 has been stripped of all inline editing capabilities. The grid is now exclusively a "scanner and finder," forcing all edits through the side Detail Panel.
- _Performance:_ Removing thousands of invisible `<input>` and `<select>` elements and their associated React state listeners resulted in a massive scroll performance and memory usage boost on large projects.
- _Data Integrity:_ It is now impossible to accidentally alter a status or cost code while clicking, dragging, or sorting rows.

**Real-Time Financial Sync**
The application's WebSocket pipeline has been upgraded. Locking an option in the Value Matrix now instantly updates the global budget waterfall and header math across all connected clients without requiring a page refresh.

**Smart Cost Code Combobox**
A unified, high-performance taxonomy selector that merges CSI specification numbers with financial cost codes. It utilizes a defensive substring search to handle both `.L` (Labor) / `.M` (Material) suffix variations and pure architectural tags seamlessly.

---

### v0.6 — Escalation Workflow Hardening & Category-Controlled Coordination Routing
**Released:** 2026-05-06

This release hardens the bridge between the **Value Matrix** (Pre-Construction) and the **Coordination Board** (Design Team), eliminating data loss risks, cleaning up board noise, and giving project admins per-category control over what triggers a coordination task.

#### New Features

**Category-Controlled Coordination Routing**
Project admins can configure each dropdown category in **Project Settings → Categories** with a **"No Coord Default"** toggle. When ON, selecting that category on a contender automatically pre-fills the *Requires Coordination* toggle to OFF. This prevents categories like "Already in Plans/Specs" from generating coordination tasks on the board when locked.
- _Location:_ Project Settings → Categories tab
- _Storage:_ `project_settings.categories` (`CategoryConfig[]` — `{id, label, no_coord_default}`)
- _Logic:_ `SortableContenderCard.tsx` → `onChange` on the category `<select>`

**Safe De-escalation ("Recall from Value Matrix")**
Coordination Board items escalated to the Value Matrix now have a safe reversal path. The delete button context-switches to **"Remove from Value Matrix"**, calling the new `de_escalate_opportunity` RPC. This atomically resets financials to zero, unlocks contender options, and strips the escalation flag — without touching the original Coordination record.
- _Location:_ `ExpandedCard.tsx` (Value Matrix detail panel)
- _RPC:_ `public.de_escalate_opportunity(p_opp_id UUID)` — SECURITY DEFINER
- _Pattern:_ Non-Destructive State Reversal (AGENTS.md C31)

**VE Selection Details — Always Visible for Locked Records**
The VE Selection Details card in the Coordination Detail Panel now renders for any record that has a locked contender, regardless of record origin. Previously this was hidden for some escalated items due to a record type guard.
- _Location:_ `CoordinationDetailPanel.tsx`

**Escalation Button UX Parity**
The escalation button now reads **"Escalate to Value Matrix"** / **"Recall from Value Matrix"** with descriptive tooltips explaining each action.
- _Location:_ `CoordinationDetailPanel.tsx`

#### Bug Fixes

**Coordination Board Filter — Dead Status Removed**
Removed `'Pending Plan Update'` from the board filter (a phantom status the lock RPC never writes). Board visibility is now strictly `coordination_status !== 'Not Required'`.
- _Location:_ `app/project/[projectId]/page.tsx`

**C24 Hook Firehose — SortableContenderCard**
Removed `useProjectSettings` from inside `SortableContenderCard` (rendered N times per opportunity). Disciplines and categories are now derived once in `ContendersMatrix` and passed as props.
- _Location:_ `ContendersMatrix.tsx`, `SortableContenderCard.tsx`

**Stale Category Dropdown Guard**
Category `<select>` now uses `.some()` instead of `.includes()` when checking if a saved value still exists in settings — previously saved categories remain visible even after being removed from project settings.
- _Location:_ `SortableContenderCard.tsx`

#### Internal / Architecture

| Item | Detail |
|------|--------|
| `CategoryConfig` interface | `types/models.ts` — `{id: string, label: string, no_coord_default: boolean}` |
| `normalizeCategories()` | `lib/normalizeSettings.ts` — Migrates legacy `string[]` to `CategoryConfig[]` at read-time, no DB migration required |
| `DEFAULT_CATEGORIES` | `lib/constants.ts` — Upgraded to `CategoryConfig[]` with stable prefixed IDs |
| `CoordinationDetailsMap` type | `types/models.ts` — Correctly types mixed JSONB: `{ is_escalated?: boolean } & Record<string, DisciplineDetails>` |
| Type guards | `CoordinationBoard.tsx`, `CoordinationTable.tsx` — Safe `.filter()` before accessing `.status` on discipline entries |

