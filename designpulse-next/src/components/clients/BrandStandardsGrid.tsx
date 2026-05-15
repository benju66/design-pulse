"use client";
import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Search, Paperclip } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
} from '@tanstack/react-table';
import { ClientBrandStandard } from '@/types/models';
import {
  useBrandStandards,
  useCreateBrandStandard,
  useUpdateBrandStandard,
  useDeleteBrandStandard,
  useClientDocuments,
} from '@/hooks/useClientQueries';
import { SmartCostCodeCombobox } from '@/components/ui/SmartCostCodeCombobox';
import { useCostCodes } from '@/hooks/useGlobalQueries';

interface BrandStandardsGridProps {
  clientId: string;
  canEdit: boolean;
}

// ── Inline Editable Cell ─────────────────────────────────────────────────────
function EditableTextCell({
  value,
  onSave,
  disabled,
  placeholder,
}: {
  value: string;
  onSave: (val: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div
        onClick={() => { if (!disabled) { setDraft(value); setEditing(true); } }}
        className={`px-2 py-1 text-xs min-h-[28px] flex items-center truncate ${
          disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
        } ${!value ? 'text-slate-400 italic' : 'text-slate-800 dark:text-slate-100'}`}
      >
        {value || placeholder || '—'}
      </div>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
        setEditing(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') { setDraft(value); setEditing(false); } // C18: cancel
        if (e.key === 'Enter') { e.currentTarget.blur(); }
      }}
      className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-sky-400 rounded outline-none ring-2 ring-sky-500/20 text-slate-900 dark:text-white"
      placeholder={placeholder}
    />
  );
}

// ── Category Cell (dropdown + free text) ─────────────────────────────────────
function CategoryCell({
  value,
  onSave,
  disabled,
  existingCategories,
}: {
  value: string | null;
  onSave: (val: string | null) => void;
  disabled: boolean;
  existingCategories: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  if (!editing) {
    return (
      <div
        onClick={() => { if (!disabled) { setDraft(value || ''); setEditing(true); } }}
        className={`px-2 py-1 text-xs min-h-[28px] flex items-center ${
          disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
      >
        {value ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {value}
          </span>
        ) : (
          <span className="text-slate-400 italic">Set…</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        autoFocus
        list="category-suggestions"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim() || null;
          if (trimmed !== value) onSave(trimmed);
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
          if (e.key === 'Enter') { e.currentTarget.blur(); }
        }}
        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-sky-400 rounded outline-none ring-2 ring-sky-500/20 text-slate-900 dark:text-white"
        placeholder="e.g. Finishes"
      />
      <datalist id="category-suggestions">
        {existingCategories.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  );
}

const columnHelper = createColumnHelper<ClientBrandStandard>();

export function BrandStandardsGrid({ clientId, canEdit }: BrandStandardsGridProps) {
  const { data: standards = [], isLoading } = useBrandStandards(clientId);
  const { data: allDocuments = [] } = useClientDocuments(clientId);
  const { data: rawCostCodes = [] } = useCostCodes();
  const createStandard = useCreateBrandStandard();
  const updateStandard = useUpdateBrandStandard(clientId);
  const deleteStandard = useDeleteBrandStandard(clientId);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Pre-compute document counts per standard for the attachment badge
  const attachmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of allDocuments) {
      if (doc.brand_standard_id) {
        counts[doc.brand_standard_id] = (counts[doc.brand_standard_id] || 0) + 1;
      }
    }
    return counts;
  }, [allDocuments]);

  // Derive unique categories from existing standards for autocomplete
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of standards) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set).sort();
  }, [standards]);

  // Filtered data
  const filteredData = useMemo(() => {
    let result = standards;
    if (categoryFilter) {
      result = result.filter(s => s.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.standard_description.toLowerCase().includes(q) ||
        (s.cost_code && s.cost_code.toLowerCase().includes(q)) ||
        (s.normalized_csi_number && s.normalized_csi_number.toLowerCase().includes(q))
      );
    }
    return result;
  }, [standards, categoryFilter, searchQuery]);

  const handleUpdate = useCallback((id: string, updates: Record<string, unknown>) => {
    updateStandard.mutate({ id, updates });
  }, [updateStandard]);

  const handleDelete = useCallback((id: string) => {
    deleteStandard.mutate(id);
  }, [deleteStandard]);

  const handleAddStandard = () => {
    createStandard.mutate({
      id: crypto.randomUUID(), // C8: client-minted UUID
      client_id: clientId,
      standard_description: 'New Standard',
      category: categoryFilter || null,
    });
  };

  const columns = useMemo<ColumnDef<ClientBrandStandard, unknown>[]>(() => [
    columnHelper.accessor('standard_description', {
      header: 'Description',
      size: 280,
      cell: ({ row }) => (
        <EditableTextCell
          value={row.original.standard_description}
          onSave={val => handleUpdate(row.original.id, { standard_description: val })}
          disabled={!canEdit}
          placeholder="Standard description…"
        />
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      size: 130,
      cell: ({ row }) => (
        <CategoryCell
          value={row.original.category}
          onSave={val => handleUpdate(row.original.id, { category: val })}
          disabled={!canEdit}
          existingCategories={existingCategories}
        />
      ),
    }),
    columnHelper.accessor('cost_code', {
      header: 'Cost Code',
      size: 200,
      cell: ({ row }) => (
        <SmartCostCodeCombobox
          value={row.original.cost_code}
          mode="cost_code_only"
          onChange={updates => {
            handleUpdate(row.original.id, {
              cost_code: updates.cost_code ?? null,
              ...(updates.division ? { division: updates.division } : {}),
            });
          }}
          rawCostCodes={rawCostCodes}
          disabled={!canEdit}
          showCostTypeSegment={false} // C30: grid cells never show segmented control
        />
      ),
    }),
    columnHelper.accessor('normalized_csi_number', {
      header: 'CSI Code',
      size: 120,
      cell: ({ row }) => (
        <EditableTextCell
          value={row.original.normalized_csi_number || ''}
          onSave={val => handleUpdate(row.original.id, { normalized_csi_number: val || null })}
          disabled={!canEdit}
          placeholder="e.g. 09 65 16"
        />
      ),
    }),
    columnHelper.display({
      id: 'attachments',
      header: () => <span title="Attachments"><Paperclip size={14} /></span>,
      size: 60,
      cell: ({ row }) => {
        const count = attachmentCounts[row.original.id] || 0;
        return (
          <div className="flex items-center justify-center">
            <span title={`${count} attachment${count !== 1 ? 's' : ''}`} className="relative">
              <Paperclip size={14} className={count > 0 ? 'text-sky-500' : 'text-slate-300 dark:text-slate-600'} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-2 text-[9px] font-bold bg-sky-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {count}
                </span>
              )}
            </span>
          </div>
        );
      },
    }),
    ...(canEdit ? [columnHelper.display({
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }: { row: { original: ClientBrandStandard } }) => (
        <button
          onClick={() => handleDelete(row.original.id)}
          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Remove standard"
        >
          <Trash2 size={14} />
        </button>
      ),
    })] : []),
  ] as ColumnDef<ClientBrandStandard, unknown>[], [canEdit, existingCategories, rawCostCodes, attachmentCounts, handleUpdate, handleDelete]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: {
      onUpdateBrandStandard: (params: { id: string; updates: Record<string, unknown> }) => handleUpdate(params.id, params.updates),
      onDeleteBrandStandard: handleDelete,
    },
  });

  if (isLoading) {
    return (
      <div className="animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 w-full bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-4">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search standards…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-900 dark:text-white"
              />
            </div>
            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  !categoryFilter
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All ({standards.length})
              </button>
              {existingCategories.map(cat => {
                const count = standards.filter(s => s.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      categoryFilter === cat
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          {canEdit && (
            <button
              onClick={handleAddStandard}
              disabled={createStandard.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-colors disabled:opacity-50 shrink-0"
            >
              <Plus size={16} /> Add Standard
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Paperclip size={20} className="text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold mb-1">
              {standards.length === 0 ? 'No brand standards yet' : 'No matching standards'}
            </p>
            <p className="text-slate-400 text-sm max-w-sm">
              {standards.length === 0
                ? 'Add your first brand standard to define material and finish requirements for this client.'
                : 'Try adjusting your search or category filter.'}
            </p>
            {canEdit && standards.length === 0 && (
              <button
                onClick={handleAddStandard}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-colors"
              >
                <Plus size={16} /> Add First Standard
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className="px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 first:pl-4"
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="group border-b border-slate-100 dark:border-slate-800/50 hover:bg-sky-50/30 dark:hover:bg-sky-900/10 transition-colors"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="first:pl-4"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
