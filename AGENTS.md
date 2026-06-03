# PROJECT CONTEXT: Design Pulse (Pre-Construction Decision Engine)

## 1. Core Identity & Business Problem
Design Pulse is an enterprise-grade Pre-Construction Decision Engine and Visual Value Engineering (VE) Tracker. In commercial construction, teams debate material alternatives and design changes using static, disconnected spreadsheets, leading to "decision amnesia" and execution errors. 

**Workflow Pipeline:** This is fundamentally a workflow application. It transforms static data into an interactive, spatial, and auditable state-machine. The pipeline begins with the **Decision Engine** (financial evaluation and option locking) and naturally progresses into **Design Coordination** (architectural/MEP updates based on locked decisions), with the architectural runway to add execution and field tracking phases later.

## 2. Tech Stack
* **Frontend:** Next.js (App Router, React 19), TypeScript (Strict Mode, 100% Coverage), Tailwind CSS v4, Lucide React.
* **UI Primitives:** Shared `Button` component (`src/components/ui/Button.tsx`) with variant/intent/size system. Shared `ModalShell` component (`src/components/ui/ModalShell.tsx`) for all overlay dialogs. `clsx` via `cn()` utility for conditional class merging. All action buttons must use the shared Button; all overlay modals must use ModalShell.
* **State Management:** Zustand (UI state, view modes, compare queues).
* **Data & Caching:** `@tanstack/react-query` for high-performance frontend caching, utilizing atomic Supabase RPC-based state management.
* **Data Grid:** `@tanstack/react-table` (Headless UI, configured for Excel-style fixed-layout resizing).
* **Drag-and-Drop:** `@dnd-kit` (Used for Jira-style customizable widgets and reordering items).
* **Spatial / Canvas:** `react-konva` (Renders high-fidelity floor plans with interactive vector markups).
* **Backend / Database:** Supabase (PostgreSQL with Row Level Security, Auth, Storage, and Realtime subscriptions).
* **Microservice:** Python/FastAPI located in `designpulse-backend/` (and `designpulse-map-module/`) using `PyMuPDF` (`fitz`) to handle heavy PDF parsing, vector extraction, and status mapping exports.
* **Testing:** Vitest (unit + integration, `designpulse-next/tests/`), Playwright (E2E, `designpulse-next/tests/e2e/`), pytest (backend, `designpulse-backend/tests/`). Run with `npm test`, `npm run test:e2e`, and `python -m pytest tests/ -v` respectively. CI via GitHub Actions (`.github/workflows/verify.yml`).

## 3. Core Domain Logic & Terminology
* **Opportunities (The Parent Row):** A single design element or VE item (e.g., "Countertop Material"). 
* **Options / Contenders (The Children):** The relational sub-options for an Opportunity (e.g., "Concrete: $0", "Quartz: +$15,000"). 
* **Locking:** Users evaluate the Contenders Matrix. Clicking "Lock" on a contender overwrites the parent Opportunity's official `cost_impact`, sets the parent status to `'Approved'`, and locks the financial variance. The `requires_coordination` flag on the locked contender feeds into `trg_auto_update_coordination_status`, which recalculates the parent opportunity's `coordination_status`. The Coordination Board filter surfaces both locked decisions and "Early Start" Draft items by checking if `coordination_status` is actively set (e.g., `!== 'Not Required'` and `!== null`) — never the contender flag directly.
* **Potential Exposure:** A custom budget metric calculating the worst-case scenario (`Math.max()`) of unresolved options to show executives maximum financial risk.
* **Progressive Disclosure (Phase-Shifting):** Data is revealed based on workflow stage. Once a decision is locked in the Pre-Con phase, coordination checklists (`mep_impact`, `arch_plans_spec`) become actionable for the Design phase.

## 4. Innovation & Proposals
**Proactive Innovation:** If you identify a more efficient algorithm, a superior architectural pattern, or a highly relevant library that falls outside strict guardrails, you are encouraged to suggest it. However, you MUST explicitly propose the alternative, explain its benefits, and wait for explicit user approval before writing code that introduces new dependencies or alters the established tech stack.

---

# ⚠️ SKILL ROUTING TABLE (V2.0) ⚠️
The heavy technical guardrails for this project have been extracted into modular V2.0 Skills files to preserve AI context windows.

When working on this project, rely on the following modular skills stored in `.agent/skills/`:
- **Frontend/UI/State:** invoke `frontend-architecture`
- **Data Tables/Grid Components:** invoke `data-table-architecture`
- **Database/SQL/RLS:** invoke `database-guardrails`
- **API/Python/Microservice:** invoke `api-and-integration`
- **Code Reviews:** invoke `deep-review`
- **Feature Verification:** invoke `verify-feature`
- **Coordination Load Testing:** invoke `load-test-coordination`
- **Testing & Verification:** Run `npm test` (Vitest unit + integration), `npm run test:e2e` (Playwright E2E), `python -m pytest tests/ -v` (backend pytest). Always run `npm test` after code changes to catch regressions.

## Test Credentials
When checking the app in the browser, use the following credentials to log in:
- Username: `burness@fpcinc.com`
- Password: `BuildIt2026!!`
- URL: `http://localhost:8000/`

---

## 5. Date Standardization & Timezone Stability
* **Native Storage**: All deadline and chronological properties must be stored using native PostgreSQL `DATE` types (such as `opportunities.due_date`).
* **Timezone Shifting Prevention**: Avoid standard native JS `new Date(string)` or locale conversions directly on standard ISO date strings (`YYYY-MM-DD`). To prevent local browser timezone offset bugs from shifting dates backward by 1 day, always utilize components-based regex extraction parser utilities from `src/lib/formatters.ts` (e.g., `formatDate` and `toDateInputValue`).
* **Grid Cell Formats**: Display dates uniformly as `MM/DD/YYYY` in navigate mode and utilize HTML5 native date input `<input type="date">` styled for high-contrast light and dark modes in edit mode.

---

## 6. Ghost Rows & Inline Creation Standardization
* **Floating Input Controls Pattern**: In generic grids where no dedicated `options` or bulk action columns are active, always wrap the primary inline `<input>` inside a relative flex container (`relative flex items-center w-full h-full`). Position the check/save (`Plus` icon) and clear (`X` icon) buttons inside the input's bounding box using absolute positioning (`absolute right-2`). Ensure the input uses right-padding (`pr-16`) to prevent text overlapping the floating actions.
* **Filter Viewport Safety**: All Ghost Rows must accept and inherit active viewport query filters (e.g., active building areas or cost codes) as `defaultValues`. This guarantees newly logged items match active filters and never vanish from the user's view upon database refetches.
* **Double-Submission Locks**: Inputs and save actions must be programmatically disabled (`disabled={createMutation.isPending}`) when mutations are pending to secure the system against rapid multiple clicks.
* **Post-Add Viewport Alignment**: On database success, the mutation callback must set the newly created item ID in the active state store (`setSelectedOpportunityId`), programmatically triggering the virtualization engine to scroll, center, and flash highlight the new row.
* **Static Cell Placeholder Standardization**: All non-primary static placeholders or unassigned database fields inside the Ghost Row (such as `display_id` and category `record_type` cells) MUST be standardized to render a single, uniform hyphen `"-"` rather than temporary mock values (like `"New"`, `"DE-???"`, or `"KD-???"`) to maintain a distraction-free, premium visual baseline.
* **Unified Input Placeholders**: The primary input cell's idle placeholder MUST be standardized to `"+ Add Item..."` across all grids in the application (and update reactively to `"Saving new item..."` or `"Saving comment..."` during pending mutations) to ensure visual coherence.