# Design Pulse

## 1. Project Overview

Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Design Coordination Tracker designed specifically for commercial construction. It bridges the gap between pre-construction estimates and architectural execution by transforming static, disconnected spreadsheets into an interactive, spatial, and auditable state-machine. 

By centralizing Value Engineering (VE) data and design updates into a single source of truth, Design Pulse eliminates "decision amnesia" and ensures that approved financial options seamlessly translate into actionable design coordination pipelines.

## 2. Core Features

- **Tri-State Master-Detail Grid:** A high-performance Value Engineering matrix featuring an Excel-like keyboard navigation experience. Supports flat dense tables, split detail panels, and pop-out isolated views for rapid data entry and evaluation.
- **Persistent Grid Pinning:** Enterprise-grade column pinning that merges global admin-defined default layouts with local, user-specific browser overrides, utilizing high-performance CSS and zero-JS tooltips.
- **Enterprise Budget Ledger:** A management-by-exception view that merges VE opportunities with imported estimate line items into a unified financial grid. Features dense compound cells, variance threshold filtering ($0–$500k slider), a VE Focus toggle to isolate cost codes with active VE items, scoped filter pipelines preventing cross-view state leaks, neutral "Budget Line" status styling, and isolated column visibility persistence.
- **Design Coordination Tracker:** A drag-and-drop Kanban pipeline for managing architectural and MEP drawing updates directly downstream from locked financial decisions.
- **Permits Tracker:** A specialized workspace for managing complex permit lifecycles, featuring both a high-fidelity Board view for status tracking and a Table view for granular detail management.
- **Bulk Import Engine:** A high-performance Excel/CSV processing pipeline that utilizes client-side chunking and set-based PostgreSQL operations to import hundreds of records instantly.
- **Advanced Multi-Select Filtering:** Powerful data exploration capabilities allowing for multiple concurrent selections across Building Areas, Cost Codes, and Disciplines.
- **Role-Based Access Control (RBAC):** Dynamic, granular permissions (Owner, GC Admin, Design Team, Viewer) controlled securely at the database level via PostgreSQL Row Level Security (RLS).
- **Financial Immutability & Audit Trails:** A robust soft-delete architecture paired with strict database triggers to lock approved budgets, ensure financial calculation accuracy, and track comprehensive historical changes.

## 3. Interactive Drawings & Extraction Engine

The Drawings module provides deep spatial context for Value Engineering and Design Coordination items, paired with a robust, automated ingestion pipeline for architectural drawing sets.

### Overview
Instead of viewing disconnected line items, teams can upload multi-page architectural sets and map specific financial decisions or coordination tasks directly to physical locations on the floorplan, ensuring total clarity on where decisions impact the project.

### Functions and Features
- **Automated Title Block Extraction:** Upload massive multi-page architectural PDFs. Users can drag "training zones" over the Drawing Number and Title block on a single preview sheet to train the extractor.
- **Precision Derotation Matrix:** The backend extraction engine utilizes exact 1:1 coordinate mapping and derotation matrices via `PyMuPDF` to accurately extract metadata even from internally rotated architectural source files.
- **Debounced Live Preview:** The training interface provides instant, debounced visual validation of the text the engine is capturing, preventing misaligned extraction runs.
- **Batch Review Wizard:** After executing a batch extraction across the document set, users are dropped into an interactive Master-Detail review wizard featuring inline pan/zoom controls to manually verify or edit the metadata sheet-by-sheet before committing to the database.
- **DeepZoom Tile Processing:** Heavy vector PDFs are processed asynchronously via a FastAPI worker into hierarchical DeepZoom web tiles, guaranteeing smooth 60fps pan and zoom performance on the frontend regardless of the original file complexity.
- **Bi-Directional State Synchronization:** Clicking a row in the Value Matrix data grid instantly highlights the corresponding markup pin on the canvas. Conversely, clicking a pin on the canvas auto-scrolls the virtualized data grid to the exact row, utilizing atomic cross-store Zustand updates to prevent render loops.

## 4. Tech Stack Glossary

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

## 5. Local Setup & Installation

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

## 6. Environment Variables

Create a `.env.local` file inside the `designpulse-next` directory. Below is the required template (do not commit actual secret values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Procore Integration (OAuth)
NEXT_PUBLIC_PROCORE_CLIENT_ID=
```

## 7. Release Notes

---

### v0.12 — Budget Ledger Remediation & Filter Architecture
**Released:** 2026-05-14

This release hardens the Budget Ledger's financial integrity, eliminates type safety violations, and restructures the filter pipeline to prevent cross-view state leaks.

#### Financial Logic Fixes

**Status Bucketing Fix (`get_master_ledger_grid` RPC)**
The `ve_impacts` CTE previously used a binary `status = 'Approved'` / `status != 'Approved'` split, causing Rejected VE items to inflate the "Pending Δ" column. Now uses explicit enumeration matching the waterfall RPC:
- _Locked (Approved Δ):_ `Approved`, `Pending Plan Update`, `Implemented`
- _Pending (Pending Δ):_ `Draft`, `Pending Review`, `Pending`
- _Excluded (zero weight):_ `Rejected` and any unknown future statuses
- _Migration:_ `supabase_migrations/20260514_fix_ledger_status_bucketing.sql`

**Budget Line Status Semantics**
Synthetic budget lines now display `'Budget Line'` instead of `'Approved'` in the VE Status column:
- _Visual:_ Neutral `text-slate-500` styling — no green "Approved" badge for estimate rows that have no VE decision attached.
- _Filter bypass:_ Budget lines are exempt from VE status filtering via `is_budget_line` guard, ensuring they always appear regardless of active status filters.
- _Isolation verified:_ `columns-v2.tsx` imports exclusively from `ReadOnlyCell.tsx`, so the `isLocked = status === 'Approved'` edit guard in `EditableCell.tsx` is unaffected.

#### New Features

**VE Focus Toggle**
A new toggle in the Budget Ledger filter drawer that filters the view to only show cost codes with active VE items — collapsing from "full estimate with VE overlay" to "only cost codes where VE work is happening":
- _Toggle UI:_ Styled switch under a "VE Focus" section header. Sky-blue active state, slate inactive state.
- _Filter logic:_ Builds a `Set<string>` of VE cost codes from the filtered dataset, then hides budget lines whose cost code is not in the set. VE items always pass through.
- _Badge integration:_ Counts as an active filter in the `[Filters N]` pill. Reset by "Clear All".

**Filtered Metric Indicators**
The VE Impact and Exposure metric pills now display a `✱` indicator when filters are active, signaling that the displayed values reflect filtered data. Budget Total intentionally excluded — budget lines bypass status filters, so the total is always unfiltered.

#### Filter Architecture Refactor

**Ghost Filter Elimination**
`activeStatus` was previously embedded in the shared `applyBaseFilters` callback, causing VE status filters set in the Value Matrix to silently persist when switching to the Budget Ledger (which has no status dropdown to reveal or clear the filter):
- _Fix:_ Removed `activeStatus` from `applyBaseFilters`. It is now applied exclusively in the `filteredOpportunities` memo (Value Matrix-specific).
- _Result:_ Setting a status filter in the Value Matrix has zero effect on the Budget Ledger.

**Centralized Filter Count & Clear**
Previously, `filterActiveCount` and `onClearFilters` were computed inline at the call site in each view component — duplicated across `BudgetLedgerView.tsx` and `ValueMatrixView.tsx`. Adding a new filter required updating both:
- _Fix:_ `ledgerFilterActiveCount` (derived value) and `ledgerClearFilters` (`useCallback`) are now computed once in `page.tsx` and passed as pre-computed props.
- _Result:_ Adding a new ledger filter now requires updating only one file.

#### Type Safety

**9 `any` Casts Eliminated in `ReadOnlyCell.tsx`**
All `any` type violations replaced with proper types from the existing `TableMeta` interface and `models.ts`:
- `(o: any)` → typed via `OpportunityOption` and `keyof Pick<OpportunityOption, ...>`
- `(c: any)` → inferred from `CostCode[]`, `ProjectCsiSpec[]` via `TableMeta`
- `(table.options.meta as any)` → direct optional chaining `table.options.meta?.`
- `(m: any)` → inferred from `ProjectMember[]` via `TableMeta`

#### Internal / Architecture

| Item | Detail |
|------|--------|
| `feature_step1.sql` | Deleted — stale pre-fix version of `get_master_ledger_grid` with zero codebase references |
| `applyBaseFilters` | `page.tsx` — No longer depends on `activeStatus`. Dependencies: `[activeBuildingAreas, activeCostCodes]` only |
| `filteredOpportunities` | `page.tsx` — Now applies `activeStatus` filter inline, scoped to Value Matrix |
| `ledgerFilterActiveCount` | `page.tsx` — Centralized derived value replacing inline computation in `BudgetLedgerView` |
| `ledgerClearFilters` | `page.tsx` — Centralized `useCallback` replacing inline arrow function in `BudgetLedgerView` |
| `showVeOnly` | `page.tsx` — `useState<boolean>` controlling VE Focus filter, passed through `BudgetLedgerView` |
| `StatusCell` | `ReadOnlyCell.tsx` — New `'Budget Line'` rendering case with neutral `text-slate-500` styling |
| `OpportunityOption` import | `ReadOnlyCell.tsx` — Added for `keyof Pick<OpportunityOption, ...>` in `ImpactCell` |
| Migration | `supabase_migrations/20260514_fix_ledger_status_bucketing.sql` — Full `CREATE OR REPLACE` + `REVOKE/GRANT` |

---

### v0.11 — Enterprise Budget Ledger & Management by Exception
**Released:** 2026-05-12

This release transforms the existing Opportunity Grid V2 into a Tier-1 Enterprise Budget Ledger with dense compound cells, visual context icons, and variance threshold filtering — enabling executives to focus on material budget deviations rather than scanning hundreds of line items.

#### New Features

**Phase 1: Data Architecture & Ingestion**
The database and ingestion pipeline were extended to support rich textual context alongside financial data:
- _`item_assumptions` column:_ Added to `project_estimates` — stores free-text assumptions captured during Procore budget imports (e.g., "Assumes 3/4\" thick throughout").
- _`estimate_variance_notes` table:_ Stores user-provided explanations for cost swings detected during estimate upload, scoped per `(estimate_version_id, cost_code)`. Protected by an `enforce_variance_note_immutability` trigger that locks notes once the parent version is finalized.
- _`useEstimateVarianceNotes` hook:_ TanStack Query hook fetching variance notes for the active version only, consumed by the grid via `TableMeta.varianceNoteMap`.

**Phase 2: Compound Cells & Grid Consolidation**
Budget Ledger mode (`isLedgerView`) now collapses 9 granular columns into 2 dense compound cells, dramatically reducing horizontal sprawl:
- _`ItemDefinitionCell`:_ Merges `display_id`, `title`, and `building_area` into a single cell. Displays a `FileText` icon with native tooltip when `item_assumptions` data exists for the row.
- _`CostClassificationCell`:_ Merges `cost_code`, `division`, and `spec_number_id` into a single cell, using `formatCostCode()` for human-readable display with CSI spec cross-reference.
- _`ManagementCell`:_ Merges `assignee`, `priority`, and `due_date` — hidden by default since these workflow fields are irrelevant for budget line items. Users can opt-in via the Column Chooser.
- _`LedgerDeltaCell` variance icon:_ Displays a `MessageSquare` icon with tooltip preview when an `estimate_variance_note` exists for the row's cost code. Only renders on `is_budget_line` rows (VE items are immune).
- _`tabular-nums` typography:_ Applied across all financial columns for precise vertical decimal alignment.

**Variance Threshold Filtering ("Management by Exception")**
A slider filter ($0–$500k, $5k steps) in the Grid Filter Drawer hides budget lines whose total variance falls below the selected threshold:
- _Budget-line-only scope:_ VE opportunity rows are immune to threshold filtering — they always remain visible regardless of slider position.
- _Ephemeral state:_ Threshold is maintained as `useState` (not persisted) — resetting on page navigation by design.
- _Badge integration:_ Active threshold appears in the `[Filters N]` badge count. "Clear All" resets the slider to zero.

**View Extraction & Performance Optimization**
The monolithic project page (992 lines) was refactored into a state-management shell with extracted view components to eliminate sidebar navigation lag:
- _`ValueMatrixView`, `BudgetLedgerView`, `CoordinationView`:_ Extracted into `src/components/views/`, each owning its own JSX tree. Sidebar switches no longer trigger full-tree re-renders.
- _Decoupled filter pipeline:_ `filteredOpportunities` no longer depends on `currentView`. A shared `applyBaseFilters` callback feeds two independent memos (`filteredOpportunities` for Value Matrix, `filteredLedgerItems` for Budget Ledger), preventing cross-view recomputation.
- _Lazy loading:_ `AnalyticsDashboard` and `MyDeskDashboard` use `next/dynamic` — their JavaScript is only loaded when the user navigates to those views.

**Zustand Column Visibility Isolation**
Resolved a critical cross-grid state pollution bug where toggling columns in the Budget Ledger would overwrite user-persisted column preferences in the Value Matrix:
- _Root cause:_ Both grids shared the same `gridColumnVisibility[projectId]` Zustand key.
- _Fix:_ Added a dedicated `gridV2ColumnVisibility` key with automated v4→v5 migration for existing users.
- _`ColumnChooser` reset:_ The reset handler now re-applies mode-specific visibility defaults instead of clearing to `{}`.

#### Internal / Architecture

| Item | Detail |
|------|--------|
| `TableMeta.varianceNoteMap` | `tanstack.d.ts` — `Record<string, string>` mapping cost codes to variance note text |
| `gridV2ColumnVisibility` | `useUIStore.ts` — Isolated Zustand key for Budget Ledger column visibility (v5 migration) |
| `applyBaseFilters` | `page.tsx` — Shared `useCallback` eliminating `currentView` from filter dependencies |
| `src/components/views/` | New directory for extracted view components (`ValueMatrixView`, `BudgetLedgerView`, `CoordinationView`) |
| AGENTS.md §4 | Updated: Compound Cell bullet (ManagementCell hidden by default), new View Extraction Architecture bullet |

---

### v0.10 — Interactive Drawings & Bi-Directional Synchronization
**Released:** 2026-05-08

This release introduces an interactive, vector-based floorplan canvas natively integrated into the primary data grids. The "Drawings" module provides spatial context to Value Engineering and Coordination items, ensuring teams can visualize exactly where decisions impact the project.

#### New Features

**Bi-Directional State Synchronization**
The canvas (`FloorplanCanvas`) and data grids now communicate seamlessly without performance degradation or infinite render loops:
- _Grid to Map:_ Clicking a row in the data grid instantly highlights the corresponding "pin" (MappedZone) on the canvas above.
- _Map to Grid:_ Clicking a pin on the canvas automatically triggers `@tanstack/react-virtual` to smooth-scroll the grid directly to the matching row.
- _Store Architecture:_ The sync is powered by atomic cross-store communication between `useMapStore` (Zustand persistence) and `useUIStore`, with strict equality guards to prevent `Maximum call stack size exceeded` recursions.

**Strictly Typed Visual Canvas Suite**
The legacy `MarkupCanvas` has been completely retired. The new `FloorplanCanvas` suite is written in strict TypeScript, eliminating `any` usage and ensuring robust prop contracts for child components (`MappedZone`, `PendingPolygon`, `MapLegend`).

**Grid Integration & Layout**
- A new "Drawings" toggle button is available in the toolbar of both the Value Matrix (Grid V1 & V2) and the Design Coordination Board.
- When toggled, the map mounts in a split horizontal view above the data table, maximizing vertical space while maintaining spatial context.
- Hardened against React 18 event bubbling issues using `useRef` containment patterns for all click-outside detection (popovers, context menus), safely avoiding `e.stopPropagation()`.

---

### v0.9 — Persistent Grid Pinning & Matrix Architecture
**Released:** 2026-05-08

This release introduces an enterprise-grade column pinning system for the Value Engineering Matrix (Flat View & Grid V2). The architecture bridges global admin control with individual user flexibility, utilizing high-performance CSS rendering to eliminate React recalculation lag during column resizing.

#### New Features

**Dual-State Column Pinning Architecture**
The matrix now supports a robust column locking system that merges two distinct states:
- _Global Admin Defaults:_ Project Admins can define the default horizontal pinning layout for the entire team directly from **Project Settings → Value Matrix**, using a zero-JS toggle.
- _Local User Overrides:_ Users can customize their personal view using the grid's "View" dropdown. These preferences are saved locally to the browser via Zustand.
- _Delta Merging:_ The system uses a strict "Pinning Delta" logic (`explicitlyPinned`, `explicitlyUnpinned`). If an Admin adds a new column to the global project template, users instantly inherit it without their local browser cache hiding the update (AGENTS.md Rule 39).

**Sticky Grid Performance Enhancements**
We overhauled the rendering pipeline for pinned columns to solve native browser bleeding and layout tearing.
- _Z-Index & CSS Hardening:_ Replaced `border-collapse` with `border-separate border-spacing-0` and applied `bg-clip-padding` with opaque backgrounds (`bg-white`, `bg-[#f4f8fa]`). This guarantees that horizontally scrolling text perfectly slides *behind* the pinned columns without leaking through translucent colors or borders.
- _Memoization Hash:_ Injected a `pinnedColumnOffsets` hash directly into the `React.memo` comparator for virtualized rows. This ensures that live-resizing pinned columns dynamically updates adjacent cell positions without visual tearing (AGENTS.md Rule 10).
- _Zero-JS Enterprise Tooltips:_ The Pin icons utilize Tailwind's `group` and `absolute z-[100]` classes, strictly adhering to zero-JS portal guardrails.

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

