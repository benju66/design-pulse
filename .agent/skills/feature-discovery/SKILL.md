# TASK: Feature Deconstruction & Contextual Discovery

Execute these steps to build a 360-degree understanding of the target feature. Stop and ask for clarification if you find conflicting logic or dead-end code paths. Do not write or propose any implementation plans during this discovery phase.

**Step 1: Workspace Indexing & File Discovery**
Search the repository explicitly to identify every component, service, schema, or configuration file related to this feature. 
* Group discoveries by target directories: Next.js frontend (`designpulse-next/`), Python backend (`designpulse-backend/`), or Map module (`designpulse-map-module/`).
* Identify the exact file paths for database interactions: tables, RLS policy files, triggers, or specific migrations.
* Output: A structured Markdown table of "Primary Impact Files" (direct mutations) and "Secondary Impact Files" (import/export dependencies).

**Step 2: Data Lifecycle & Microservice Boundaries**
Trace the complete chronological flow of data for this feature from entry to persistence.
* Identify the origination point (e.g., user input UI, Procore OAuth synchronization, or background worker processes).
* Track state transformation layers: Detail exactly which Zustand slices, TanStack Query cache keys, or React hooks manipulate the state frontend-side.
* Track backend processing: Identify the exact Supabase RPCs, PostgreSQL views, or FastAPI routers that process, compute, or validate the payload.

**Step 3: Security, RBAC & Mutation Constraints**
Conduct a strict security isolation check for the target workflows.
* Verify Row Level Security (RLS) policies involved. Identify if junction tables require the `get_user_project_role()` security definer helper to bypass infinite recursion.
* Enforce strict role validation matching `project_members`: Confirm operations validate against the explicit `project_admin` enum value rather than an invalid `owner` string.
* Identify data immutability trigger constraints. Flag if the target tables utilize a `bypass_immutability` transaction-scoped configuration hatch.

**Step 4: Pattern Alignment & Constraint Matching**
Review `AGENTS.md` alongside all sub-skills within `.agent/skills/` (including `database-guardrails`, `data-table-architecture`, and `frontend-architecture`) to extract required house-style conventions.
* Extract reusable patterns: Enforce the use of the shared `Button` primitive, `ModalShell` layout overlays, or high-performance data tables.
* Check for date standardization rules: Ensure any target chronological properties utilize component-based regex extraction utilities in `src/lib/formatters.ts` rather than native JS conversions.
* Scan for forbidden anti-patterns: Flag and block client-side JSONB object merging, multi-table mutations bypass of advisory locks, polymorphic relationship modeling, or selectability filtering on display accordion hints like `cost_codes.is_division`.

**Step 5: Contextual Summary & Blast Radius Profile**
Provide a concise, scannable technical summary of the system's current architecture for this scope. 
* Detail the exact "Blast Radius" of any potential side effects across adjacent columns, tables, cache instances, or external API layers.
* Stop entirely and wait for further instructions. Do not write an implementation plan.