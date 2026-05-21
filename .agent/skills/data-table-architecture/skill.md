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

## Migration Checklist

When migrating a table to use shared components:

1. **Imports**: Add `CheckboxCell`, `CheckboxHeader`, `commonCellComparator` from `data-table/cells`. Add `BulkActionBar`, `DeleteConfirmModal`, `GhostRow`, `TableEmptyState` from `data-table`.
2. **Remove**: `AlertTriangle` import (handled by `DeleteConfirmModal`). Local `commonCellComparator` function. Local `CheckboxCell` / checkbox header JSX.
3. **Selection**: Replace Zustand `compareQueue` with TanStack `rowSelection` state. Remove `useEffect` auto-prune of stale IDs (TanStack local state handles this).
4. **Columns**: Replace inline checkbox column def with shared `CheckboxCell` / `CheckboxHeader`.
5. **Render**: Replace inline bulk action bar JSX → `<BulkActionBar>`. Replace inline delete modal JSX → `<DeleteConfirmModal>`. Replace domain-specific GhostRow → `<GhostRow>` with configuration props.
6. **Build**: Run `npx tsc --noEmit` to verify no type errors.

---

## Domain-Specific Cells (DO NOT Genericize)

Per architectural decision, the following cells remain in their original directories:

- **Value Matrix / Budget Ledger**: `EditableCell.tsx` (shared editable cells for VM), `ReadOnlyCell.tsx` (ledger-only financial cells), `OptionsCell.tsx`, `InlineOptionCell.tsx`
- **Coordination Board**: `CoordinationTable.tsx` inline cells (discipline status pills, MEP impact)
- **Permit Board**: `PermitTextCell`, `PermitDateCell`, `PermitStatusCell`, `PermitDropdownCell`, `PermitAssigneeCell`

These have domain-specific rendering logic (custom styling, conditional formatting, specialized validation) that doesn't map cleanly to generic cells.

---

## Guardrails

1. **`compareQueue` is deprecated and removed** — all grids use TanStack `rowSelection`. Do not re-introduce `compareQueue`.
2. **`gridMode` and `activeCell` are global singletons** — the system assumes only one table is actively navigated at a time.
3. **Column visibility/order slices** use per-project scoping (`Record<string, T>`). `gridV2ColumnVisibility` is the canonical key for Value Matrix and Budget Ledger.
4. **`enableRowSelection` function guards** are the canonical way to prevent budget lines, sub-rows, or other non-selectable rows from being checked. Never add manual guards inside `CheckboxCell`.
5. **Keep `extraActions` in `BulkActionBar`** for domain-specific buttons (Compare Options, Export, etc.) — do not fork the component.
6. **`OpportunityGridV2.tsx` is the unified grid** serving both Value Matrix (`isLedgerView=false`) and Budget Ledger (`isLedgerView=true`). There is no V1 grid.
