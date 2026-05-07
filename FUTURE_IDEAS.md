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
