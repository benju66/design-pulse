# Data Table Architecture Skill

This skill applies when you are creating, modifying, or migrating any TanStack React Table data grid in the application. It documents the shared `data-table` component system, its API contracts, and migration guardrails.

## Component Inventory

All shared table components live in `src/components/data-table/`. Domain-specific cells remain in their original directories (e.g., `src/components/opportunities/ReadOnlyCell.tsx`).

### Core Components (`src/components/data-table/`)

| Component | File | Purpose |
|---|---|---|
| `DataTable<T>` | `DataTable.tsx` | Full wrapper: scroll container + `<table>` + virtualization + header + rows. Use when building a new table from scratch. |
| `TableHeader<T>` | `TableHeader.tsx` | Renders `<thead>` with sort indicators (▲/▼), column resizing handles, and pinned column styles. |
| `MemoizedRow<T>` | `MemoizedRow.tsx` | `React.memo` wrapper for `<tr>` with structural hash comparison (`visibleColumnIds`, `pinnedColumnOffsets`). |
| `GhostRow<T>` | `GhostRow.tsx` | "Quick add" row at table bottom. Generic — configurable via `placeholder`, `defaultValues`, and `staticFields` props. |
| `TableToolbar` | `TableToolbar.tsx` | Toolbar with search, column chooser button, filter button with active count badge. |
| `BulkActionBar` | `BulkActionBar.tsx` | Sticky bottom bar showing selection count, delete button, clear button, and `extraActions` slot. |
| `DeleteConfirmModal` | `DeleteConfirmModal.tsx` | Confirmation dialog with AlertTriangle icon, loading spinner, and configurable entity name. |
| `TableEmptyState` | `TableEmptyState.tsx` | Empty `<tr>` with configurable message, rendered inside `<tbody>`. |
| `TableLoadingState` | `TableLoadingState.tsx` | Spinner row for loading states. |

### Generic Cells (`src/components/data-table/cells/`)

| Cell | File | Purpose |
|---|---|---|
| `CellWrapper<T>` | `CellWrapper.tsx` | Singleton active-cell container with navigate/edit mode toggling. |
| `TextCell<T>` | `TextCell.tsx` | Editable text input with blur-save and Escape-cancel semantics. |
| `DateCell<T>` | `DateCell.tsx` | Date picker cell with `input[type=date]`. |
| `SelectCell<T>` | `SelectCell.tsx` | Dropdown cell with configurable options via `table.options.meta`. |
| `CheckboxCell` | `CheckboxCell.tsx` | TanStack-native `row.getToggleSelectedHandler()` checkbox. |
| `OpenPanelCell` | `OpenPanelCell.tsx` | Detail panel toggle button (PanelRight icon). |
| `CheckboxHeader` | `CheckboxCell.tsx` | TanStack-native select-all header checkbox. |
| `commonCellComparator` | `commonComparator.ts` | Shared `React.memo` comparator for cell-level memoization. |

---

## Import Patterns

```typescript
// Core layout components
import { DataTable, TableToolbar, BulkActionBar, DeleteConfirmModal, GhostRow, TableEmptyState } from '@/components/data-table';

// Generic cell components
import { TextCell, SelectCell, CheckboxCell, CheckboxHeader, commonCellComparator } from '@/components/data-table/cells';
```

---

## Row Selection Architecture

**Pattern: TanStack Native `rowSelection` (NOT Zustand `compareQueue`)**

All new and migrated tables MUST use TanStack's built-in row selection. The legacy Zustand `compareQueue` has been fully removed from `useUIStore` (deprecated with V1 `OpportunityGrid.tsx`).

### Setup

```typescript
const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

const table = useReactTable({
  // ...
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  enableRowSelection: true, // or a guard function
  getRowId: (row) => row.id,
});
```

### Deriving Selected IDs

Use **Option A: Derive at click time** — not a persistent derived memo:

```typescript
// For BulkActionBar count
const selectedIds = useMemo(
  () => Object.keys(rowSelection).filter(id => rowSelection[id]),
  [rowSelection]
);

// For Compare Modal — snapshot IDs when button is clicked
onOpenCompare={(ids) => { setCompareSelectedIds(ids); setIsCompareModalOpen(true); }}
```

### Budget Line Guard (Value Matrix)

The table already has `enableRowSelection: (row) => !row.original.is_budget_line`. TanStack handles the guard natively — no manual checkbox guard is needed. The shared `CheckboxCell` respects `row.getCanSelect()`.

### Clearing Selection

```typescript
const clearSelection = useCallback(() => setRowSelection({}), []);
```

---

## GhostRow Configuration

The shared `GhostRow` accepts domain-specific configuration via props:

```tsx
<GhostRow
  table={table}
  createMutation={createMutation}
  placeholder="Type new permit title and press Enter..."
  defaultValues={{
    status: 'Preparing',
    revision_number: 0,
    revision_history: [],
  }}
  staticFields={[
    { columnId: 'display_id', displayValue: 'New' },
  ]}
/>
```

- `placeholder`: Input placeholder text for the title column
- `defaultValues`: Partial record merged into the created row
- `staticFields`: Columns that show a static badge (e.g., "New") instead of an empty cell

---

## BulkActionBar with Extra Actions

The Value Matrix uses the `extraActions` slot for the "Compare Options" button:

```tsx
<BulkActionBar
  selectedCount={selectedIds.length}
  entityLabel="Options"
  onClear={clearSelection}
  onDelete={() => setIsDeleteModalOpen(true)}
  canDelete={permissions.can_delete_records}
  extraActions={
    <button onClick={() => onOpenCompare(selectedIds)}>
      Compare Options
    </button>
  }
/>
```

---

## Bulk Operations & Status Transitions

When extending the `BulkActionBar` with batch mutations (such as bulk state updates, assignments, or custom tagging):

1. **Contextual Action Injection**: Render custom dropdown menus or buttons strictly inside the `extraActions` render slot. Never modify the core `<BulkActionBar>` wrapper directly.
2. **Transaction Integrity & Pre-Flight Checks**:
   - Filter or separate locked records (e.g. Approved rows with immutable financial fields) on the client before initiating queries.
   - Display a warning notification (toast) informing the user of any items that were skipped or blocked by validation criteria.
3. **Double-Submission prevention**:
   - Ensure all bulk buttons are disabled programmatically while mutations are active (`disabled={isBatchPending}`).
   - Show a visual loading indicator or spinner to indicate background updates are in progress.
4. **Post-Mutation viewport Reset**:
   - On successful transaction completion, clear the active selection (`setRowSelection({})`) to reset the table viewport and slide the bulk action bar away.

---

## Migration Checklist

When migrating a table to use shared components:

1. **Imports**: Add `CheckboxCell`, `CheckboxHeader`, `commonCellComparator` from `data-table/cells`. Add `BulkActionBar`, `DeleteConfirmModal`, `GhostRow`, `TableEmptyState` from `data-table`.
2. **Remove**: `AlertTriangle` import (handled by `DeleteConfirmModal`). Local `commonCellComparator` function. Local `CheckboxCell` / checkbox header JSX.
3. **Selection**: Replace Zustand `compareQueue` with TanStack `rowSelection` state. Remove `useEffect` auto-prune of stale IDs (TanStack local state handles this).
4. **Columns**: Replace inline checkbox column def with shared `CheckboxCell` / `CheckboxHeader`.
5. **Render**: Replace inline bulk action bar JSX → `<BulkActionBar>`. Replace inline delete modal JSX → `<DeleteConfirmModal>`. Replace domain-specific GhostRow → `<GhostRow>` with configuration props.
6. **Build**: Run `npx tsc --noEmit` to verify no type errors.

---

## Unified Grid Aesthetics, Pinning, and Spacing Standards

To guarantee a premium, visually-consistent, and ultra-high-performance SaaS layout across all workspaces, the application mandates a unified set of layout, spacing, and structural corner aesthetics.

### 1. Spacing & The Vertical Layout Runway
* **The Margin Standard**: To prevent visual overlap and keep a clean hierarchy, all workspace pages containing a summary dashboard (analytics) and a table log (grid) MUST separate them with a standard **16px (1rem)** vertical gap.
* **The Implementation**: Always wrap the summary component inside a `<div className="shrink-0 mb-4">` container. This is standard across:
  - Value Matrix (`ValueMatrixView.tsx` wraps `BudgetSummary`)
  - Coordination Board (`CoordinationView.tsx` wraps `CoordinationSummary`)
  - Budget Ledger (`BudgetLedgerView.tsx` wraps `BudgetSummaryV2`)
  - Permit Board (`PermitBoard.tsx` wraps `PermitSummary`)

### 2. Table Corner Shape Standardization
* **The Standard**: All table grid containers MUST feature **structurally square 90-degree top corners** and **rounded bottom corners (`rounded-b-xl`)**.
* **The Outer Card Wrapper**: Apply `rounded-b-xl` instead of `rounded-xl` on the outer parent card div.
* **The Toolbar & Overflow**: 
  - Remove `rounded-t-xl` from the top child toolbar container (or from `.dt-toolbar` class in `globals.css`).
  - Do NOT apply `overflow-hidden` to the outermost parent table card wrapper. This prevents absolute-positioned selectors and popovers (such as assignee dropdowns or CSI spec pickers) from being clipped at the boundaries of virtualized rows. The grid viewport (`<DataTable>`) has its own `rounded-b-xl` to clip table body scrollbars correctly at the bottom.

### 3. Toolbar Search & Title Standardization
* **The Standard**: All tables MUST display a bold title label on the left-most side of the toolbar, immediately followed by the search input (`w-64`) and a vertical divider line.
* **Shared `TableToolbar` Mappings**: For tables using the shared `<TableToolbar>` component (e.g. Deliverables & Key Dates), do not write custom markup. Instead, pass the standard title label and divider through the `leadingSlot` prop:
  ```tsx
  leadingSlot={
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">Deliverables List</span>
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mr-2" />
    </div>
  }
  ```

### 4. Column Pinning State Management & Overrides
* **Table Config Binding**: All grids supporting selection, status, or split drawers must pass the dynamic pinning slice inside their core TanStack configuration:
  ```typescript
  const table = useReactTable({
    state: { columnPinning, ... },
    onColumnPinningChange: setColumnPinning, // optional override
    ...
  });
  ```
* **Store Persistence**: Custom user column pinning overrides are persisted globally inside the Zustand store (`useUIStore.ts`) under the project-scoped slice `gridColumnPinningOverrides[projectId]`.
* **Structural Pinned Columns**: Baseline system-locked columns (`['select', 'open_panel']` for standard grids; `['select', 'open_panel', 'item_definition']` for budget ledger grids) are always pinned to the left by default.

### 2. Core Primitives Pinning Layouts
Column pinning math and styling is compiled natively within the shared layout layer:

* **Sticky Headers (`TableHeader.tsx`)**:
  The shared header compiler must check if a column is pinned:
  ```typescript
  const isPinned = header.column.getIsPinned() === 'left';
  const isLastPinned = isPinned && header.column.getIsLastColumn('left');
  ```
  If pinned, apply sticky positioning, horizontal scroll offset coordinates, and the global rail shadow separator:
  - Pinned Tailwind classes: `sticky z-30 bg-slate-100 dark:bg-slate-900 bg-clip-padding`
  - Offset style: `style={{ left: header.column.getStart('left') }}`
  - Edge Separator style: `${isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2' : ''}`

* **Sticky Row Cells (`MemoizedRow.tsx` / Custom Rows)**:
  Body cells must automatically follow the header's sticky coordinates:
  ```typescript
  const isPinned = cell.column.getIsPinned() === 'left';
  const isLastPinned = isPinned && cell.column.getIsLastColumn('left');
  ```
  If pinned, render the cell stickily:
  - Pinned Tailwind classes: `sticky z-10 bg-white dark:bg-slate-900 bg-clip-padding group-hover:bg-slate-100 dark:group-hover:bg-slate-800`
  - Offset style: `style={{ left: cell.column.getStart('left') }}`
  - Edge Separator style: `${isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2' : ''}`

* **Row Hover Standard**:
  All data rows (`<tr>`) MUST include a visible hover highlight and the `group` class for pinned cell propagation:
  - `<tr>` classes: `group transition-colors hover:bg-slate-100 dark:hover:bg-slate-800`
  - Pinned `<td>` classes MUST include `group-hover:bg-slate-100 dark:group-hover:bg-slate-800` (as listed above) so the hover highlight covers the full row width including sticky columns. Without this, pinned cells stay `bg-white` on hover because their explicit background overrides the `<tr>` hover.
  - **Do NOT use `hover:bg-slate-50`** — the contrast against `bg-white` containers is imperceptible (`#f8fafc` vs `#ffffff`). `slate-100` (`#f1f5f9`) is the minimum visible threshold.
  - Conditional row states (selected, budget variance bands, incorporated) should use their own hover colors in their ternary branch and do not need `slate-100`.
  - Tables using scoped `group/row` naming (e.g., DrawingGrid) should use `group-hover/row:bg-slate-100 dark:group-hover/row:bg-slate-800` on pinned cells instead.

### 3. Rendering Performance & Row Comparator Contract
* **The Render Gate**: Virtualized lists stutter or fail to reposition sticky cells when column overrides update if row comparators prevent re-renders. 
* **The Comparator Standard**: All custom row comparators (and the generic `defaultRowComparator`) MUST include visibility and pinning offsets hashes:
  ```typescript
  export interface MemoizedRowProps<TData> {
    row: Row<TData>;
    isSelected?: boolean;
    visibleColumnIds?: string;       // Joined column IDs e.g. "select,display_id,title"
    pinnedColumnOffsets?: string;    // Joined coordinate offsets e.g. "0,45,85"
    // ...
  }

  function defaultRowComparator<TData>(prev: MemoizedRowProps<TData>, next: MemoizedRowProps<TData>): boolean {
    if (prev.row.original !== next.row.original) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.className !== next.className) return false;
    if (prev.visibleColumnIds !== next.visibleColumnIds) return false;
    if (prev.pinnedColumnOffsets !== next.pinnedColumnOffsets) return false;
    return true;
  }
  ```

---

## Domain-Specific Cells (DO NOT Genericize)

Per architectural decision, the following cells remain in their original directories:

- **Value Matrix / Budget Ledger**: `EditableCell.tsx` (shared editable cells for VM), `ReadOnlyCell.tsx` (ledger-only financial cells), `OptionsCell.tsx`, `InlineOptionCell.tsx`
- **Coordination Board**: `CoordinationTable.tsx` inline cells (discipline status pills, MEP impact)
- **Permit Board**: `PermitTextCell`, `PermitDateCell`, `PermitStatusCell`, `PermitDropdownCell`, `PermitAssigneeCell`

These have domain-specific rendering logic (custom styling, conditional formatting, specialized validation) that doesn't map cleanly to generic cells.

---

## Details Panel Split View & Toggle Standards

All data grids supporting split view detailing (e.g., Value Matrix) must implement the following standards for details toggling and responsive sidebars:

### 1. Toggle Column and Trigger Cell (`open_panel`)
* **Conditional Injection**: The `open_panel` column MUST only be injected and rendered in the grid column definitions when `viewMode === 'split'`. In full-screen views (e.g. `flat` or standard table-boards), this column must be fully excluded.
* **Cell Component**: Use `OpenPanelCell` with the Lucide `PanelRight` icon trigger.
* **State Hook**: The cell must sync with the active UI store:
  ```typescript
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  ```
* **Event Isolation**: Inside the click handler, execute `e.stopPropagation()` immediately to prevent grid-level row selection overrides or active-cell bubble indicators.
* **Dynamic Active Styling**:
  * **Active (Open)**: Render with clear primary sky color: `text-sky-500 bg-sky-50 dark:bg-sky-900/30`.
  * **Inactive (Closed)**: Render with neutral gray shifting to sky color on hover: `text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30`.

### 2. Side Panel Container and Controls (`DetailPanel.tsx`)
* **Conditional Collapse**: The sidebar component must check:
  ```typescript
  if (viewMode !== 'split' || !selectedOpportunityId) return null;
  ```
* **Col-Resize Handle**: Render an absolute left-aligned handle bar (`cursor-col-resize`) that computes dragging percentages relative to window size. The panel size must be constrained between **20% and 80%** of the screen width to preserve interface responsiveness.
* **Maximize/Restore Controls**: Include a maximize icon button toggling `isMaximized`. When maximized, apply absolute full-screen overlays:
  ```css
  absolute top-0 bottom-0 right-0 w-full z-50 transition-all duration-300
  ```
* **Keyboard Accessibility**: The side drawer container must listen to keydown events. Pressing `Escape` must close the panel (`setSelectedOpportunityId(null)`), cancel maximization, and automatically return active focus back to the grid container element (`opportunity-grid-v2-container`) for keyboard grid navigation.
* **Dismiss Actions**: Use Lucide `X` for close triggers styled with warn-transitions: `hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30`.
* **Polished Shadows**: Sidebars must drop clear inner shadow dividers: `shadow-[rgba(0,0,0,0.1)_-4px_0px_10px_0px] border-l border-slate-200 dark:border-slate-800`.

---

## Guardrails

1. **`compareQueue` is deprecated and removed** — all grids use TanStack `rowSelection`. Do not re-introduce `compareQueue`.
2. **`gridMode` and `activeCell` are global singletons** — the system assumes only one table is actively navigated at a time.
3. **Column visibility/order slices** use per-project scoping (`Record<string, T>`). `gridV2ColumnVisibility` is the canonical key for Value Matrix and Budget Ledger.
4. **`enableRowSelection` function guards** are the canonical way to prevent budget lines, sub-rows, or other non-selectable rows from being checked. Never add manual guards inside `CheckboxCell`.
5. **Keep `extraActions` in `BulkActionBar`** for domain-specific buttons (Compare Options, Export, etc.) — do not fork the component.
6. **`OpportunityGridV2.tsx` is the unified grid** serving both Value Matrix (`isLedgerView=false`) and Budget Ledger (`isLedgerView=true`). There is no V1 grid.
7. **Details panel split views** must use the `open_panel` column with Lucide `PanelRight` only when in `split` view mode and ensure keyboard focus is returned to the grid container on `Escape`.
