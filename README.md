# Design Pulse

## 1. Project Overview

Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Design Coordination Tracker designed specifically for commercial construction. It bridges the gap between pre-construction estimates and architectural execution by transforming static, disconnected spreadsheets into an interactive, spatial, and auditable state-machine. 

By centralizing Value Engineering (VE) data and design updates into a single source of truth, Design Pulse eliminates "decision amnesia" and ensures that approved financial options seamlessly translate into actionable design coordination pipelines.

## 2. Core Features

- **Tri-State Master-Detail Grid:** A unified, high-performance Value Engineering matrix (`OpportunityGridV2`) powering both the Value Matrix (flat dense table with inline editing) and Budget Ledger (grouped financial view with compound cells). Supports split detail panels and pop-out isolated views for rapid data entry and evaluation. All tables across the application share a standardized component system (`src/components/data-table/`) with TanStack-native row selection, virtual scrolling, and shared cell primitives.
- **Persistent Grid Pinning:** Enterprise-grade column pinning that merges global admin-defined default layouts with local, user-specific browser overrides, utilizing high-performance CSS and zero-JS tooltips.
- **Enterprise Budget Ledger:** A management-by-exception view that merges VE opportunities with imported estimate line items into a unified financial grid. Features dense compound cells, variance threshold filtering ($0–$500k slider), a VE Focus toggle to isolate cost codes with active VE items, scoped filter pipelines preventing cross-view state leaks, neutral "Budget Line" status styling, and isolated column visibility persistence.
- **Design Coordination Tracker:** A drag-and-drop Kanban pipeline for managing architectural and MEP drawing updates directly downstream from locked financial decisions.
- **Lessons Learned Engine:** A structured institutional knowledge capture system integrated into every project. Teams can log, categorize, and verify lessons using curated templates (Material Substitution, Subcontractor Performance, AHJ Requirement, Owner Specific). Verified lessons are cryptographically locked via database immutability triggers, with a SECURITY DEFINER RPC escape hatch for authorized re-opening. The schema includes AI/ML runway columns (`source_type`, `ai_confidence`, `ai_metadata`) for future summarization pipelines. Lessons are linkable to VE opportunity rows, searchable by CSI cost code, and surfaced proactively via the `get_lesson_indicators` RPC.
- **Permits Tracker:** A specialized workspace for managing complex permit lifecycles, featuring both a high-fidelity Board view for status tracking and a Table view for granular detail management.
- **Bulk Import Engine:** A multi-threaded, high-performance Excel processing pipeline that offloads heavy spreadsheet parsing off the main React rendering thread onto a dedicated background Web Worker using zero-copy Transferable Objects, ensuring a completely responsive 60 FPS UI experience during multi-megabyte uploads.
- **Advanced Multi-Select Filtering:** Powerful data exploration capabilities allowing for multiple concurrent selections across Building Areas, Cost Codes, and Disciplines.
- **Role-Based Access Control (RBAC):** Dynamic, granular permissions (Owner, GC Admin, Design Team, Viewer) controlled securely at the database level via PostgreSQL Row Level Security (RLS).
- **Financial Immutability & Audit Trails:** A robust soft-delete architecture paired with strict database triggers to lock approved budgets, ensure financial calculation accuracy, and track comprehensive historical changes.
- **CSI Specification Management:** A multi-tiered CSI-to-cost-code mapping system spanning company-wide defaults, project-level overrides, and ML-assisted suggestions. Platform admins maintain a centralized "Rosetta Stone" library with Excel bulk upload/download, which is atomically seeded into new projects. Project teams can view, search, edit, and extend mappings with full source lineage tracking (Company Default → Project Override → ML Suggested).
- **Scenario Planner & VE Packages:** A full-featured "what-if" analysis engine that allows pre-construction teams to group VE contenders into named packages, then assemble those packages into side-by-side scenarios. Each scenario column calculates real-time budget impact using a first-package-wins override algorithm. Packages and scenarios support cross-column drag-and-drop reordering via `@dnd-kit`, Package Bank search & click-to-add, configurable Package Scopes, and one-click "Apply Scenario" batch locking.

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

## 4. Scenario Planner & VE Packages

The Scenario Planner module enables "what-if" budget analysis by combining VE Packages into side-by-side Scenarios. It builds on top of the VE Packages engine (grouping opportunities with assumed contenders into named bundles) and adds a second layer — Scenarios — that compose multiple packages into a single financial projection.

### Architecture

The module follows a layered data architecture:

```
Opportunities (base decisions)
  └── Options / Contenders (per-opportunity alternatives)
        └── VE Packages (named bundles grouping contenders)
              └── VE Scenarios (compositions of packages for "what-if" comparison)
```

### Key Concepts

- **VE Packages:** Named, color-coded groups of opportunity–contender pairs. Each item in a package selects an `assumed_option_id` for a given opportunity. Packages support configurable **Package Scopes** (e.g., "Lobby", "Corridors") for organizational grouping.
- **VE Scenarios:** Named compositions of packages. Each scenario column shows which packages are included and calculates real-time budget impact using a **first-package-wins** override algorithm — when multiple packages target the same opportunity, the package with the lowest `sort_order` wins.
- **Budget Metrics:** Each scenario column displays a live `BudgetMetricsBar` comparing the scenario's projected budget against the project baseline, showing deltas for locked savings and potential exposure.
- **Apply Scenario:** A batch-locking action that applies all contender overrides from a scenario's packages in a single RPC call (`apply_ve_scenario`), locking each contender via the existing `lock_opportunity_option()` pipeline.

### Functions and Features
- **Horizontal Column Layout:** Scenarios render as scrollable vertical columns with sticky headers, sortable package cards, and a budget footer. Users can create, rename, duplicate, and delete scenarios inline.
- **Package Bank Panel:** A slide-out right panel listing all project packages. Supports full-text search, scope filtering, and scenario-assignment dot indicators. Packages can be added via click (when a scenario is selected) or drag-and-drop.
- **Drag-and-Drop:** Full `@dnd-kit` integration supporting three interactions: (1) Bank→Column drag to add packages, (2) within-column reorder via `SortableContext`, and (3) cross-column copy. Duplicate guards and toast feedback prevent redundant additions.
- **Package Scopes:** Admin-configurable organizational labels stored in `project_settings.package_scopes` (JSONB). Managed via the Scope Manager modal.
- **Apply Scenario Modal:** A confirmation dialog showing affected items (opportunity title + contender name) with a batch "Apply & Lock" action.

### Component Inventory

| Component | File | Purpose |
|-----------|------|---------|
| `ScenarioPlannerView` | `src/components/views/ScenarioPlannerView.tsx` | Top-level view wrapper; data fetching, DnD context, bank panel |
| `ScenarioColumn` | `src/components/scenario/ScenarioColumn.tsx` | Single scenario column; header, sortable body, budget footer |
| `ScenarioPackageCell` | `src/components/scenario/ScenarioPackageCell.tsx` | Compact sortable card for a package within a scenario |
| `PackageBankPanel` | `src/components/scenario/PackageBankPanel.tsx` | Slide-out panel listing all packages with search & drag |
| `ApplyScenarioModal` | `src/components/scenario/ApplyScenarioModal.tsx` | Confirmation modal for batch-locking contenders |
| `ScopeManagerModal` | `src/components/scenario/ScopeManagerModal.tsx` | CRUD modal for managing package scope labels |

### Database Schema

| Table | Purpose |
|-------|---------|
| `ve_scenarios` | Named scenario records per project. Soft-delete, audit-logged. |
| `ve_scenario_packages` | Junction table linking scenarios to packages with `sort_order`. `UNIQUE(scenario_id, package_id)`. |
| `ve_packages.scope_id` | Optional UUID referencing a scope in `project_settings.package_scopes` JSONB. |

### RPC Functions

| Function | Purpose |
|----------|---------|
| `apply_ve_scenario(p_scenario_id UUID)` | SECURITY DEFINER. Iterates scenario packages in sort order, builds first-package-wins overrides, then calls `lock_opportunity_option()` for each. |
| `duplicate_ve_scenario(p_scenario_id UUID)` | SECURITY DEFINER. Deep-copies scenario + junction rows with `sort_order` preserved. |

## 5. Tech Stack Glossary

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

## 6. Local Setup & Installation

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

## 7. Environment Variables

Create a `.env.local` file inside the `designpulse-next` directory. Below is the required template (do not commit actual secret values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Procore Integration (OAuth)
NEXT_PUBLIC_PROCORE_CLIENT_ID=
```

## 8. Release Notes

---

### v0.20 — Scenario Planner & VE Package Compositions
**Released:** 2026-05-26

This release introduces the Scenario Planner — a full "what-if" budget analysis engine that allows pre-construction teams to compose VE Packages into side-by-side Scenarios, calculate real-time budget deltas, and batch-apply locked contenders.

#### Scenario Planner Engine
- **Horizontal Column Layout:** Scenarios render as scrollable vertical columns with sticky headers, inline-editable names, and duplicate/delete kebab menus with click-outside dismiss.
- **First-Package-Wins Algorithm:** Each scenario column calculates budget impact by iterating packages in sort order. When multiple packages override the same opportunity, the lowest-sort-order package wins — matching the exact behavior of `apply_ve_scenario()`.
- **Live Budget Metrics:** Every column footer shows a `BudgetMetricsBar` with delta comparison against the project baseline.
- **Apply & Lock:** One-click batch locking via `apply_ve_scenario()` SECURITY DEFINER RPC. The Apply modal resolves human-readable opportunity titles (e.g., "VE-001: Countertop Material") instead of raw UUIDs.

#### Package Bank & Drag-and-Drop
- **Package Bank Panel:** Slide-out right panel with full-text search, scope label badges, net impact values, and scenario-assignment dot indicators showing which scenarios contain each package.
- **@dnd-kit Integration:** Three DnD interactions: Bank→Column (add), within-column reorder (`SortableContext`), and cross-column copy. Discriminated union types (`BankPackageData | ScenarioCellData | ScenarioColumnDropData`) provide type-safe drag data.
- **Duplicate Guards:** Both click-to-add and drag-to-add paths check for existing assignments and show toast feedback.

#### Package Scopes
- **Scope Manager Modal:** Admin CRUD for organizational labels stored in `project_settings.package_scopes` (JSONB). Uses `crypto.randomUUID()` for new scope IDs.
- **`scope_id` Column:** New optional UUID column on `ve_packages` referencing a scope in the JSONB array.

#### Quality & Enterprise Hardening
- **Type Safety:** Eliminated all `as any` casts (except codebase-wide Supabase `Json | null` debt). Replaced 8 raw DnD casts with a discriminated union. Used `OpportunityOption` shared type throughout.
- **Runtime Bug Fix:** Corrected `opt.option_label` → `opt.title` in expanded package cells — the `option_label` field never existed on the `opportunity_options` schema.
- **Dark Mode:** Added `dark:` variants to 4 buttons that were invisible in dark themes.
- **Accessibility:** 13 ARIA attributes across 3 components (drag handles, kebab menus, expand toggles, search inputs).
- **Performance:** Pre-built `Map` lookups for O(1) child cell rendering. `useCallback`-wrapped handlers. Stable `EMPTY_DOTS` constant for referential equality.
- **Dead Code:** Deleted unused `PackageBuilderDrawer.tsx`.

#### Database Schema

| Table | Purpose |
|-------|---------|
| `ve_scenarios` | Named scenario records per project. Soft-delete, audit-logged, RLS via `has_project_permission()`. |
| `ve_scenario_packages` | Junction table: `UNIQUE(scenario_id, package_id)`, cascading deletes, `sort_order` for priority. |
| `ve_packages.scope_id` | New `uuid` column for package scope assignment. |

#### Internal / Architecture

| Item | Detail |
|------|--------|
| `useScenarioQueries.ts` | `src/hooks/` — 9 TanStack hooks: `useVeScenarios`, `useCreateScenario`, `useUpdateScenario`, `useDeleteScenario`, `useAddScenarioPackage`, `useRemoveScenarioPackage`, `useReorderScenarioPackages`, `useDuplicateScenario`, `useApplyScenario` |
| `src/types/scenario.ts` | Domain types: `VeScenario`, `VeScenarioPackage`, `VeScenarioWithPackages` |
| `src/components/scenario/` | 5 components: `ScenarioColumn`, `ScenarioPackageCell`, `PackageBankPanel`, `ApplyScenarioModal`, `ScopeManagerModal` |
| `src/components/views/ScenarioPlannerView.tsx` | Top-level view with DnD context, bank panel, and discriminated union type system |
| `src/utils/financialMath.ts` | Added `calculateScenarioBudgetMetrics()` for per-scenario budget projection |
| Migration | `supabase_migrations/20260526_ve_scenarios.sql` — Full schema, RPCs, RLS, triggers, and indexes |

---

### v0.19.1 — Gold Standard Ghost Rows & Inline Creation Upgrade
**Released:** 2026-05-26 (Patch)

This patch release audits and upgrades all Ghost Row (inline-creation) components inside the Design Pulse application to a unified enterprise-grade "Gold Standard" specification, ensuring 100% data safety, reactive pending feedbacks, resilient key-bindings, and smooth scroll selection focus.

#### Gold Standard Ghost Row Architecture
- **Floating Input Controls Pattern:** Integrated a relative flex container for table-level inputs lacking an options column (Key Dates, Deliverables, Permits). Placed the Save (`Plus`) and Discard (`X`) buttons inside the input's bounding box absolutely positioned to preserve perfect layout alignment.
- **Transaction-Safe Draft Preservation:** Rewrote Permit Review Comments to only clear and collapse input fields inside the mutation's `onSuccess` callback. Surfaced errors via toast notifications while keeping user typed drafts intact inside the active text input to block data-loss on connection or permission errors.
- **Batched Escape-Blur Race Condition Sentinel:** Implemented a `ref`-based boolean cancellation sentinel (`isCancelledRef`) in Permit Comments to successfully bypass React state-flushing delays and prevent Escape keys from triggering accidental blur-saves.
- **Filter Viewport Safety:** Passed computed active building areas and cost code filters to the Value Matrix Opportunity Ghost Row as `defaultValues` to guarantee newly logged items match the active grid viewport and do not disappear upon Supabase refetches.
- **Double-Submission State Locks:** Programmatically disabled inputs and buttons during active database writes (`createMutation.isPending`) to block rapid double-saving.
- **Dynamic Visual Feedbacks:** Shifted placeholders dynamically to `"Saving new item..."` and cursors to `cursor-wait` during pending mutations. Swapped static action icons with an active, sky-blue spinning `Loader2` icon.
- **Silent Viewport Scroll Alignment:** Implemented post-add auto-scrolling select triggers in the Value Matrix grid to instantly center and flash-highlight newly created rows silently, without forcing the split-view panel open.
- **Placeholder & Cell Standardization:** Standardized all Ghost Row metadata cells and placeholders across all five tables (Opportunities, Coordination, Deliverables, Key Dates, Permits) to render a single, uniform hyphen `"-"` in non-editable display cells (e.g. `display_id` and task type `record_type`) and unified text inputs to use a standard `"+ Add Item..."` idle placeholder.

---

### v0.19 — Monolithic Page Extraction & Workspace View Modularization
**Released:** 2026-05-22

This release refactors the monolithic, 957-line project-level view manager at `designpulse-next/src/app/project/[projectId]/page.tsx` into clean, decoupled, single-responsibility, client-side workspace components. This architectural upgrade pushes query hooks, filter pipelines, and dynamic UI concerns down into modular views, optimizing render performance and eliminating sidebar navigation latency.

#### View Modularization & Decoupled State
- **Value Matrix View:** Houses `useOpportunities` and cost code/settings query hooks, local grid filters, and mounts `CompareModal` directly. Sets project preferences and triggers settings tabs directly via Zustand.
- **Budget Ledger View:** Integrates local ledger filter states, variance thresholds, and handles custom CSI spec division character-stripping and numeric padding normalization.
- **Drawings View [NEW]:** Governs drawing sets metadata, sheets indices, Konva markup zone coordinate mappings, and encapsulates `PdfImportModal` locally. Preserves zoom/pan drawing viewport states across tab transitions.
- **Permits View [NEW]:** Encapsulates permits query caching, permit creation mutations, and hosts permit board/table switches. Cleaned up `useMemo` hooks to inline fallback settings, eliminating react-hooks/exhaustive-deps warnings.
- **Coordination View:** Decouples discipline filters, active building area and cost code matrices, and mounts `BulkImportModal` internally.

#### Lean Parent Orchestration Shell
- **Dynamic Routing Container:** Refactored the core `page.tsx` wrapper down to a highly readable, ~140-line dynamic shell.
- **WebSocket Realtime Persistence:** Retains the `useProjectRealtime(projectId)` Supabase subscription active at the parent layout layer to guarantee seamless WebSocket cache invalidation across all view changes.
- **100% Type-Safe & Lint-Clean:** Fully compliant with Next.js Turbopack compiler. Compiled cleanly in production builds and passed typechecking with zero warnings or errors.

---

### v0.18 — Off-Thread Excel Processing & Web Worker Pipeline
**Released:** 2026-05-21

This release implements multi-threaded browser Excel parsing across all platform ingestion pipelines, offloading massive computation off the main React rendering thread onto a dedicated Web Worker to maintain a responsive 60 FPS UI experience.

#### Off-Thread Ingestion Engine
- **Centralized Web Worker Framework:** Spawns an off-thread dynamic Web Worker utilizing Next.js native module worker compilation (`new Worker(new URL(..., import.meta.url), { type: 'module' })`), ensuring dynamic lazy imports and eliminating render blocks during heavy imports.
- **Transferable Zero-Copy Memory:** Transfers file `ArrayBuffer` instantly between threads via Transferable Objects, completely bypassing standard structured clone serialization overhead.
- **Isolated Domain Parsers:** Extracted inline parsing logic from UI tabs (`CsiMappingTab.tsx`, `GlobalSettingsModal.tsx`) into independent, strictly typed domain helper libraries (`csiSpecParser.ts`, `companyDefaultsParser.ts`) to comply with modular component separation guardrails.
- **Emergency Resilient Fallback:** Implemented a robust `FORCE_MAIN_THREAD` developer switch in the client wrapper (`excelWorkerClient.ts`) to instantly bypass Web Workers and run parser modules synchronously on the main thread for testing or older compatibility.

#### Multi-Pipeline Integration
- **Unified Worker Client Interface:** Standardized all platform Excel uploads under a single promise-based client interface (`runExcelWorker`) that orchestrates worker creation, message payload passing, and immediate worker termination to maximize system memory recovery.
- **Ingestion Pipelines Upgraded:** Migrated 100% of Excel ingestion routes including CSI Specs, Procore Budgets, Cost Codes, Company Defaults, and Coordination board tasks.

---

### v0.17.1 — Sizing Locks, Zero-Baselines & Timeline Budget Deltas
**Released:** 2026-05-21 (Patch)

This patch resolves critical visual layout regressions in the forensic version comparison grid and elevates the slide-out details panel with chronological version budget tracking and step-wise transitions.

#### Layout Sizing Security
- **Dynamic Pinned Widths:** Pinned the overall width of spanned columns (`colSpan`) in CSI Division Group Rows by dynamically summing active column sizes (`style={{ width: pinnedColWidth }}`), locking horizontal scroll bounds and resolving the column collapsing bug.
- **Strict Size Locks:** Enforced explicit pixel widths on dynamic version cells, step deltas, placeholders, and virtualized spacers to prevent cells from squeezing under split drawer screens.

#### Color Heatmapping Enhancements
- **Vibrant Opacity Shading:** Upgraded light-mode and dark-mode Tailwind colors (`bg-rose-200/70`, `bg-emerald-200/70`, etc.) to provide high-contrast, premium, and easily readable heatmaps.
- **Zero-Baseline Additions:** Rewrote the percentage change calculation to handle zero-baseline items (`baseline === $0`). Introductions of new scope now render beautifully at `+100.0%` (or `-100.0%`) with correct shading.

#### Opportunity Slide-Out Timeline
- **Chronological Delta Timeline:** Added a project-scoped, tenant-isolated TanStack query fetching absolute cost code line totals from `project_estimates` across all project versions.
- **Comparative State Pills:** Enhanced the slide-out history timeline with absolute budget pills (e.g., `$150,000`) and color-coded comparative step delta badges (`BASELINE`, `NO CHANGE`, or red/green percentage changes).
- **Clipboard Rich Text Exporter:** Upgraded the "Copy All" timeline utility to format and copy detailed budget sheet chronologies with exact dollar transitions.

---

### v0.17 — Multi-Version Variance Deltas & Forensic Audit Mode
**Released:** 2026-05-21

This release implements deep forensic auditing inside the Multi-Version Comparison Matrix, allowing pre-construction teams to track granular estimate changes between versions and audit cumulative delta deviations.

#### Variance Delta (Δ) & Forensic Auditing

**Cumulative Variance Delta Column**
- _Total Δ Pinned Column:_ A left-pinned summary column (`Total Δ`) comparing the latest selected active version against the earliest selected baseline version.
- _Dual-Line Metrics:_ Each delta cell displays the absolute cost change on the first line and the percentage shift on the second line.
- _HSL Background Heatmaps:_ Cells are dynamically tinted using HSL gradients (soft rose-50/40 or rose-950/20 for cost increases, soft emerald-50/40 or emerald-950/20 for cost reductions), preserving the clean grid design with high-contrast text.
- _Safe Zero-Division Fallbacks:_ Graceful handling of edge cases, showing `+100.0%` for items newly introduced in later versions and `—` if baseline and active are both zero.

**Step-by-Step Forensic Audit Mode**
- _Interactive Toolbar Toggle:_ A new "Audit Deltas (Δ)" button (using the shared `<Button>` primitive in `'primary'` variant) is shown in the toolbar whenever three or more versions are selected.
- _Consecutive Release Deltas:_ When enabled, it dynamically interleaves step-by-step delta columns between each consecutive selected version in the matrix. Pre-construction teams can inspect exactly when and why a budget line shifted between mid-design releases.

**Precision Layout Safety & Performance**
- _TanStack Pinning Safety:_ Adjusted the sticky group row (CSI division summary header) to dynamically adapt its `colSpan` (from `3` to `4`) and column slice bounds (from `.slice(3)` to `.slice(4)`) to match the pinned `Total Δ` column layout. This prevents horizontal cell shifts and layout breaks.
- _Pure Client-Side Computation:_ Built entirely on the client utilizing the pivoted multi-version dataset from the existing Supabase RPC, requiring zero database migrations, RLS adjustments, or API extensions.
- _Memoization & Compiler Clean:_ Resolved React.memo boundary checks to prevent unnecessary grid re-renders. The whole codebase compiles clean with no warnings or type errors.

---

### v0.16 — Unified Grid Architecture & Table Standardization
**Released:** 2026-05-20

This release completes the grid unification effort — deprecating the legacy V1 `OpportunityGrid.tsx` and consolidating all Value Engineering views onto the single `OpportunityGridV2` component. It also formalizes the standardized data table component system that all grids now share.

#### Grid Unification

**V1 Deprecation**
The legacy `OpportunityGrid.tsx` (579 lines) and its companion `columns.tsx` (176 lines) have been fully deprecated and deleted. `OpportunityGridV2.tsx` now serves as the **single, unified grid** for both the Value Matrix (`isLedgerView=false`) and Budget Ledger (`isLedgerView=true`), controlled via a prop toggle:
- _Value Matrix Mode:_ Flat table with no grouping, no default sorting, inline cell editing via `EditableCell` components, and a "Matrix View" toolbar label. Budget metric pills are hidden.
- _Budget Ledger Mode:_ Grouped by division/cost code, sorted by division → cost code, read-only financial cells via `ReadOnlyCell` components, and a "Budget Ledger" toolbar label with Budget Total / VE Impact / Exposure metric pills.
- _`activeStatus` Prop:_ Enables automatic column visibility toggling — when filtering to "Approved" items, the `estimate_sync_status` column auto-shows to surface reconciliation status.

**Consumer Migration**
- `ValueMatrixView.tsx` — swapped from V1 `OpportunityGrid` to V2 `OpportunityGridV2` with `activeStatus` prop pass-through.
- `MyDeskDashboard.tsx` — swapped from V1 `OpportunityGrid` to V2 `OpportunityGridV2`.

#### Store Cleanup

**Dead State Removal (Zustand v10)**
Seven orphaned Zustand fields were removed from `useUIStore.ts` with a v9→v10 migration that cleans up persisted localStorage data:
- `compareQueue`, `toggleCompareItem`, `setCompareQueue`, `clearCompareQueue` — replaced by TanStack-native `rowSelection`.
- `gridColumnVisibility`, `setGridColumnVisibility` — V1-only column visibility; V2 uses `gridV2ColumnVisibility`.
- `gridColumnOrder`, `setGridColumnOrder` — V1-only column ordering.
- `PermitFilters.assignee` — dead field with zero consumers.

#### Dead File Cleanup

| File | Reason |
|------|--------|
| `OpportunityGrid.tsx` | Superseded by `OpportunityGridV2.tsx` |
| `columns.tsx` | V1 column definitions; V2 uses `columns-v2.tsx` |
| `CoordinationGhostRow.tsx` | Replaced by shared `GhostRow<T>` in v0.15 |
| `PermitGhostRow.tsx` | Replaced by shared `GhostRow<T>` in v0.15 |

#### Standardized Table Component System

All data grids across the application now share a unified component layer in `src/components/data-table/`:

| Component | Purpose |
|---|---|
| `DataTable<T>` | Full grid wrapper with scroll container, virtualization, header, and rows |
| `TableHeader<T>` | `<thead>` with sort indicators, resize handles, and pinned column styles |
| `MemoizedRow<T>` | `React.memo` row with structural hash comparison |
| `GhostRow<T>` | Configurable "quick add" row via `placeholder`, `defaultValues`, `staticFields` |
| `TableToolbar` | Search, column chooser, filter button with active count badge |
| `BulkActionBar` | Selection count, delete, clear, and `extraActions` slot |
| `DeleteConfirmModal` | Confirmation dialog with configurable entity name |
| `CheckboxCell` / `CheckboxHeader` | TanStack-native row selection primitives |
| `TextCell`, `SelectCell`, `DateCell` | Generic editable cells with blur-save semantics |

**Tables Using This System:**
- Value Matrix / Budget Ledger (`OpportunityGridV2.tsx`)
- Coordination Board (`CoordinationTable.tsx`)
- Permit Board (`PermitTable.tsx`)
- Lessons Learned (`LessonsTable.tsx`)
- Brand Standards (`BrandStandardsGrid.tsx`)

#### Internal / Architecture

| Item | Detail |
|------|--------|
| `columns-v2.tsx` | Shared cells now import from `EditableCell.tsx` (VM mode) and `ReadOnlyCell.tsx` (ledger mode) |
| `data-table-architecture/skill.md` | Updated guardrails: compareQueue deprecated, V2 is unified grid |
| `frontend-architecture/skill.md` | Updated: V1 references removed, unified grid documented, Compare Tray updated |
| `EMPTY_VISIBILITY` | Default visibility now includes `estimate_sync_status: false` |
| `handleColumnReset` | Reset handler now includes `estimate_sync_status: false` in defaults |

---

### v0.15 — VE Estimate Incorporation Pipeline
**Released:** 2026-05-19

This release introduces the complete workflow for trueing-up Value Engineering decisions against formal estimate updates, closing the loop between the Estimating inbox and the unified Budget Ledger.

#### New Features

**Reconciliation Workflow**
- _Estimate Sync Status:_ A new tracking metric on the Value Matrix (`Draft`, `Pending Estimate Update`, `Incorporated`) automatically tracks where locked VE options stand relative to the baseline estimate.
- _Reconciliation Modal:_ Project Estimators can reconcile locked variance against updated external estimate files via the new Reconcile modal natively embedded in the `ExpandedCard` detail panel.
- _Dashboard Integration:_ A new "To Incorporate" KPI widget appears directly on the project dashboards summarizing total unresolved locked variance.

**Estimator Inbox & Ledger Tracking**
- _RBAC Enforcement:_ The workflow is gated by the `can_manage_budget` role, protecting financial baselines.
- _Budget Ledger Visibility:_ A "Show Incorporated" toggle lets estimators view historically incorporated VE items seamlessly interleaved within the live estimate grid, styled with a persistent emerald border to prevent data obfuscation.

**Robust Data Auditing**
- _Database Triggers:_ The PostgreSQL `trg_log_opportunity_changes` trigger natively captures all changes to variance tracking and outputs them into the `ActivityFeed` for deep forensic compliance.

---

### v0.14 — Client Profile Hub & Global Brand Standards
**Released:** 2026-05-15

This release introduces a centralized **Client Hub** to manage client profiles, global brand standards, and document lifecycles, establishing the architectural foundation for cross-project brand compliance and lessons learned.

#### New Features

**Tabbed Client Hub Interface**
The Client detail page has been completely rewritten into a state-management shell following the Master-Detail pattern:
- _Profile Tab:_ Editable client identity and contact information with floating save/discard state bar.
- _Brand Standards Tab:_ Full CRUD TanStack Table for managing client-specific design requirements, complete with inline editing, category filter pills, and a Smart Cost Code combobox.
- _Enterprise Table Mechanics:_ The Brand Standards grid features click-to-sort headers, draggable column resizing, and a drag-and-drop settings panel to toggle/reorder columns, all backed by client-scoped Zustand persistence.
- _Documents Tab:_ Secure file management with a drag-and-drop upload zone, type-specific file icons, and standard-based filtering. Uses signed URLs for secure downloads.
- _Projects Tab:_ Read-only aggregation view showing all projects linked to the client, summarizing total budget, locked variance, and potential exposure.
- _Lessons Learned Tab:_ Architectural runway for tracking cross-project insights.

**Atomic Storage & Document Architecture**
A robust, atomic pipeline was implemented for handling client document uploads:
- _`client_documents` Storage Bucket:_ Private bucket protected by RLS path-token policies (`<client_id>/<document_id>/<filename>`).
- _Atomic RPC Insertion:_ Upload metadata is handled via a `SECURITY DEFINER` RPC (`create_client_document`) that validates client ownership before creating the database record, preventing orphaned storage objects.
- _Client-Minted UUIDs:_ Frontend mints the `document_id` via `crypto.randomUUID()` to orchestrate the storage-then-database flow securely.

**Data Layer Expansion**
The `useClientQueries.ts` module was expanded from 4 to 14 discrete hooks to support the new features, strictly adhering to MVCC tie-breaking (`.order('id')`) and optimistic mutation patterns.

#### Database Schema

| Table | Purpose |
|-------|---------|
| `client_brand_standards` | Added `category` column (text) to group design requirements. |
| `client_documents` | New table tracking file metadata, storage paths, and linked brand standards with RLS. |

---

### v0.13 — Company CSI Default Library & Project Specification Management
**Released:** 2026-05-15

This release introduces a complete organizational CSI specification management system — from company-wide default libraries to project-level viewing and editing — closing the loop on CSI-to-cost-code mapping across the entire platform.

#### New Features

**Company CSI Default Library (Global Settings)**
Platform admins can now manage a centralized company-wide CSI-to-cost-code mapping library — the organizational "Rosetta Stone" that standardizes how specifications translate to financial cost codes:
- _3-way segmented control:_ The CSI Mapping tab in Global Settings now features three sub-views: **ML Flywheel** (cross-project learning), **Company Defaults** (admin-managed library), and **Rosetta Stone** (cross-project override aggregation).
- _Excel upload/download:_ Admins can bulk-upload CSI defaults via a structured `.xlsx` template with validated cost code dropdowns. The **Download Template** button pre-populates the spreadsheet with all existing defaults for easy auditing and re-import.
- _Search & delete:_ Inline search filtering and row-level deletion for managing the library incrementally.
- _Mutation:_ `bulk_upsert_company_csi_defaults` RPC — SECURITY DEFINER, platform-admin-gated, set-based `jsonb_array_elements` insert with `ON CONFLICT (csi_number) DO UPDATE`.

**One-Click Project Seeding**
When a project's CSI & Specs tab is empty and company defaults exist, a prominent "Seed from N Company Defaults" button appears in the upload zone:
- _Atomic copy:_ `seed_project_from_company_defaults` RPC copies all defaults into `project_csi_specs` with `source = 'company_default'`, using `ON CONFLICT DO NOTHING` to preserve existing project-specific overrides.
- _Lineage tracking:_ Every seeded spec carries `source = 'company_default'`. Editing any field automatically transitions it to `source = 'project'`.

**Project CSI Specs Viewer/Editor**
After seeding or uploading specs, the CSI & Specs tab now displays a full interactive table instead of reverting to the empty upload zone:
- _Source badges:_ Each row displays a color-coded pill — 🏢 Default (indigo), 📌 Project (emerald), 🤖 ML (amber) — providing instant lineage visibility.
- _Inline cost code editing:_ Editable `<select>` dropdown with `formatCostCode()` display, gated behind `can_edit_records` permission. Changes fire `onChange` (AGENTS.md C23 — atomic dropdown mutations).
- _Row deletion:_ Trash icon gated behind `can_delete_records` permission (project admins only).
- _Search bar:_ Instant filtering by CSI number, description, or cost code.
- _Header stats:_ "{X} specs · {Y} company defaults · {Z} project-specific".
- _Upload More:_ Toggle back to the upload zone for incremental spec additions without losing existing data.

**Rosetta Stone Cross-Project View**
A read-only aggregation view in Global Settings showing company defaults alongside project-specific overrides as green pills per cost code:
- _Powered by:_ `get_company_csi_rosetta_view` RPC which filters to `source = 'project'` overrides only.
- _Purpose:_ Audit trail showing exactly which projects deviated from company standards and how.

**ML Flywheel Training Guards**
The `trg_update_global_csi_training_data` trigger on `project_csi_specs` now explicitly skips records with `source = 'company_default'`:
- _Rationale:_ Prevents seeded data from inflating ML confidence scores — only genuine user decisions (source = `'project'`) feed the training model.

#### Database Schema

| Table | Purpose |
|-------|---------|
| `company_csi_defaults` | Global company-wide CSI-to-cost-code default mappings. `UNIQUE(csi_number)`, loose-text FK to `cost_codes.code` (`ON DELETE SET NULL`). RLS: `SELECT` open to all authenticated; write restricted to platform admins. |
| `project_csi_specs.source` | New column (`'company_default' \| 'project' \| 'ml_suggested'`) for lineage tracking. |
| `global_csi_training_data` | ML Flywheel training table with `is_default` guard excluding company defaults from training. |

#### Internal / Architecture

| Item | Detail |
|------|--------|
| `companyDefaultsTemplate.ts` | `src/lib/excel/` — ExcelJS template generator with pre-population of existing defaults and validated cost code dropdowns |
| `useCompanyCsiQueries.ts` | `src/hooks/` — TanStack hooks for company defaults CRUD, seeding, and Rosetta Stone queries |
| `useCsiQueries.ts` | `src/hooks/` — Added `useUpdateProjectCsiSpec` and `useDeleteProjectCsiSpec` single-row mutation hooks |
| `ProjectCsiSpecsTable.tsx` | `src/components/project/` — New searchable, permission-gated viewer/editor table |
| `CsiMappingTab.tsx` | `src/components/project/` — 3-way conditional rendering: staging grid / specs table / upload zone |
| `GlobalSettingsModal.tsx` | `src/components/dashboard/` — CSI Mapping sub-view architecture with 3-way segmented control |
| `seed_company_defaults.sql` | `designpulse-next/` — 151-row SQL seed script for initial database population |
| Migration | `supabase_migrations/20260516_company_csi_defaults.sql` — Full schema, RPCs, RLS, and triggers |
| AGENTS.md §4 | New CSI Mapping Sub-View Architecture bullet |
| AGENTS.md §5 | New `company_csi_defaults`, `project_csi_specs`, `global_csi_training_data` schema entries |

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
- A new "Drawings" toggle button is available in the toolbar of the Value Matrix and the Design Coordination Board.
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

