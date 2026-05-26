'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Table } from '@tanstack/react-table';

/**
 * Generic GhostRow — inline "create new record" row at the bottom of a DataTable.
 *
 * Extracted from 3 near-identical implementations (~90 lines each):
 *   - GhostRow.tsx (Opportunities) — includes validation flash + autoFocus
 *   - CoordinationGhostRow.tsx — same structure, different defaults
 *   - PermitGhostRow.tsx — same structure, different defaults
 *
 * Pattern preserved:
 * - Renders a <tr> matching the table's visible leaf columns
 * - Special-case columns: select (Plus icon), display_id ("New"), title (input)
 * - All other columns render disabled dashes
 * - Enter commits, input clears for quick-entry
 */

export interface GhostRowField {
  /** Column id this default applies to */
  columnId: string;
  /** Static display value for the ghost row */
  displayValue?: string;
}

export interface GhostRowProps<TData> {
  table: Table<TData>;
  /** Mutation for creating new records */
  createMutation: {
    mutate: (data: Record<string, unknown>) => void;
    isPending: boolean;
  };
  /** Default values to include with every new record */
  defaultValues?: Record<string, unknown>;
  /** The column id that contains the title/primary input */
  titleColumnId?: string;
  /** Placeholder text for the title input */
  placeholder?: string;
  /** Static display fields (e.g., display_id → "New", record_type → "Coordination") */
  staticFields?: GhostRowField[];
  /** Called after successful submit with the value. Return false to prevent clear. */
  onSubmit?: (title: string) => Record<string, unknown> | false;
  /** Custom validation — return error message or undefined */
  validate?: (title: string) => string | undefined;
}

export function GhostRow<TData>({
  table,
  createMutation,
  defaultValues = {},
  titleColumnId = 'title',
  placeholder,
  staticFields = [],
  onSubmit,
  validate,
}: GhostRowProps<TData>) {
  const [title, setTitle] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>();
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Re-focus input after mutation completes
  useEffect(() => {
    if (!createMutation.isPending && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [createMutation.isPending]);

  const submitData = () => {
    if (!title.trim() || createMutation.isPending) return;

    // Optional validation
    if (validate) {
      const error = validate(title.trim());
      if (error) {
        setValidationError(error);
        setTimeout(() => setValidationError(undefined), 2000);
        return;
      }
    }

    // Let consumer build the full payload, or use defaults
    if (onSubmit) {
      const result = onSubmit(title.trim());
      if (result === false) return;
      createMutation.mutate(result);
    } else {
      createMutation.mutate({
        id: crypto.randomUUID(),
        [titleColumnId]: title.trim(),
        ...defaultValues,
      });
    }
    setTitle('');
    setValidationError(undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (title.trim()) {
        e.preventDefault();
        submitData();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitle('');
      setValidationError(undefined);
      if (titleInputRef.current) titleInputRef.current.blur();
    }
  };

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const staticFieldMap = new Map(staticFields.map((f) => [f.columnId, f.displayValue]));

  const defaultPlaceholder = createMutation.isPending
    ? 'Saving new item...'
    : placeholder ?? 'Type new item and press Enter...';

  return (
    <tr className="dt-ghost-row border-t-2 border-dashed">
      {visibleLeafColumns.map((col) => {
        // Select column → Plus icon
        if (col.id === 'select') {
          return (
            <td key={col.id} className="px-2 border-r border-slate-200 dark:border-slate-800 text-center">
              <Plus size={16} className="text-slate-400 dark:text-slate-500 mx-auto" />
            </td>
          );
        }

        // Open panel column → empty
        if (col.id === 'open_panel') {
          return (
            <td key={col.id} className="px-2 border-r border-slate-200 dark:border-slate-800" />
          );
        }

        // Static display fields (display_id, record_type, etc.)
        if (staticFieldMap.has(col.id)) {
          return (
            <td key={col.id} className="px-2 py-1 text-sm text-slate-400 dark:text-slate-500 font-mono border-r border-slate-200 dark:border-slate-800">
              {staticFieldMap.get(col.id)}
            </td>
          );
        }

        // Title/primary input column
        if (col.id === titleColumnId) {
          return (
            <td key={col.id} className={`p-0 border-r border-slate-200 dark:border-slate-800 relative ${validationError ? 'dt-ghost-row-validation-error' : ''}`}>
              <div className="relative flex items-center w-full h-full">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={createMutation.isPending}
                  placeholder={defaultPlaceholder}
                  className="dt-ghost-row-input focus:ring-2 focus:ring-sky-500 focus:z-10 relative text-slate-900 dark:text-slate-100 placeholder:italic disabled:opacity-50 pr-16 w-full h-full border-none outline-none bg-transparent"
                />
                {title.trim() && !createMutation.isPending && (
                  <div className="absolute right-2 flex items-center gap-1.5 z-20">
                    <button
                      type="button"
                      onClick={submitData}
                      className="p-1 bg-sky-500 hover:bg-sky-600 text-white rounded shadow-sm transition-colors cursor-pointer flex items-center justify-center border-none"
                      title="Save Item"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTitle('');
                        setValidationError(undefined);
                        if (titleInputRef.current) titleInputRef.current.focus();
                      }}
                      className="p-1 bg-slate-200 hover:bg-rose-500 text-slate-500 hover:text-white rounded shadow-sm transition-colors cursor-pointer flex items-center justify-center border-none"
                      title="Clear Input"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </td>
          );
        }

        // All other columns → disabled dash
        return (
          <td key={col.id} className="p-0 border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/20">
            <div className="w-full h-full px-2 py-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed">
              --
            </div>
          </td>
        );
      })}
    </tr>
  );
}
