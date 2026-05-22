# DesignPulse — Architecture Document (C4 Model)

> **Last Updated:** 2026-05-22  
> **Status:** Living Document  
> **Application Version:** v0.17.1 (Sizing Locks, Zero-Baselines & Timeline Budget Deltas)  
> **Architecture Model:** [C4 Model](https://c4model.com/) by Simon Brown

---

## Table of Contents

- **C4 Diagrams**
  1. [Level 1 — System Context](#level-1--system-context)
  2. [Level 2 — Container](#level-2--container)
  3. [Level 3 — Component](#level-3--component)
  4. [Level 4 — Code](#level-4--code)
- **Supplementary**
  - [A. Domain Glossary](#appendix-a--domain-glossary)
  - [B. Architectural Patterns](#appendix-b--architectural-patterns)
  - [C. Dependency Inventory](#appendix-c--dependency-inventory)
  - [D. Infrastructure & Deployment](#appendix-d--infrastructure--deployment)
  - [E. Known Gaps & Technical Debt](#appendix-e--known-gaps--technical-debt)

---

# Level 1 — System Context

> *"A System Context diagram is a good starting point for diagramming and documenting a software system, allowing you to step back and see the big picture."*

This diagram shows **DesignPulse** as a single box and its relationships with the people who use it and the external systems it integrates with.

```mermaid
C4Context
    title System Context Diagram — DesignPulse

    Person(gc_admin, "GC Project Admin", "Manages projects, locks decisions, imports budgets, manages team")
    Person(design_team, "Design Team Member", "Creates VE items, coordinates disciplines, manages drawings")
    Person(viewer, "Viewer / Executive", "Reviews dashboards, budget exposure, analytics")

    System(dp, "DesignPulse", "Pre-Construction Decision Engine & Visual VE Tracker. Transforms static spreadsheets into an interactive, spatial, and auditable workflow.")

    System_Ext(procore, "Procore", "Construction management platform. Provides OAuth SSO and project data sync.")
    System_Ext(supabase_platform, "Supabase Platform", "Hosted PostgreSQL, Auth, Realtime, and Object Storage (BaaS).")
    System_Ext(render, "Render.com", "Cloud hosting platform for the Python microservice.")

    Rel(gc_admin, dp, "Evaluates options, locks decisions, imports estimates")
    Rel(design_team, dp, "Creates VE items, uploads drawings, tracks coordination")
    Rel(viewer, dp, "Views dashboards, analytics, budget exposure")
    Rel(dp, procore, "OAuth SSO, project data import", "HTTPS")
    Rel(dp, supabase_platform, "All CRUD, auth, realtime, storage", "HTTPS / WSS")
    Rel(dp, render, "PDF processing, tile generation", "HTTPS")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Actors

| Actor | Role | Key Capabilities |
|-------|------|-------------------|
| **GC Project Admin** | `project_admin` | Full access: lock/unlock decisions, import budgets, manage team, configure settings |
| **GC Admin** | `gc_admin` | Operational: create VE items, lock options, manage coordination, import estimates |
| **Design Team Member** | `design_team` | Collaborative: create items, upload drawings, update coordination checklists |
| **Viewer / Executive** | `viewer` | Read-only: dashboards, budget exposure, analytics, export reports |
| **Platform Admin** | `platform_admin` (super) | Cross-project: system settings, user management, CSI training, global cost codes |

### External Systems

| System | Integration | Protocol |
|--------|-------------|----------|
| **Procore** | OAuth 2.0 SSO + project detail import | HTTPS (REST) |
| **Supabase Platform** | Database, Auth, Realtime subscriptions, Object Storage | HTTPS + WebSocket |
| **Render.com** | Hosts Python/FastAPI microservice (Docker) | HTTPS |

---

# Level 2 — Container

> *"A Container diagram zooms into the software system, showing the high-level technical building blocks (containers) and how they interact."*

A **container** is a separately deployable/runnable unit (e.g., a web app, a microservice, a database).

```mermaid
C4Container
    title Container Diagram — DesignPulse

    Person(user, "Construction Professional", "Any project team member")

    System_Boundary(dp, "DesignPulse") {
        Container(frontend, "Next.js Frontend", "Next.js 16, React 19, TypeScript", "Single-page workspace with 10+ views: VE grid, budget ledger, coordination board, floor plans, analytics, permits, lessons learned")
        Container(backend, "Python Microservice", "FastAPI, PyMuPDF, pyvips", "Handles compute-heavy PDF processing: tile generation, vector extraction, annotated exports, CSI TOC parsing")
        ContainerDb(db, "PostgreSQL Database", "Supabase Hosted", "30+ tables, 25+ RPCs, 15+ triggers, Row Level Security with dynamic RBAC")
        Container(auth, "Auth Service", "Supabase Auth", "JWT-based authentication with email/password and Procore OAuth SSO")
        Container(storage, "Object Storage", "Supabase Storage", "4 buckets: project_drawings, floorplans, client_documents, lesson_attachments")
        Container(realtime, "Realtime Service", "Supabase Realtime", "WebSocket subscriptions for live collaboration on 3 channels")
    }

    System_Ext(procore, "Procore", "Construction management SSO")

    Rel(user, frontend, "Uses", "HTTPS (port 8000)")
    Rel(frontend, db, "Queries and mutates via Supabase JS SDK", "HTTPS (anon key + RLS)")
    Rel(frontend, auth, "Login, session management", "HTTPS")
    Rel(frontend, storage, "Upload/download files", "HTTPS")
    Rel(frontend, realtime, "Live data subscriptions", "WSS")
    Rel(frontend, backend, "PDF processing requests", "/py-api/* proxy")
    Rel(backend, db, "Status updates, sheet metadata", "HTTPS (service_role key)")
    Rel(backend, storage, "Tile uploads, staged PDFs, vectors", "HTTPS (service_role key)")
    Rel(auth, procore, "OAuth 2.0 token exchange", "HTTPS")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Container Inventory

| Container | Technology | Port | Purpose | Deployment |
|-----------|-----------|------|---------|------------|
| **Next.js Frontend** | Next.js 16 (App Router), React 19, TypeScript 6 | 8000 (dev) | Primary UI — 107 components, 23 hooks, 3 stores | Manual (no config detected) |
| **Python Microservice** | FastAPI, Python 3.12, PyMuPDF, pyvips | 8001 (dev) / 10000 (prod) | PDF pipeline: inspect → stage → tile → vector → export | Render.com (Docker) |
| **PostgreSQL Database** | Supabase Hosted PostgreSQL | N/A | 30+ tables, 25+ RPCs, 15+ triggers, dynamic RBAC via RLS | Supabase cloud |
| **Auth Service** | Supabase Auth | N/A | JWT tokens, email/password, Procore OAuth | Supabase cloud |
| **Object Storage** | Supabase Storage | N/A | 4 buckets for drawings, documents, attachments | Supabase cloud |
| **Realtime Service** | Supabase Realtime | N/A | 3 WebSocket channels for live collaboration | Supabase cloud |

### Inter-Container Communication

| From → To | Transport | Auth Mechanism | Purpose |
|-----------|-----------|----------------|---------|
| Frontend → Database | Supabase JS SDK (HTTPS) | `anon` key + RLS policies | All CRUD, RPC calls |
| Frontend → Microservice | `/py-api/*` Next.js proxy | Bearer JWT (Supabase token) | PDF upload, processing, export |
| Frontend → Realtime | WebSocket (WSS) | Supabase session | Live data sync (3 channels) |
| Frontend → Storage | Supabase JS SDK (HTTPS) | `anon` key + RLS | File upload/download |
| Microservice → Database | Supabase SDK (HTTPS) | `service_role` key (bypasses RLS) | Sheet status updates |
| Microservice → Storage | Supabase SDK (HTTPS) | `service_role` key (bypasses RLS) | Tile pyramid upload, staged PDFs |
| Auth → Procore | OAuth 2.0 (HTTPS) | Client ID/Secret | SSO token exchange |

---

# Level 3 — Component

> *"A Component diagram zooms into an individual container to show the components inside it and their relationships."*

## 3.1 — Next.js Frontend Components

```mermaid
C4Component
    title Component Diagram — Next.js Frontend

    Container_Boundary(fe, "Next.js Frontend") {
        Component(router, "App Router", "Next.js 16 App Router", "6 page routes + 3 API routes. Root layout is the only server component; all pages are client-rendered.")
        Component(views, "View System", "React 19", "10 workspace views switched via Zustand state: VE Matrix, Budget Ledger, Coordination, Map, Analytics, Permits, Lessons, My Desk, Settings, Budget Compare")
        Component(components, "Component Library", "107 TSX files across 15 directories", "Feature components: opportunities (16), coordination (7), canvas (10), drawings (8), permits (7), analytics (11), dashboard (8), project (7), clients (5), lessons (3)")
        Component(data_table, "Shared Data Table", "@tanstack/react-table + custom", "Composable grid system: DataTable, TableHeader, MemoizedRow, GhostRow, BulkActionBar, 8 cell types")
        Component(hooks, "React Query Hooks", "@tanstack/react-query v5", "23 hook files wrapping Supabase calls. Full optimistic update + rollback pattern on all mutations.")
        Component(stores, "Zustand Stores", "Zustand v5", "useUIStore (localStorage, v10 migration chain), useMapStore (sessionStorage), useBulkImportStore (ephemeral)")
        Component(providers, "Context Providers", "React Context", "AuthProvider (client-side guard), QueryProvider (staleTime: 5m, gcTime: 24h), ThemeProvider (dark/light)")
        Component(api_service, "API Service Layer", "Typed fetch wrapper", "Proxied calls to FastAPI via /py-api/*. Bearer JWT auth.")
        Component(sb_client, "Supabase Client", "@supabase/supabase-js", "Singleton client instance (anon key). Direct table queries, RPCs, storage, realtime.")
        Component(canvas, "Spatial Engine", "react-konva + rbush", "Floor plan canvas with tile rendering, zone drawing, snapping (Web Worker), and bidirectional grid sync")
    }

    Rel(router, views, "Renders active view")
    Rel(views, components, "Composes feature components")
    Rel(components, data_table, "Uses shared grid system")
    Rel(components, hooks, "Fetches/mutates data")
    Rel(components, stores, "Reads/writes UI state")
    Rel(hooks, sb_client, "Executes queries and RPCs")
    Rel(api_service, sb_client, "Gets auth token for Bearer header")
    Rel(canvas, stores, "Bidirectional sync with useMapStore + useUIStore")
    Rel(providers, sb_client, "Auth session management")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Page Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Redirect | → `/dashboard` (via `next.config.mjs`) |
| `/login` | Client | Email/password + Procore OAuth login |
| `/dashboard` | Client | Projects + Clients dual-tab dashboard |
| `/project/[projectId]` | Client | **Main workspace** (143 lines) — dynamic view orchestrator switching between 10 isolated views via `useUIStore.activeView` |
| `/project/[projectId]/item/[itemId]` | Client | Pop-out item detail view |
| `/clients/[id]` | Client | Client detail with tabs (Profile, Brand Standards, Documents, Projects, Lessons) |
| `/sandbox/map` | Client | Map development sandbox |
| `/auth/success` | Client | Procore OAuth popup success handler |
| `/api/auth/procore/callback` | API Route | Procore OAuth callback (exchanges code for token) |
| `/api/auth/procore/launch` | API Route | Initiates Procore OAuth flow |
| `/api/procore/project-details` | API Route | Proxies Procore project data |

### View System (within `/project/[projectId]`)

| View Key | Feature | Primary Component | Size |
|----------|---------|-------------------|------|
| `dashboard` | Value Matrix | `OpportunityGridV2` | 57 KB |
| `dashboard-v2` | Budget Ledger | `OpportunityGridV2` (shared, merged mode) | 57 KB |
| `coordination` | Coordination Board | `CoordinationTable` | 30 KB |
| `map` | Floor Plans | `FloorplanCanvas` + `DrawingGrid` | 37 KB + 28 KB |
| `analytics` | Analytics | `AnalyticsDashboard` + role-specific dashboards | — |
| `permits` | Permit Tracker | `PermitTable` | 36 KB |
| `lessons` | Lessons Learned | `LessonsLearnedView` | — |
| `my-desk` | Personal Dashboard | `MyDeskDashboard` | — |
| `settings` | Project Settings | `ProjectSettings` | 71 KB |
| `budget-compare` | Budget Comparison | `VersionComparisonViewer` | 23 KB |

### Zustand Stores

| Store | File | Persistence | Key Responsibilities |
|-------|------|-------------|----------------------|
| `useUIStore` | `src/stores/useUIStore.ts` (482 lines) | `localStorage` (`design-pulse-ui-prefs`, v10 with migration chain v0→v10) | Active view per project, selected row, grid modes, column visibility/order/pinning per project, panel collapse states, card ordering, filter prefs |
| `useMapStore` | `src/stores/useMapStore.ts` (118 lines) | `sessionStorage` (`designpulse-map-session`, v2) | Tool mode (8 modes), selected zones, active sheet, open sheet tabs, pending polygon, editing zone |
| `useBulkImportStore` | Inline in `BulkImportModal.tsx` | None (ephemeral) | Staged Excel import rows for coordination task bulk import |

**Bidirectional Sync:** `useUIStore.setSelectedOpportunityId` ↔ `useMapStore.setSelectedZoneIds` — selecting a grid row highlights the map zone, and selecting a zone highlights the grid row.

### React Query Hook Layer

| Hook File | Domain | Queries | Mutations |
|-----------|--------|---------|-----------|
| `useOpportunityQueries.ts` (920 lines) | VE Decision Engine | `useOpportunities`, `useOpportunity`, `useAllProjectOptions`, `usePendingEstimateUpdates` | `useCreateOpportunity`, `useUpdateOpportunity`, `useDeleteOpportunity`, `useLockOption`, `useUnlockOpportunityOption`, `useToggleOptionBudget`, `useCreateOption`, `useUpdateOption`, `useDeleteOption`, `useReorderOptions`, `useReconcileOpportunity`, `useReturnOpportunity`, `useDeEscalateOpportunity`, `useUpdateCoordinationDetails`, `useUpdateOptionRequirements`, `useBulkImportCoordinationTasks` |
| `useEstimateQueries.ts` | Budget Engine | `useEstimateVersions`, `useEstimateLines`, `useBudgetWaterfall`, `useEstimateComparison`, `useMasterLedgerGrid`, `useMultiVersionMatrix`, `useBudgetVersionTimeline`, `useVarianceNotes`, `useVarianceNotesForGrid` | `useUploadEstimate`, `useActivateEstimateVersion`, `useDeleteEstimateVersion`, `useUpdateEstimateAssumptions` |
| `useMapQueries.ts` | Floor Plans | `useProjectSheets`, `useSheetMarkups` | `useUpsertSheetMarkups` + sheet CRUD |
| `useProjectCoreQueries.ts` | Projects & Settings | `useProjects`, `useProjectSettings`, `useProjectMembers` | `useCreateProject`, `useUpdateProjectCore`, `useDeleteProjectCore`, `useUpdateProjectSettings`, `useAddProjectMember`, `useUpdateProjectMemberRole`, `useRemoveProjectMember` |
| `useClientQueries.ts` | Clients | `useClients`, `useClient`, `useClientProjectsMetrics`, `useClientBrandStandards`, `useClientDocuments` | `useCreateClient`, `useUpdateClient`, `useDeleteClient`, `useCreateBrandStandard`, `useUpdateBrandStandard`, `useDeleteBrandStandard`, `useUploadClientDocument`, `useDeleteClientDocument` |
| `useGlobalQueries.ts` | Admin/Global | `useSystemUsers`, `useRolePermissions`, `useCsiTrainingSuggestions` | `useBulkUpdateUserProjects`, `useToggleCsiVerified`, `useRemapGlobalCsiEntry`, `useCreateCostCode`, `useDeleteCostCode` |
| `usePermitQueries.ts` | Permits | `usePermits`, `usePermitComments`, `usePermitTaskLinks` | Permit CRUD mutations |
| `useLessonQueries.ts` | Lessons Learned | `useLessons`, `useLessonIndicators` | Lesson CRUD + attachment mutations |
| `useDrawingSetQueries.ts` | Drawing Sets | `useDrawingSets` | `useCreateDrawingSet`, `useActivateDrawingSet` |
| `useCsiQueries.ts` | Project CSI Specs | `useProjectCsiSpecs` | CSI spec mutations |
| `useCompanyCsiQueries.ts` | Company CSI | `useCompanyCsiDefaults`, `useCompanyCsiRosettaView` | `useBulkUpsertCompanyCsiDefaults`, `useSeedProjectFromCompanyDefaults` |
| `useItemActivity.ts` | Activity Feed | `useActivityFeed` (infinite query with pagination) | `useAddComment`, `useUpdateComment`, `useDeleteComment` |
| `useProjectAnalyticsQueries.ts` | Analytics | `useTradeVariances`, `useGcBottleneckMetrics`, `useOwnerRoiMetrics`, `useDesignCompletionMetrics` | — |
| `usePlatformAdmin.ts` | Platform Admin | `useIsPlatformAdmin` | — |
| `useUpsertVarianceNote.ts` | Variance Notes | — | `useUpsertVarianceNote` |

---

## 3.2 — Python Microservice Components

```mermaid
C4Component
    title Component Diagram — Python/FastAPI Microservice

    Container_Boundary(be, "Python Microservice") {
        Component(main_router, "Main Router", "FastAPI (main.py)", "Legacy endpoints: /upload-floorplan, /extract-csi-toc, /extract-vectors, /export-pdf. Health check at /.")
        Component(drawings_router, "Drawings Router", "FastAPI (routers/drawings.py)", "UOPM pipeline: inspect-and-stage-pdf, process-sheet, attach-original, preview, extract")
        Component(auth_svc, "Auth Service", "services/auth.py", "Validates Supabase JWT tokens via get_user(). Returns {sub, role}. All endpoints require Depends(get_current_user).")
        Component(inspector, "PDF Inspector", "services/pdf_inspector.py", "Fast PDF validation, JPEG thumbnailing (150px), staging to Supabase Storage, title block text extraction with derotation")
        Component(tiler, "Tile Processor", "services/tile_processor.py", "Renders PDF at 3x zoom via PyMuPDF, creates DeepZoom tile pyramid via pyvips, parallel uploads (50 workers + tenacity retry)")
        Component(vectors, "Vector Extractor", "services/vector_extractor.py", "Extracts line segments + rectangles from PDF. Normalizes to percentage coordinates. Max 50,000 vectors per sheet.")
        Component(pdf_map, "PDF Map Service", "services/PDFMapService.py", "Generates annotated PDF exports with markup overlays and legend")
        Component(worker, "Background Worker", "services/worker.py", "Concurrent tile + vector jobs via asyncio.gather(). Thread-local Supabase clients. Semaphore-limited (3 concurrent).")
    }

    Rel(drawings_router, inspector, "Step 1: Inspect & Stage")
    Rel(drawings_router, worker, "Step 2: Dispatch processing")
    Rel(worker, tiler, "Tile generation")
    Rel(worker, vectors, "Vector extraction")
    Rel(main_router, pdf_map, "PDF export")
    Rel(main_router, vectors, "Vector extraction (legacy)")
    Rel(main_router, inspector, "CSI TOC extraction")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

### UOPM Pipeline (Upload Once, Process Many)

```mermaid
flowchart LR
    A["1. inspect-and-stage-pdf\n(Validate, thumbnail,\nstage to Storage)"] --> B["2. process-sheet/{id}\n(Dispatch background job\n→ 202 Accepted)"]
    B --> C["3a. Tile Generation\n(PyMuPDF → pyvips\n→ DeepZoom pyramid)"]
    B --> D["3b. Vector Extraction\n(Line segments → \npercentage coords)"]
    C --> E["Supabase Storage\n{proj}/{sheet}/tiles/{z}/{col}_{row}.webp"]
    D --> F["Supabase Storage\n{proj}/{sheet}/vectors.json"]

    style A fill:#92400e,color:#fef3c7,stroke:none
    style B fill:#92400e,color:#fef3c7,stroke:none
    style C fill:#78350f,color:#fde68a,stroke:none
    style D fill:#78350f,color:#fde68a,stroke:none
    style E fill:#064e3b,color:#a7f3d0,stroke:none
    style F fill:#064e3b,color:#a7f3d0,stroke:none
```

### API Endpoints

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/` | `main.py` | Health check |
| POST | `/upload-floorplan/{sheet_id}` | `main.py` | Legacy: PDF page → PNG conversion |
| POST | `/extract-csi-toc` | `main.py` | Rosetta Stone: extract CSI codes from PDF TOC |
| POST | `/extract-vectors/{sheet_id}` | `main.py` | Extract snapping vectors from PDF |
| POST | `/export-pdf/{sheet_id}` | `main.py` | Annotated PDF export with markups + legend |
| POST | `/drawings/inspect-and-stage-pdf` | `drawings.py` | UOPM Step 1: validate, thumbnail, stage |
| POST | `/drawings/process-sheet/{sheet_id}` | `drawings.py` | UOPM Step 2: dispatch background job (202 Accepted) |
| POST | `/drawings/attach-original/{sheet_id}` | `drawings.py` | Attach source PDF for export/vectors |
| GET | `/drawings/preview/{proj}/{key}/{page}` | `drawings.py` | High-res JPEG preview (2000px) |
| POST | `/drawings/extract/{proj}/{key}` | `drawings.py` | Title block zone text extraction |

### Startup Lifecycle

1. Clean orphaned temp tile directories
2. Zombie sweep: revert stuck `processing` sheet rows → `error`
3. Staged PDF TTL sweep: delete `staged/` files older than 72 hours

---

## 3.3 — PostgreSQL Database Components

```mermaid
C4Component
    title Component Diagram — PostgreSQL Database

    Container_Boundary(db, "PostgreSQL Database (Supabase)") {
        Component(core, "Core Domain", "Tables", "projects, project_members, platform_admins, project_settings, project_sequences, clients, client_brand_standards, client_documents, project_brand_standards")
        Component(decision, "Decision Engine", "Tables + RPCs + Triggers", "opportunities, opportunity_options, cost_codes, project_csi_specs, audit_logs, item_activity. RPCs: lock/unlock/de-escalate/reconcile/return. Triggers: immutability, auto-totals, coordination status.")
        Component(budget, "Budget Engine", "Tables + RPCs", "project_estimate_versions, project_estimates, estimate_variance_notes. RPCs: create/activate/finalize versions, waterfall, master ledger, multi-version matrix.")
        Component(spatial, "Spatial Engine", "Tables + RPCs", "project_drawing_sets, project_sheets, sheet_markups. RPCs: create/activate drawing sets, upsert markups.")
        Component(permits_engine, "Permit Engine", "Tables + RPCs", "permits, permit_comments, permit_task_links. RPCs: log_permit_activity.")
        Component(lessons_engine, "Lessons Engine", "Tables + RPCs", "project_lessons, lesson_opportunity_links, lesson_attachments. RPCs: update_lesson_status, get_lesson_indicators.")
        Component(rbac, "RBAC System", "Functions + Table", "role_permissions table (4 roles × 8 permissions). Helper functions: is_platform_admin(), get_user_project_role(), has_project_permission(). All RLS policies delegate to these.")
    }

    Rel(decision, core, "FK: project_id, user references")
    Rel(budget, core, "FK: project_id")
    Rel(spatial, core, "FK: project_id")
    Rel(permits_engine, core, "FK: project_id")
    Rel(lessons_engine, core, "FK: project_id")
    Rel(decision, spatial, "FK: opportunity_id on sheet_markups")
    Rel(permits_engine, decision, "FK: coordination_task_id via permit_task_links")
    Rel(lessons_engine, decision, "FK: opportunity_id via lesson_opportunity_links")
    Rel(rbac, core, "Enforces access on all tables")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Entity Relationship Diagram

```mermaid
erDiagram
    clients ||--o{ projects : "has"
    clients ||--o{ client_brand_standards : "defines"
    clients ||--o{ client_documents : "stores"

    projects ||--o{ project_members : "has"
    projects ||--|| project_settings : "has"
    projects ||--|| project_sequences : "has"
    projects ||--o{ opportunities : "contains"
    projects ||--o{ permits : "tracks"
    projects ||--o{ project_estimate_versions : "budgets"
    projects ||--o{ project_drawing_sets : "drawings"
    projects ||--o{ project_sheets : "sheets"
    projects ||--o{ project_csi_specs : "specs"
    projects ||--o{ project_brand_standards : "standards"
    projects ||--o{ project_lessons : "lessons"

    opportunities ||--o{ opportunity_options : "has contenders"
    opportunities ||--o{ sheet_markups : "mapped on"
    opportunities ||--o{ item_activity : "activity"
    opportunities ||--o{ lesson_opportunity_links : "lessons"

    opportunity_options ||--o{ item_activity : "activity"

    permits ||--o{ permit_comments : "comments"
    permits ||--o{ permit_task_links : "links to"

    project_estimate_versions ||--o{ project_estimates : "line items"
    project_estimate_versions ||--o{ estimate_variance_notes : "notes"

    project_drawing_sets ||--o{ project_sheets : "contains"
    project_sheets ||--o{ sheet_markups : "markups"

    project_lessons ||--o{ lesson_opportunity_links : "links"
    project_lessons ||--o{ lesson_attachments : "files"

    client_brand_standards ||--o{ project_brand_standards : "snapshots"

    cost_codes ||--o{ project_csi_specs : "maps to"
```

### Key Triggers

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trg_generate_opportunity_display_id` | `opportunities` | Auto-generates `VE-001` / `CD-001` display IDs from `project_sequences` |
| `trg_enforce_financial_immutability` | `opportunities` | Prevents modification of Approved records (bypass via `SET LOCAL`) |
| `trg_enforce_options_immutability` | `opportunity_options` | Prevents child modification when parent is Approved |
| `trg_sync_parent_opportunity_totals` | `opportunity_options` | Recalculates parent `cost_impact` from locked/budgeted/max options |
| `trg_auto_update_coordination_status` | `opportunities` | Auto-transitions `coordination_status` based on discipline completion |
| `trg_cascade_soft_delete_opportunities` | `opportunities` | Soft-deletes children + cleans `permit_task_links` |
| `trg_ui_system_activity_*` | `opportunities`, `options` | Generates `system_log` entries in `item_activity` |
| `trg_item_activity_immutability` | `item_activity` | Prevents mutation of system-generated logs |
| `trg_enforce_variance_note_immutability` | `estimate_variance_notes` | Prevents edits after version finalization |
| `trg_audit_*` | Multiple | Writes to `audit_logs` when audit logging is enabled |
| `trg_*_updated_at` | Multiple | Auto-updates `updated_at` timestamp |

### Key RPC Functions

| Category | RPC | Purpose |
|----------|-----|---------|
| **Decision Engine** | `lock_opportunity_option()` | Lock contender → set parent Approved → merge `coordination_details` |
| | `unlock_opportunity_option()` | Reverse lock → reset to Draft (immutability escape hatch) |
| | `de_escalate_opportunity()` | Remove escalated coordination item from VE matrix |
| | `reconcile_and_incorporate_opportunity()` | Budget reconciliation escape hatch |
| | `return_opportunity_to_design()` | Return locked item for redesign with revised cost |
| | `update_coordination_details_delta()` | Race-safe JSONB merge with `FOR UPDATE` lock |
| | `update_option_requirements_delta()` | Race-safe option-level JSONB merge |
| | `bulk_import_coordination_tasks()` | Atomic batch insert of coordination tasks |
| | `reorder_opportunity_options()` | Bulk reorder via JSONB array |
| | `toggle_option_budget()` | Toggle `include_in_budget` flag |
| **Budget Engine** | `create_estimate_version()` | Create version header + atomic active swap |
| | `bulk_append_estimate_lines()` | Chunked bulk insert + variance notes |
| | `activate_estimate_version()` | Atomic version swap + budget sync to `project_settings` |
| | `finalize_estimate_version()` | Finalize + optionally incorporate VE items |
| | `get_project_budget_waterfall()` | Server-side budget aggregation |
| | `get_master_ledger_grid()` | Master budget ledger aggregation |
| | `compare_estimate_versions()` | Estimate diff with IDOR protection |
| | `get_multi_version_matrix()` | Multi-version forensic matrix |
| | `get_budget_version_timeline()` | Version history timeline |
| **Spatial** | `create_drawing_set()` / `activate_drawing_set()` | Drawing set lifecycle |
| | `upsert_sheet_markups()` | Atomic replace of zone markups per (sheet, opportunity) |
| **CSI** | `bulk_upsert_company_csi_defaults()` | Company-level CSI training |
| | `seed_project_from_company_defaults()` | Seed project CSI from company defaults |
| | `remap_global_csi_entry()` | Remap CSI codes globally |
| **Admin** | `create_new_project()` | Project + admin member + settings in one transaction |
| | `is_platform_admin()` | Super-admin status check |
| | `get_system_users()` | List all users with project assignments |

---

# Level 4 — Code

> *"The optional Level 4 zooms into individual components to show how they are implemented. This is typically a UML class diagram or code-level detail."*

## 4.1 — Project File Structure

```
design-pulse/                           # Informal monorepo (no workspace manager)
│
├── designpulse-next/                   # ── NEXT.JS FRONTEND ─────────────────
│   ├── src/
│   │   ├── app/                        #   App Router: 6 pages + 3 API routes
│   │   │   ├── layout.tsx              #     Root layout (ONLY server component)
│   │   │   ├── globals.css             #     Tailwind v4 + design tokens
│   │   │   ├── login/page.tsx          #     Login (email + Procore OAuth)
│   │   │   ├── dashboard/page.tsx      #     Projects + Clients dashboard
│   │   │   ├── project/[projectId]/    #     Main workspace (143-line dynamic orchestrator)
│   │   │   │   └── item/[itemId]/      #       Pop-out item detail
│   │   │   ├── clients/[id]/page.tsx   #     Client detail (tabbed)
│   │   │   ├── auth/success/page.tsx   #     Procore OAuth success handler
│   │   │   ├── sandbox/map/page.tsx    #     Map dev sandbox
│   │   │   └── api/                    #     API routes (Procore OAuth + proxy)
│   │   ├── components/                 #   107 TSX files across 15 directories
│   │   │   ├── opportunities/ (16)     #     VE items: grid cells, cards, columns
│   │   │   ├── coordination/ (7)       #     Board, table, detail panel, import
│   │   │   ├── canvas/ (10)            #     Map zones, tiles, legend, viewport
│   │   │   ├── drawings/ (8)           #     PDF import, drawing grid, wizard
│   │   │   ├── analytics/ (11)         #     Charts, role-specific dashboards
│   │   │   ├── data-table/ (10+8)      #     Shared grid system + cell types
│   │   │   ├── dashboard/ (8)          #     Global settings, project/client CUD
│   │   │   ├── project/ (7)            #     Settings, estimates, CSI, brand std
│   │   │   ├── permits/ (7)            #     Permit board, table, detail, kanban
│   │   │   ├── clients/ (5)            #     Brand standards, documents, profile
│   │   │   ├── views/ (4)              #     View wrappers (VE, Budget, Coord, Lessons)
│   │   │   ├── lessons/ (3)            #     Detail panel, columns, templates
│   │   │   ├── layout/ (2)             #     Sidebar, account dropdown
│   │   │   ├── mydesk/ (2)             #     Personal dashboard
│   │   │   └── ui/ (7)                 #     Button, ModalShell, comboboxes, filters, rich text
│   │   ├── hooks/ (23)                 #   React Query hooks (domain-organized)
│   │   ├── stores/ (3)                 #   Zustand: UIStore, MapStore, ColumnSlice
│   │   ├── types/ (5)                  #   database.types, models, map.types, tanstack.d, exceljs.d
│   │   ├── lib/ (8+)                   #   Constants, utilities, cn.ts, excel parsers
│   │   ├── providers/ (3)              #   Auth, Query, Theme
│   │   ├── services/ (1)              #   api.ts (FastAPI proxy client)
│   │   ├── utils/ (2)                  #   financialMath, geometry
│   │   ├── workers/ (1)                #   snapping.worker.ts (Web Worker)
│   │   ├── scripts/ (1)                #   seedCompanyDefaults.ts
│   │   └── supabaseClient.ts           #   Singleton Supabase client
│   ├── next.config.mjs                 #   Proxy: /py-api/* → localhost:8000
│   ├── tsconfig.json                   #   Strict mode, @/* path alias
│   └── package.json                    #   31 deps, dev on port 8000
│
├── designpulse-backend/                # ── PYTHON MICROSERVICE ──────────────
│   ├── main.py (620 lines)             #   FastAPI app + legacy endpoints
│   ├── routers/
│   │   └── drawings.py                 #   UOPM pipeline endpoints
│   ├── services/
│   │   ├── auth.py                     #   JWT validation
│   │   ├── models.py                   #   Pydantic schemas
│   │   ├── pdf_inspector.py            #   PDF validation + thumbnailing
│   │   ├── tile_processor.py           #   DeepZoom tile pyramid (pyvips)
│   │   ├── vector_extractor.py         #   Structural line extraction
│   │   ├── PDFMapService.py            #   Annotated PDF export
│   │   └── worker.py                   #   Background job runner
│   ├── Dockerfile                      #   Python 3.12-slim (Render.com)
│   ├── requirements.txt                #   Python dependencies
│   └── start.ps1                       #   Local dev launcher
│
├── designpulse-map-module/             # ── LEGACY MAP PROTOTYPE (deprecated)
│   ├── backend/                        #   Overlapping PDF service
│   └── frontend/                       #   Separate React map components
│
├── supabase_schema.sql (153 KB)        # ── MASTER DATABASE SCHEMA ───────────
├── supabase_migrations/ (1)            #   Active migration
├── db_migrations_archive/ (14)         #   Historical migrations
│
├── .agent/skills/ (7)                  # ── AI AGENT SKILLS ──────────────────
│   ├── frontend-architecture/ (38 KB)
│   ├── database-guardrails/ (16 KB)
│   ├── data-table-architecture/ (8 KB)
│   ├── api-and-integration/ (3.5 KB)
│   ├── verify-feature/ (1.8 KB)
│   ├── map-feature-context/ (1.6 KB)
│   └── deep-review/ (1.1 KB)
│
├── AGENTS.md                           # AI agent context + routing table
├── README.md (52 KB)                   # Project docs + release notes (v0.6–v0.17)
└── FUTURE_IDEAS.md (9 KB)              # Roadmap proposals
```

## 4.2 — Type System

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/database.types.ts` | 544 | **Hand-maintained** Supabase schema types. `Row`, `Insert`, `Update` variants per table. Covers core tables but missing some (e.g., `item_activity`, `project_lessons`, `drawing_sets`). |
| `src/types/models.ts` | 471 | Domain models extending DB row types with JSONB typing and computed fields. Key types: `Opportunity`, `OpportunityOption`, `ProjectSettings`, `Project`, `Client`, `ClientBrandStandard`, `ProjectCsiSpec`, `ProjectEstimateVersion`, `ProjectEstimateLine`, `MasterLedgerRow`, `BudgetWaterfallRow`, `RolePermission`, `UserPermissions`, `ProjectMember`, `ItemActivity`, `ProjectLesson`. |
| `src/types/map.types.ts` | 166 | Spatial types: `DrawingSet`, `ProjectSheet`, `Zone`, `Point`, `ToolMode`, `MapState`, `VectorLine`, `LayoutConfig`, `CanvasRenderSettings`, `MapSnappingSettings`, `SnapCallback`, `BBox`, `RBush<T>`, `InspectPdfResponse`, `StagedPageMeta`. |
| `src/types/tanstack.d.ts` | 57 | Module augmentation for `@tanstack/react-table` `TableMeta`. Extends with mutation results, option maps, cost codes, CSI specs, project members, permissions, grid navigation refs. |
| `src/types/exceljs.d.ts` | — | Type declaration for ExcelJS module. |

## 4.3 — React Query Cache Configuration

```typescript
// src/providers/QueryProvider.tsx
defaultOptions: {
  queries: {
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  },
  mutations: {
    retry: 3,
  },
}
```

**Query Key Convention:** Structured `[entityType, scopeId]` tuples:

```
['opportunities', projectId]           ['estimate_versions', projectId]
['all_project_options', projectId]     ['estimate_lines', versionId]
['opportunity', opportunityId]         ['master-ledger-grid', projectId]
['project_settings', projectId]        ['budget-waterfall', projectId]
['projects']                           ['permits', projectId]
['project_members', projectId]         ['clients']
['project_sheets', projectId]          ['client', clientId]
['sheet_markups', sheetId]             ['system_users']
['activity_feed', entityType, entityId]
```

## 4.4 — Realtime Subscriptions

| Hook | Channel | Tables | Debounce | Invalidated Keys |
|------|---------|--------|----------|------------------|
| `useProjectRealtime` | `project-realtime-{id}` | `opportunities`, `opportunity_options`, `permits`, `permit_comments` | 300ms | 7 query keys |
| `useSheetRealtime` | `sheet-status-{id}` | `project_sheets` (UPDATE only) | 300ms | `project_sheets` |
| `useActivityFeed` (inline) | `activity-{id}` | `item_activity` | None | `activity_feed` |

## 4.5 — Storage Buckets

| Bucket | Purpose | Public | Path Convention |
|--------|---------|--------|-----------------|
| `project_drawings` | Tile pyramids, staged PDFs, vectors | No | `{project_id}/{sheet_id}/tiles/{z}/{col}_{row}.webp` |
| `floorplans` | Legacy PNGs + original PDFs | Yes | — |
| `client_documents` | Client reference documents | No | — |
| `lesson_attachments` | Lesson file attachments | No | — |

## 4.6 — Notable Large Files

| File | Size | Component |
|------|------|-----------|
| `GlobalSettingsModal.tsx` | 100 KB | CSI mappings, user management, cost codes |
| `ProjectSettings.tsx` | 71 KB | 12-tab project settings panel |
| `ProjectEstimateTab.tsx` | 62 KB | Budget estimate import + management |
| `OpportunityGridV2.tsx` | 57 KB | Main VE data grid (Value Matrix + Budget Ledger) |
| `FloorplanCanvas.tsx` | 37 KB | react-konva floor plan renderer |
| `useOpportunityQueries.ts` | 37 KB | VE decision engine hooks (920 lines) |
| `PermitTable.tsx` | 36 KB | Permit tracking grid |
| `SortableContenderCard.tsx` | 34 KB | Drag-and-drop contender card |
| `ExpandedCard.tsx` | 33 KB | Opportunity detail panel |
| `CoordinationTable.tsx` | 30 KB | Coordination board table |
| `EditableCell.tsx` | 30 KB | Editable grid cell component |

---

# Appendix A — Domain Glossary

| Term | Definition |
|------|------------|
| **Opportunity** | A single design element or VE item being evaluated (e.g., "Countertop Material"). The parent row. |
| **Option / Contender** | A relational sub-option for an Opportunity (e.g., "Concrete: $0", "Quartz: +$15k"). The child row. |
| **Locking** | Approving a contender. Sets parent status to `Approved`, overwrites `cost_impact`, triggers coordination. |
| **Potential Exposure** | `Math.max()` of unresolved options — worst-case financial risk for executives. |
| **Progressive Disclosure** | Data revealed based on workflow stage. Locked decisions unlock coordination checklists. |
| **Coordination Status** | Auto-calculated from per-discipline completion in `coordination_details` JSONB. |
| **Estimate Sync Status** | Tracks whether a locked VE item has been incorporated into the active budget version. |
| **UOPM** | Upload Once, Process Many — PDFs staged once, pages processed individually. |
| **Rosetta Stone** | CSI cost code mapping system — bridges different naming conventions across trades. |
| **Immutability Escape Hatch** | `SET LOCAL designpulse.bypass_immutability = 'true'` — transaction-scoped bypass in `SECURITY DEFINER` RPCs. |

---

# Appendix B — Architectural Patterns

### B.1 Supabase-First Data Layer
All CRUD flows directly through the Supabase JS client (with RLS enforcement). The Python microservice is only used for compute-heavy operations. There is no intermediate REST API for data operations.

```
Component → React Query Hook → supabase.from() / .rpc() → PostgreSQL (with RLS)
```

### B.2 Optimistic Updates with Rollback
Every React Query mutation (~20+) implements the full optimistic pattern:
1. `onMutate`: Cancel inflight queries → snapshot previous → `setQueryData` (optimistic) → return context
2. `mutationFn`: Execute Supabase RPC or table operation
3. `onError`: Restore from snapshot + toast error
4. `onSuccess`: Invalidate related caches for server truth

**Cross-cache invalidation example** (`useLockOption` invalidates 5 keys):
`opportunities`, `all_project_options`, `master-ledger-grid`, `budget-waterfall`, `pending_estimate_updates`

### B.3 Immutability + Escape Hatch
Database triggers enforce business rules (Approved records can't be modified). `SECURITY DEFINER` RPCs use `SET LOCAL` to bypass in controlled transactions: `unlock`, `reconcile`, `return-to-design`.

### B.4 Race-Safe JSONB Merging
`update_coordination_details_delta()` and `update_option_requirements_delta()` use `SELECT ... FOR UPDATE` row locks with shallow JSONB merge to prevent concurrent overwrites.

### B.5 Progressive Disclosure (Phase-Shifting)
Data revealed based on workflow stage. Once a decision is locked in Pre-Con, coordination checklists become actionable. The Coordination Board surfaces items where `coordination_status !== 'Not Required'` and `!== null`.

### B.6 Bidirectional Store Sync
`useUIStore` and `useMapStore` maintain two-way sync between the selected opportunity row and highlighted map zones. Selecting in the grid highlights on the canvas, and vice versa.

### B.7 Soft Deletes with Cascade
`is_deleted` boolean on opportunities, options, permits, and lessons. Trigger `trg_cascade_soft_delete_opportunities` soft-deletes children and cleans junction tables.

### B.8 Dynamic RBAC
`role_permissions` table maps 4 roles to 8 boolean permissions. `has_project_permission()` function is used in RLS policies for fine-grained access control. Roles can be reconfigured without code changes.

---

# Appendix C — Dependency Inventory

### C.1 Frontend Production (32 packages)

| Category | Package | Version |
|----------|---------|---------|
| **Framework** | `next` | `16.2.3` |
| | `react` / `react-dom` | `19.2.4` |
| **Data** | `@supabase/supabase-js` | `^2.103.0` |
| | `@tanstack/react-query` | `^5.99.0` |
| | `@tanstack/react-table` | `^8.21.3` |
| | `@tanstack/react-virtual` | `^3.13.24` |
| | `zustand` | `^5.0.12` |
| **Spatial** | `konva` / `react-konva` | `^10.2.5` / `^19.2.3` |
| | `rbush` | `^4.0.1` |
| | `react-zoom-pan-pinch` | `^4.0.3` |
| | `use-image` | `^1.1.4` |
| **DnD** | `@dnd-kit/core` | `^6.3.1` |
| | `@dnd-kit/sortable` | `^10.0.0` |
| | `@dnd-kit/utilities` | `^3.2.2` |
| **UI** | `lucide-react` | `^1.8.0` |
| | `framer-motion` | `^12.38.0` |
| | `sonner` | `^2.0.7` |
| | `next-themes` | `^0.4.6` |
| | `cmdk` | `^1.1.1` |
| **Rich Text** | `@tiptap/react` | `^3.23.4` |
| | `@tiptap/starter-kit` | `^3.23.4` |
| | `@tiptap/extension-placeholder` | `^3.23.4` |
| **Charts** | `recharts` | `^3.8.1` |
| **Export** | `jspdf` / `jspdf-autotable` | `^4.2.1` / `^5.0.7` |
| | `exceljs` | `^4.4.0` |
| **Utilities** | `date-fns` | `^4.1.0` |
| | `qs` | `^6.15.1` |
| | `clsx` | `^2.1.1` |

### C.2 Frontend Dev (7 packages)

`tailwindcss@^4`, `@tailwindcss/postcss@^4`, `typescript@^6.0.3`, `eslint@^9`, `eslint-config-next@16.2.3`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/rbush`

### C.3 Backend (Python)

`fastapi`, `uvicorn`, `PyMuPDF` (fitz), `pyvips`, `supabase`, `tenacity`, `httpx`, `python-dotenv`, `Pillow`

---

# Appendix D — Infrastructure & Deployment

### D.1 Local Development

| Service | Port | Command |
|---------|------|---------|
| Next.js Frontend | 8000 | `npm run dev` (custom port via `next dev -p 8000`) |
| Python Backend | 8001 | `start.ps1` → `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001` |

> [!NOTE]
> **Unified Dev Ports:** `next.config.mjs` correctly proxies `/py-api/*` to port `8001` (`http://127.0.0.1:8001`), which is the exact port where FastAPI is launched by `start.ps1`. Next.js dev server runs on port `8000`.

### D.2 Production

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Unknown (no config detected) | No `vercel.json`, `fly.toml`, or deployment configuration |
| Backend | Render.com | Dockerfile exposes `$PORT` (default 10000) |
| Database | Supabase (hosted) | `yrfzwtemupbesyunggcm.supabase.co` |

### D.3 CI/CD

> [!CAUTION]
> **No automated pipelines exist.** No GitHub Actions, Vercel config, or Render IaC. Deployment is entirely manual.

### D.4 Styling Configuration

- **Tailwind CSS v4** — CSS-first config in `globals.css` (no `tailwind.config.js`)
- **Fonts:** Outfit (sans-serif primary via `next/font/google`), Roboto Mono (monospace)
- **Dark mode:** Class-based via `next-themes` (`@custom-variant dark`)
- **Design tokens:** CSS custom properties for colors, glassmorphism, milestone fills
- **Data table CSS:** Standardized `.dt-*` class system for grid components

---

# Appendix E — Known Gaps & Technical Debt

### Critical

| Issue | Impact | Details |
|-------|--------|---------|
| **No automated tests** | High | No test framework configured (no jest, vitest, playwright). Backend has ad-hoc debug scripts only. |
| **No CI/CD** | High | Fully manual deployment. No automated build, lint, or deploy pipelines. |
| **No middleware.ts** | Medium | Auth is purely client-side. No server-side route protection for SSR. |
| **No error boundaries** | Medium | No `loading.tsx` or `error.tsx` anywhere. No route-level error handling. |

### Architecture

| Issue | Impact | Details |
|-------|--------|---------|
| **Hand-maintained DB types** | Medium | `database.types.ts` is not auto-generated via `supabase gen types`. Several tables missing. |
| **Mega-components** | Medium | 5 files exceed 50 KB (`GlobalSettingsModal` = 100 KB). Should be decomposed. |
| **Mega-page refactored** | Resolved | `/project/[projectId]/page.tsx` refactored from 957 lines to a clean 143-line orchestrator. Views isolated under `src/components/views/`. |
| **Legacy map module** | Low | `designpulse-map-module/` is a deprecated prototype that should be removed. |
| **Inconsistent barrel exports** | Low | Only `data-table/` uses barrels. Other feature directories use direct imports. |
| **Missing Supabase CLI** | Low | No `supabase/` directory for local dev. Schema managed via raw 153 KB SQL file. |
| **Package name** | Cosmetic | `package.json` name is `sitepulse-next` (legacy), should be `designpulse-next`. |

### Security

| Issue | Impact | Details |
|-------|--------|---------|
| **Backend `.env` secrets** | High | Service role key in `designpulse-backend/.env` — verify not tracked in git history. |
| **No server-side auth** | Medium | All auth guards are client-side JavaScript. SSR/API routes beyond Procore callbacks are unprotected. |

---

*This document follows the [C4 model](https://c4model.com/) for software architecture documentation. It was generated via automated architecture analysis on 2026-05-21 and should be updated as the system evolves.*
