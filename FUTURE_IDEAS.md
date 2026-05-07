# Design Pulse: Future Ideas & Roadmap

This document serves as a living log for architectural explorations, feature ideas, and UX enhancements that fall outside the immediate scope of active sprints but provide significant value to the core mission of the platform.

---

## 1. Multi-Version Budget Comparison (Variance Deltas)

**Date Logged:** May 2026  
**Context:** Following the stabilization of the Procore Budget Import pipeline, a need was identified to track how project budgets evolve across multiple imported versions (e.g., "Initial Estimate" vs "GMP Rev 2").

### Core Philosophy Alignment
Design Pulse is a "Pre-Construction Decision Engine" designed to fight "decision amnesia" and track variances. Bringing variance tracking natively into the baseline budget ingestion phase allows executives and project managers to instantly see exactly *where* a budget swelled or shrank, without manually cross-referencing external Excel documents.

### Proposed User Experience (UX)
* **The "Compare Tray" Pattern:** Reuse the existing UX mental model established for Opportunities. 
* Users can use checkboxes on the Version History list to select exactly two baseline estimate versions.
* A floating action tray appears at the bottom of the screen with a "Compare Versions" button.
* Clicking the button opens a full-screen or large modal data grid showing a side-by-side variance matrix.
* **Visual Indicators:** Rows with no financial change are visually muted. Cost savings (negative deltas) are highlighted in emerald, while cost increases (positive deltas) are flagged with rose/amber warning colors.

### Architectural Implementation
* **Server-Side Diffing (Crucial):** To prevent severe UI lag on the frontend (React `useMemo` freezing while comparing hundreds of rows), the diffing engine must live in the database.
* **PostgreSQL RPC:** Create a fast, set-based RPC (e.g., `compare_estimate_versions(uuid_a, uuid_b)`).
* Because the `project_estimates` table uses a denormalized `cost_code` as a loose foreign key (per `AGENTS.md`), the RPC can execute a highly efficient `FULL OUTER JOIN` on `cost_code` between the two target versions.
* The RPC will instantly return a pre-calculated dataset shaped like:
  ```typescript
  {
    cost_code: string;
    description: string;
    old_amount: number;
    new_amount: number;
    delta_amount: number;
  }
  ```
* The frontend simply fetches this RPC via TanStack Query and renders the pre-calculated rows directly into a read-only `@tanstack/react-table` grid.

---

## 2. GC Executive Budget Analytics

**Date Logged:** May 2026
**Context:** After implementing the Grid V2 Waterfall chart for granular trade tracking, it was identified that Construction Executives need high-level rollups of budget health. Since the optimized `useProjectBudgetWaterfall` RPC already provides the necessary data, these analytics can be built purely client-side without new database queries.

### Proposed Visualizations

#### 1. The Division-Level Heatmap (Treemap)
* **The Problem:** Execs don't care that "Cost Code 09-2900 (Gypsum)" is $5k over budget. They care that "Division 09 (Finishes)" is $200k over budget as a whole.
* **The Solution:** Take the granular waterfall data and roll it up by the 2-digit CSI Division prefix (e.g., 03 Concrete, 09 Finishes, 26 Electrical). Visualize this as a **Treemap** where the *size* of the block represents the Division's total budget weight, and the *color* represents its variance health (Green = Savings, Red = Over Budget). This instantly answers: *"Where is the bulk of our money, and are those major scopes healthy?"*

#### 2. The GMP / Cost-to-Complete Progress Bar
* **The Problem:** Execs need a single metric to answer: *"Are we going to hit our budget?"*
* **The Solution:** A massive, high-fidelity progress bar showing `Projected Position` vs `Baseline Budget`. If the total Projected Position (Base + Locked + Pending) crosses 100% of the Baseline, the bar turns red and shows the exact overage percentage.

#### 3. Top 5 Financial Exposures (Risk Radar)
* **The Problem:** Execs need to know what to yell about in the next OAC (Owner-Architect-Contractor) meeting.
* **The Solution:** A simple ranked list showing the Top 5 Cost Codes with the highest *Pending Variance*. This cuts through the noise and immediately highlights the biggest unresolved financial risks on the project that are currently sitting in "Draft" or "Pending" states.

### Architectural Implementation
* Integrate the `useProjectBudgetWaterfall` hook into the existing `GCDashboard.tsx` component.
* Use pure client-side `useMemo` reductions to aggregate the raw RPC rows into Division buckets or Top 5 lists, maintaining optimal performance.

---

## 3. Lessons Learned Database

**Date Logged:** May 2026
**Context:** Construction teams generate significant institutional knowledge during a project (e.g., constructability issues, material failures, AHJ quirks). This knowledge is often lost between projects, leading to repeated mistakes and missed savings opportunities. 

### Core Philosophy Alignment
Design Pulse is built to prevent "decision amnesia." By capturing Lessons Learned directly at the project level and explicitly tagging them with standardized taxonomies (Cost Codes and CSI codes), the platform can automatically surface past knowledge as a "Pre-Construction Decision Engine" for future projects estimating those same codes.

### Proposed User Experience (UX)
* **Project-Level View:** A dedicated `LessonsGrid` within the Project Settings or a new Sidebar tab, reusing the Tri-State Master-Detail pattern. Users can log lessons with categories (Design, Constructability, Safety), descriptions, and link them via the `SmartCostCodeCombobox`.
* **Proactive Integration:** When a user interacts with a Contender in the VE Matrix (`OpportunityGrid`) that shares a `cost_code` with logged lessons, a zero-JS tooltip or indicator can surface: *"3 Lessons Learned across the company for this Cost Code."*
* **Global Dashboard (Future):** A top-level cross-project route utilizing a `SECURITY DEFINER` RPC to aggregate lessons company-wide, grouped by CSI or Cost Code.

### Architectural Implementation
* **Schema:** A new `project_lessons` table (RLS protected via `public.has_project_permission()`).
* **Taxonomy Links:** Store `cost_code` and `csi_number` as plain text columns (Loose Text Foreign Keys) rather than strict UUIDs. This denormalization prevents cascading delete issues across tenants while enabling seamless cross-project `GROUP BY` aggregations.
* **UI Ecosystem:** Leverage existing `@tanstack/react-table` and TanStack Query infrastructure for optimistic updates and high-performance rendering.

---

## 4. Client Database Integration

**Date Logged:** May 2026
**Context:** Construction teams manage projects for various clients, and often multiple projects for the same client. Currently, projects are distinct silos. There is a need to organize projects under a unified "Client" entity to track overarching relationships, contact information, and brand standards.

### Core Philosophy Alignment
Design Pulse aims to streamline pre-construction by tracking variables that impact decisions. For repeat clients or clients with strict brand guidelines (e.g., specific MEP requirements or preferred vendors), having a central repository for these "Brand Standards" prevents teams from hunting down PDFs or relying on memory when proposing VE options.

### Proposed User Experience (UX)
* **Global Clients Directory:** A top-level route (similar to the Projects dashboard) displaying a high-performance grid of all clients, their active project count, and quick links to their standards.
* **Client Detail View:** A master-detail layout showcasing:
  * **Overview:** Client contact information and primary stakeholders.
  * **Brand Standards:** A dedicated view for rendering brand guidelines (either via rich text/markdown notes or external links to document repositories like Procore Docs).
  * **Project Aggregation:** A data grid listing all historical and active projects associated with the client.
* **Project Creation Flow:** A `SmartClientCombobox` in the "Create Project" modal or "Project Settings" to link projects to existing clients or create them on the fly.

### Architectural Implementation
* **Schema:** Create a new global `clients` table (`id`, `name`, `brand_standards_notes`, `brand_standards_url`, `primary_contact_name`).
* **Relationship:** Alter the existing `projects` table to include a `client_id` foreign key (1-to-many relationship).
* **Security (RLS):** Implement RLS policies ensuring that any member of a project associated with a client can view the client details, but only platform admins or GC admins can modify them.
* **Integration:** Update `src/types/models.ts` and TanStack query hooks to support client data fetching and relational joins.
