# PROJECT CONTEXT: Design Pulse (Pre-Construction Decision Engine)

## 1. Core Identity & Business Problem
Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Visual Value Engineering (VE) Tracker. In commercial construction, teams debate material alternatives and design changes using static, disconnected spreadsheets, leading to "decision amnesia" and execution errors. 

**Workflow Pipeline:** This is fundamentally a workflow application. It transforms static data into an interactive, spatial, and auditable state-machine. The pipeline begins with the **Decision Engine** (financial evaluation and option locking) and naturally progresses into **Design Coordination** (architectural/MEP updates based on locked decisions), with the architectural runway to add execution and field tracking phases later.

## 2. Tech Stack
* **Frontend:** Next.js (App Router, React 19), TypeScript (Strict Mode, 100% Coverage), Tailwind CSS v4, Lucide React.
* **State Management:** Zustand (UI state, view modes, compare queues).
* **Data & Caching:** `@tanstack/react-query` for high-performance frontend caching, utilizing atomic Supabase RPC-based state management.
* **Data Grid:** `@tanstack/react-table` (Headless UI, configured for Excel-style fixed-layout resizing).
* **Drag-and-Drop:** `@dnd-kit` (Used for Jira-style customizable widgets and reordering items).
* **Spatial / Canvas:** `react-konva` (Renders high-fidelity floor plans with interactive vector markups).
* **Backend / Database:** Supabase (PostgreSQL with Row Level Security, Auth, Storage, and Realtime subscriptions).
* **Microservice:** Python/FastAPI using `PyMuPDF` (`fitz`) to handle heavy PDF parsing, vector extraction, and status mapping exports.

## 3. Core Domain Logic & Terminology
* **Opportunities (The Parent Row):** A single design element or VE item (e.g., "Countertop Material"). 
* **Options / Contenders (The Children):** The relational sub-options for an Opportunity (e.g., "Concrete: $0", "Quartz: +$15,000"). 
* **Locking:** Users evaluate the Contenders Matrix. Clicking "Lock" on a contender overwrites the parent Opportunity's official `cost_impact`, sets the parent to 'Approved' or 'Pending Plan Update', and locks the financial variance.
* **Potential Exposure:** A custom budget metric calculating the worst-case scenario (`Math.max()`) of unresolved options to show executives maximum financial risk.
* **Progressive Disclosure (Phase-Shifting):** Data is revealed based on workflow stage. Once a decision is locked in the Pre-Con phase, coordination checklists (`mep_impact`, `arch_plans_spec`) become actionable for the Design phase.

## 4. UI / UX Architecture
* **Tri-State Master-Detail View:** The main UI (`OpportunityGrid`) supports three modes: `flat` (dense table), `split` (DetailPanel slides in), and `pop-out` (isolated browser window).
* **Compare Tray:** Users can check multiple rows in the mega-table to open an e-commerce style side-by-side comparison modal.
* **Project Sidebar:** A collapsible left navigation bar controlling views (Dashboard, Map, Analytics, Coordination, Settings).

## 5. Database Schema (Supabase PostgreSQL)
* **SOURCE OF TRUTH:** You MUST read the `supabase_schema.sql` file in the root directory to understand the exact column names and types before writing any Supabase client queries or mutations.
* `platform_admins`: Global super-user directory protected by strict RLS preventing privilege escalation.
* `project_members`: Project-level relational table defining RBAC roles (`owner`, `gc_admin`, `design_team`, `viewer`).
* `projects`: Master project records.
* `project_settings`: JSONB configurations for dynamic `scopes`, `categories`, `sidebar_items`, and `disciplines` (Array of objects: `[{id: "...", label: "..."}]`).
* `opportunities`: The parent VE log items. Contains `design_markups` JSONB and `coordination_details` JSONB.
* `opportunity_options`: The relational contenders. Linked to `opportunities` via `opportunity_id` (Foreign Key, Cascade Delete).

---

# ⚠️ STRICT TECHNICAL GUARDRAILS (CRITICAL) ⚠️
When generating, refactoring, or modifying code, you MUST adhere to the following constraints.

## A. TypeScript & Browser Compatibility (iOS Safety)
* **CRITICAL:** Explicitly **FORBID** the use of JavaScript/TypeScript regex "negative lookbehinds" (e.g., `(?<!...)`). This causes fatal crashes on older iOS WebKit engines. You MUST use standard loop-based logic, string splitting, or manual parsing to achieve the intended result.

## B. Backend Separation of Concerns
* **Next.js API Routes (`/api/...`):** Strictly reserved for Authentication flows (e.g., Supabase native Email/Password Auth, Procore OAuth). Do NOT build general data CRUD endpoints here.
* **Security & Auth Queries:** The frontend CANNOT directly query the Supabase `auth.users` schema. You must use `SECURITY DEFINER` RPCs (like `get_system_users()`) to securely bridge authentication data into the public schema without leaking sensitive user metadata.
* **RLS & Junction Table Recursion:** When writing Row Level Security (RLS) policies for junction tables (like `project_members`) that check a user's role within that same table, NEVER query the table directly in the policy (e.g., `EXISTS (SELECT 1 FROM project_members...)`). This triggers infinite recursion and evaluation failures. You MUST create a `SECURITY DEFINER` helper function (like `get_user_project_role()`) to bypass RLS safely and use that function within the policy's `USING` or `WITH CHECK` clauses.
* **Foreign Keys to Auth:** When referencing `auth.users(id)`, ensure the constraint explicitly points to `auth.users` and that `REFERENCES` permissions are correctly established. RLS applies before foreign key checks, so ensure your RLS policies pass before diagnosing FK constraint errors.
* **Database Immutability & Escape Hatches:** When creating PostgreSQL triggers to enforce data immutability (e.g., locking financial records), always provide a transaction-scoped escape hatch (e.g., `IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN RETURN NEW; END IF;`). This allows authorized, `SECURITY DEFINER` RPCs to intentionally unlock records without disabling the trigger globally.
* **JSONB Type Casting in RPCs:** When iterating over JSONB objects in PL/pgSQL using `FOR k, v IN SELECT key, value FROM...`, strictly use `jsonb_each_text()` instead of `jsonb_each()` if you intend to compare the extracted values against standard SQL text/strings (e.g., `IF v = 'true' THEN`). Using `jsonb_each()` causes fatal `operator does not exist: text = jsonb` errors.
* **Python FastAPI Backend:** Strictly dedicated to heavy processing tasks (PyMuPDF file conversions, vector extraction via Shapely). Do NOT use this for basic CRUD operations.
* **Data Fetching:** Standard CRUD operations must be handled directly from the frontend using the `@supabase/supabase-js` client protected by RLS.

## C. Code Generation Instructions
1.  **Strict TypeScript (No `any`):** The codebase strictly forbids the use of `any`. You must use `unknown` or exact interfaces for API payloads and TanStack generics. Furthermore, all Next.js App Router dynamic `params` must be typed and resolved as `Promises` (Next.js 15+ standard).
2.  **Respect the Cache:** Always use TanStack Query mutations (`onMutate`, `onSuccess`) to update the UI optimistically or invalidate queries. Do NOT force page reloads and do NOT use raw `useEffect` for data fetching.
3.  **Tailwind First:** Use Tailwind utility classes. Strictly support `dark:` mode variants. Utilize Tailwind v4 `@container` queries for structural grid layouts instead of viewport breakpoints (`lg:`, `md:`) whenever the component exists within a sliding or resizable layout (like the Master-Detail view).
4.  **Headless UI:** Rely on the established `@tanstack/react-table` and `@dnd-kit` patterns. Avoid introducing heavy UI component libraries (like Material UI or Ant Design) that clash with the custom styling.
5.  **Analytics & Aggregation:** Heavy data aggregation (e.g., ROI distribution, bottleneck counts, heatmap variances) MUST be offloaded to PostgreSQL RPC stored procedures rather than calculating via `useMemo` on the client thread. Consume these RPCs via TanStack `useQuery`.
6.  **Relational Math:** Remember that an Opportunity's true financial weight prior to approval is derived from its attached Options, not just the parent row.
7.  **JSONB Data Integrity (Immutable IDs):** When managing dynamic user-defined fields (like `disciplines`), always use immutable IDs (e.g., `crypto.randomUUID()`) as keys in the JSONB objects rather than display labels. If a user deletes a dynamic field, the data remains orphaned in the JSONB object. This acts as a "soft delete" data retention feature. Do NOT write cleanup scripts to delete orphaned JSONB keys. When mutating JSONB, ensure you use shallow/deep merging (e.g., `...opportunity.coordination_details as Record<string, any>`) to avoid overwriting sibling properties.
8.  **Client-Side UUIDs for Optimistic Inserts:** Explicitly ban the use of fake `temp-` IDs for optimistic creation. New records must always be minted on the client side using `crypto.randomUUID()` so that the ID perfectly matches the database and prevents React components from unmounting/losing focus when the server responds.
9.  **Optimistic Parent-Row Spreading:** Any mutation affecting a child relational table (e.g., modifying `opportunity_options`) MUST spread the parent row (`{ ...opp }`) in the React Query cache during `onMutate`. This ensures the data grid's structural sharing instantly detects the change and recalculates aggregate ranges without waiting for the server.
10. **Structural Sharing over Mutable Meta:** Explicitly ban deep-comparison loops over mutable objects like `table.options.meta` inside `React.memo` cell comparators. TanStack Table v8 object identity remains stable, creating memoization traps. Cell memoization must strictly rely on `prevProps.row.original !== nextProps.row.original` for accurate, high-performance rendering.
11. **Supabase RPC Null Safety:** When calling Supabase `.rpc()` methods from the frontend, always explicitly fallback to `null` for optional parameters (e.g., `p_field: value || null`). Passing `undefined` omits the key from the JSON payload entirely, causing fatal "function signature not found" errors in PostgreSQL.
12. **Proactive Innovation:** If you identify a more efficient algorithm, a superior architectural pattern, or a highly relevant library that falls outside these strict guardrails, you are encouraged to suggest it. However, you MUST explicitly propose the alternative, explain its benefits, and wait for explicit user approval before writing code that introduces new dependencies or alters the established tech stack.