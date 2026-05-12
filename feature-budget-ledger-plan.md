# Hardened Heterogeneous Budget Grid & Financial Lifecycle Implementation Plan

Following a rigorous review against `AGENTS.md` and enterprise architecture standards, this implementation plan transforms Design Pulse into a Master Project Financial Ledger. It patches critical logical gaps, prevents UI lag, eliminates double-counting risks, and introduces a mathematically sound bridge between VE approvals and budget imports.

## Phase 1: Database Schema & RPC Upgrades (The Financial Bridge)

**Target:** `supabase_schema.sql`

* **Schema Additions (`opportunities`):** Add `estimate_sync_status` (text: 'Draft', 'Pending Estimate Update', 'Incorporated'), `incorporated_version_id` (uuid FK to `project_estimate_versions`), and `estimator_assignee` (text) to the `opportunities` table.
* **Automated Routing Update:** Update the `lock_opportunity_option` RPC. When an option is locked, atomically set `estimate_sync_status = 'Pending Estimate Update'` and route it to the Lead Estimator's queue.
* **The Master Ledger RPC:** Create a new `get_master_ledger_grid` RPC executing a high-performance `FULL OUTER JOIN` across Estimate Version A, Estimate Version B, and active/pending Opportunities. This returns pre-calculated rows (`cost_code`, `description`, `old_budget`, `new_budget`, `locked_ve`, `pending_ve`) directly to the frontend.
* **Waterfall Math Fix (Double-Count Prevention):** Update `get_project_budget_waterfall`. Instruct it to ignore the `cost_impact` of VE items where `incorporated_version_id` is equal to or older than the currently active baseline budget.
* **The True-Up Escape Hatch:** Create `reconcile_and_incorporate_opportunity(p_opp_id, p_version_id, p_realized_cost, p_note)`. This `SECURITY DEFINER` RPC must invoke `PERFORM set_config('designpulse.bypass_immutability', 'true', true)` to safely update locked options and insert an explicit `system_log` into `item_activity`.
* **Atomic Linking RPC:** Upgrade `finalize_estimate_version` to accept an optional `p_incorporated_ve_ids uuid[]`. It must atomically finalize the budget total AND mark the passed VE items as `'Incorporated'` under the new version ID.

## Phase 2: Data Merging & Structural Stability (The Grid Wrapper)

**Target:** `src/app/project/[projectId]/opportunities/v2/page.tsx`

* **Data Aggregation:** We will feed the grid using the new `get_master_ledger_grid` RPC, ensuring heavy variance math is offloaded to the server.
* **Stable Identity (AGENTS.md C10):** We will map the hybrid data into `AugmentedOpportunity` objects. To maintain structural sharing and prevent React unmounts during real-time updates, the generated IDs for budget-only rows must be strictly deterministic: `id: \`budget-${cost_code}\``.
* **The Math Trick:** Map `budget_amount` to `cost_impact`. TanStack Division Group Headers will automatically calculate the Net Waterfall position.
* **Filter Immunity (CRITICAL FIX):** The existing page filters (like `building_area` or `status`) will accidentally hide budget rows because budget lines don't possess these attributes. We must update the `filteredOpportunities` `useMemo` block to ensure `is_budget_line` rows are immune to non-applicable filters, otherwise the waterfall baseline will silently disappear, breaking the financial view.

## Phase 3: TanStack Table Safeguards & UI Enhancements

**Target:** `src/components/OpportunityGridV2.tsx` & `columns-v2.tsx` & `src/lib/constants.ts`

* **UI/UX Renaming:** Rename "Grid V2 (Proto)" to "Budget Ledger" in the sidebar navigation. Conditionally change the top-left grid label to "Master Budget Ledger".
* **Selection Isolation (CRITICAL FIX):** If a user attempts to "Batch Delete" rows, the API will attempt to delete `budget-${cost_code}`, causing mutation failures. We must add `enableRowSelection: (row) => !row.original.is_budget_line` to the `useReactTable` config to physically block TanStack from selecting them.
* **Visual Distinctions:** Render a `🏢 BUDGET` tag instead of the VE status pill. Mute the text slightly to indicate immutability.
* **Event Bubbling (AGENTS.md C16):** Ensure any new interactive elements in the budget rows do NOT use `e.stopPropagation()` on `onClick` events, preventing click-outside listener breakage.

## Phase 4: Progressive Import & "My Desk" Integration

**Target:** `src/components/project/ProjectEstimateTab.tsx` & `src/components/mydesk/MyDeskDashboard.tsx`

* **Optional Upload Tagging (Progressive Disclosure):** In the Procore Budget Import Staging step, add an optional checklist showing all VE items currently `Pending Estimate Update`. Users can check off incorporated items before hitting "Commit". Untagged items natively defer to My Desk.
* **Estimator's Inbox:** Add a "My Estimate Updates" mini-grid to `MyDeskDashboard.tsx`, fetching locked VE items where `estimator_assignee` matches the user and status is `Pending Estimate Update`.
* **Cache Invalidation:** Ensure the mutation `onSuccess` handlers explicitly invalidate both `['project-estimates']` and `['my-desk-tasks']` to maintain perfect sync without page reloads.

## Phase 5: Detail Panels & True-Up Workflows

**Target:** `src/components/DetailPanel.tsx`

* **Bypass Logic:** Update the master Detail Panel to intercept `selectedOpportunityId`. If it starts with `budget-`, it will bypass the VE form.
* **Granular Fetching:** The panel will extract the `cost_code` from the ID, and filter the cached `project_estimates` array to show the granular line items (Labor, Material, Subcontract, Equipment) that make up that cost code's total.
* **Panel Contents:** Display the Source Version (e.g., "From: 100% SD Estimate") and a mini-table of Cost Types.
* **Reconcile Action:** For VE Opportunities routed to the My Desk inbox, embed the "Reconcile Value" modal. It displays the read-only *Target Impact*, an editable *Realized Impact*, and a required *Variance Note* field, which triggers the `reconcile_and_incorporate_opportunity` RPC upon saving.