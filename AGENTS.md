# PROJECT CONTEXT: Design Pulse (Pre-Construction Decision Engine)

## 1. Core Identity & Business Problem
Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Visual Value Engineering (VE) Tracker. In commercial construction, teams debate material alternatives and design changes using static, disconnected spreadsheets, leading to "decision amnesia" and execution errors. 

**Workflow Pipeline:** This is fundamentally a workflow application. It transforms static data into an interactive, spatial, and auditable state-machine. The pipeline begins with the **Decision Engine** (financial evaluation and option locking) and naturally progresses into **Design Coordination** (architectural/MEP updates based on locked decisions), with the architectural runway to add execution and field tracking phases later.

## 2. Tech Stack
* **Frontend:** Next.js (App Router, React 19), Tailwind CSS v4, Lucide React.
* **State Management:** Zustand (UI state, view modes, compare queues).
* **Data & Caching:** `@tanstack/react-query` paired with `idb-keyval` for Offline-First caching via IndexedDB.
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
* `projects`: Master project records.
* `project_settings`: JSONB configurations for dynamic `scopes`, `categories`, and `sidebar_items`.
* `opportunities`: The parent VE log items. Contains a `design_markups` JSONB array linking decisions to spatial floor plan coordinates.
* `opportunity_options`: The relational contenders. Linked to `opportunities` via `opportunity_id` (Foreign Key, Cascade Delete).

---

# ⚠️ STRICT TECHNICAL GUARDRAILS (CRITICAL) ⚠️
When generating, refactoring, or modifying code, you MUST adhere to the following constraints.

## A. JavaScript & Browser Compatibility (iOS Safety)
* **CRITICAL:** Explicitly **FORBID** the use of JavaScript regex "negative lookbehinds" (e.g., `(?<!...)`). This causes fatal crashes on older iOS WebKit engines. You MUST use standard loop-based logic, string splitting, or manual parsing to achieve the intended result.

## B. Backend Separation of Concerns
* **Next.js API Routes (`/api/...`):** Strictly reserved for Authentication flows (e.g., Procore OAuth). Do NOT build general data CRUD endpoints here.
* **Python FastAPI Backend:** Strictly dedicated to heavy processing tasks (PyMuPDF file conversions, vector extraction via Shapely). Do NOT use this for basic CRUD operations.
* **Data Fetching:** Standard CRUD operations must be handled directly from the frontend using the `@supabase/supabase-js` client protected by RLS.

## C. Code Generation Instructions
1.  **Respect the Cache:** Always use TanStack Query mutations (`onMutate`, `onSuccess`) to update the UI optimistically or invalidate queries. Do NOT force page reloads and do NOT use raw `useEffect` for data fetching.
2.  **Tailwind First:** Use Tailwind utility classes. Strictly support `dark:` mode variants. 
3.  **Headless UI:** Rely on the established `@tanstack/react-table` and `@dnd-kit` patterns. Avoid introducing heavy UI component libraries (like Material UI or Ant Design) that clash with the custom styling.
4.  **Relational Math:** Remember that an Opportunity's true financial weight prior to approval is derived from its attached Options, not just the parent row.
5.  **Proactive Innovation:** If you identify a more efficient algorithm, a superior architectural pattern, or a highly relevant library that falls outside these strict guardrails, you are encouraged to suggest it. However, you MUST explicitly propose the alternative, explain its benefits, and wait for explicit user approval before writing code that introduces new dependencies or alters the established tech stack.