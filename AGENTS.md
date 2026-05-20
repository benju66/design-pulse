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
* **Microservice:** Python/FastAPI located in `designpulse-backend/` (and `designpulse-map-module/`) using `PyMuPDF` (`fitz`) to handle heavy PDF parsing, vector extraction, and status mapping exports.

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
- **Database/SQL/RLS:** invoke `database-guardrails`
- **API/Python/Microservice:** invoke `api-and-integration`
- **Code Reviews:** invoke `deep-review`
- **Feature Verification:** invoke `verify-feature`

## Test Credentials
When checking the app in the browser, use the following credentials to log in:
- Username: `burness@fpcinc.com`
- Password: `BuildIt2026!!`
- URL: `http://localhost:8000/`