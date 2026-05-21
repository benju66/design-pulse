"use client";
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Search, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
  SortingState,
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
import { SmartCsiCombobox } from '@/components/ui/SmartCsiCombobox';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useCompanyCsiDefaults } from '@/hooks/useCompanyCsiQueries';
import { useProjects } from '@/hooks/useProjectCoreQueries';
import { useUIStore } from '@/stores/useUIStore';
import { BrandStandardsColumnChooser } from './BrandStandardsColumnChooser';

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
  autoEdit,
  onBlurAction,
}: {
  value: string;
  onSave: (val: string) => void;
  disabled: boolean;
  placeholder?: string;
  autoEdit?: boolean;
  onBlurAction?: () => void;
}) {
  const [editing, setEditing] = useState(autoEdit || false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (autoEdit && !disabled) {
      setEditing(true);
      setDraft(value);
    }
  }, [autoEdit, disabled, value]);

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
        if (onBlurAction) onBlurAction();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') { 
          setDraft(value); 
          setEditing(false); 
          if (onBlurAction) onBlurAction();
        } // C18: cancel
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

const DescriptionCell = ({ row, table }: any) => {
  const { canEdit, newlyCreatedId, setNewlyCreatedId, onUpdateBrandStandard } = table.options.meta;
  return (
    <EditableTextCell
      value={row.original.standard_description}
      onSave={val => onUpdateBrandStandard({ id: row.original.id, updates: { standard_description: val } })}
      disabled={!canEdit}
      placeholder="New Standard"
      autoEdit={row.original.id === newlyCreatedId}
      onBlurAction={() => {
        if (row.original.id === newlyCreatedId) {
          setNewlyCreatedId(null);
        }
      }}
    />
  );
};

const CategoryCellRenderer = ({ row, table }: any) => {
  const { canEdit, existingCategories, onUpdateBrandStandard } = table.options.meta;
  return (
    <CategoryCell
      value={row.original.category}
      onSave={val => onUpdateBrandStandard({ id: row.original.id, updates: { category: val } })}
      disabled={!canEdit}
      existingCategories={existingCategories}
    />
  );
};

const CostCodeCell = ({ row, table }: any) => {
  const { canEdit, rawCostCodes, onUpdateBrandStandard } = table.options.meta;
  return (
    <SmartCostCodeCombobox
      value={row.original.cost_code}
      mode="cost_code_only"
      onChange={updates => {
        onUpdateBrandStandard({
          id: row.original.id, 
          updates: {
            cost_code: updates.cost_code ?? null,
            ...(updates.division ? { division: updates.division } : {}),
          }
        });
      }}
      rawCostCodes={rawCostCodes}
      disabled={!canEdit}
      showCostTypeSegment={false}
    />
  );
};

const DivisionCell = ({ row, table }: any) => {
  const { canEdit, rawCostCodes, onUpdateBrandStandard } = table.options.meta;
  const divisions = rawCostCodes.filter((c: any) => c.is_division);
  const value = row.original.division || '';

  if (!canEdit) {
    const div = divisions.find((d: any) => d.code === value);
    return (
      <div className="px-2 py-1 text-xs text-slate-700 dark:text-slate-200 truncate">
        {div ? div.description : (value || '—')}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => {
        const val = e.target.value || null;
        onUpdateBrandStandard({ id: row.original.id, updates: { division: val } });
      }}
      className="w-full h-full px-2 py-1 text-xs bg-transparent border-none focus:ring-0 focus:outline-none text-slate-900 dark:text-slate-100"
    >
      <option value="">—</option>
      {divisions.map((d: any) => (
        <option key={d.code} value={d.code}>
          {d.code} - {d.description}
        </option>
      ))}
    </select>
  );
};

const CsiCell = ({ row, table }: any) => {
  const { canEdit, companyCsiDefaults, onUpdateBrandStandard } = table.options.meta;
  return (
    <SmartCsiCombobox
      value={row.original.normalized_csi_number || ''}
      companyDefaults={companyCsiDefaults}
      onChange={selection => {
        const updates: Record<string, unknown> = {
          normalized_csi_number: selection.normalized_csi_number || null,
        };
        if (!row.original.cost_code && selection.cost_code) {
          updates.cost_code = selection.cost_code;
        }
        onUpdateBrandStandard({ id: row.original.id, updates });
      }}
      disabled={!canEdit}
    />
  );
};

const DateAddedCell = ({ row }: any) => {
  const date = new Date(row.original.created_at);
  return (
    <div className="px-2 py-1 text-[11px] text-slate-500 truncate">
      {date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
    </div>
  );
};

const SourceProjectCell = ({ row, table }: any) => {
  const { canEdit, clientProjects, onUpdateBrandStandard } = table.options.meta;
  const value = row.original.source_project_id || '';
  
  if (!canEdit) {
    const proj = clientProjects.find((p: any) => p.id === value);
    return (
      <div className="px-2 py-1 text-xs text-slate-700 dark:text-slate-200 truncate">
        {proj ? proj.project_name : '—'}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => {
        const val = e.target.value || null;
        onUpdateBrandStandard({ id: row.original.id, updates: { source_project_id: val } });
      }}
      className="w-full px-2 py-1 text-xs bg-transparent border-0 focus:ring-2 focus:ring-sky-500 rounded outline-none text-slate-900 dark:text-white dark:bg-slate-900 appearance-none cursor-pointer"
      title="Select Source Project"
    >
      <option value="">None</option>
      {clientProjects.map((p: any) => (
        <option key={p.id} value={p.id}>
          {p.project_settings?.[0]?.project_name || p.name || 'Unnamed Project'}
        </option>
      ))}
    </select>
  );
};

const AttachmentsCell = ({ row, table }: any) => {
  const { attachmentCounts } = table.options.meta;
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
};

const ActionsCell = ({ row, table }: any) => {
  const { onDeleteBrandStandard } = table.options.meta;
  return (
    <button
      onClick={() => onDeleteBrandStandard(row.original.id)}
      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
      title="Remove standard"
    >
        <Trash2 size={14} />
    </button>
  );
};

const EMPTY_VISIBILITY = {};
const EMPTY_ORDER: string[] = [];

export function BrandStandardsGrid({ clientId, canEdit }: BrandStandardsGridProps) {
  const { data: standards = [], isLoading } = useBrandStandards(clientId);
  const { data: allDocuments = [] } = useClientDocuments(clientId);
  const { data: rawCostCodes = [] } = useCostCodes();
  const { data: companyCsiDefaults = [] } = useCompanyCsiDefaults();
  const { data: allProjects = [] } = useProjects();
  
  // Filter projects to only those associated with this client
  const clientProjects = useMemo(() => allProjects.filter(p => p.client_id === clientId), [allProjects, clientId]);
  
  const { mutate: createMutate, isPending: isCreatePending } = useCreateBrandStandard();
  const { mutate: updateMutate } = useUpdateBrandStandard(clientId);
  const { mutate: deleteMutate } = useDeleteBrandStandard(clientId);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

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
    updateMutate({ id, updates });
  }, [updateMutate]);

  const handleDelete = useCallback((id: string) => {
    deleteMutate(id);
  }, [deleteMutate]);

  const handleAddStandard = () => {
    const newId = crypto.randomUUID();
    setNewlyCreatedId(newId);
    createMutate({
      id: newId, // C8: client-minted UUID
      client_id: clientId,
      standard_description: '', // Empty string for ghost text placeholder
      category: categoryFilter || null,
    });
  };

  const columns = useMemo<ColumnDef<ClientBrandStandard, unknown>[]>(() => {
    const cols = [
      columnHelper.accessor('created_at', {
        header: 'Date Added',
        size: 90,
        cell: DateAddedCell,
      }),
      columnHelper.accessor('standard_description', {
        header: 'Description',
        size: 280,
        cell: DescriptionCell,
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        size: 130,
        cell: CategoryCellRenderer,
      }),
      columnHelper.accessor('cost_code', {
        header: 'Cost Code',
        size: 200,
        cell: CostCodeCell,
      }),
      columnHelper.accessor('division', {
        header: 'Division',
        size: 150,
        cell: DivisionCell,
      }),
      columnHelper.accessor('normalized_csi_number', {
        header: 'CSI Code',
        size: 120,
        cell: CsiCell,
      }),
      columnHelper.accessor('source_project_id', {
        header: 'Source Project',
        size: 160,
        cell: SourceProjectCell,
      }),
      columnHelper.display({
        id: 'attachments',
        header: () => <span title="Attachments"><Paperclip size={14} /></span>,
        size: 60,
        cell: AttachmentsCell,
      }),
    ];
    if (canEdit) {
      cols.push(columnHelper.display({
        id: 'actions',
        header: '',
        size: 50,
        cell: ActionsCell,
      }));
    }
    return cols as ColumnDef<ClientBrandStandard, unknown>[];
  }, [canEdit]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const columnVisibility = useUIStore(state => state.brandStandardsColumnVisibility[clientId] || EMPTY_VISIBILITY);
  const setColumnVisibility = useUIStore(state => state.setBrandStandardsColumnVisibility);
  const columnOrder = useUIStore(state => state.brandStandardsColumnOrder[clientId] || EMPTY_ORDER);
  const setColumnOrder = useUIStore(state => state.setBrandStandardsColumnOrder);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => setColumnVisibility(clientId, updater),
    onColumnOrderChange: (updater) => setColumnOrder(clientId, updater),
    columnResizeMode: 'onChange',
    getRowId: row => row.id, // Stable row IDs
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: {
      onUpdateBrandStandard: (params: { id: string; updates: Record<string, unknown> }) => handleUpdate(params.id, params.updates),
      onDeleteBrandStandard: handleDelete,
      canEdit,
      newlyCreatedId,
      setNewlyCreatedId,
      existingCategories,
      rawCostCodes,
      attachmentCounts,
      companyCsiDefaults,
      clientProjects,
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
          <div className="flex items-center gap-2">
            <BrandStandardsColumnChooser table={table} clientId={clientId} />
            {canEdit && (
              <Button
                onClick={handleAddStandard}
                disabled={isCreatePending}
              >
                <Plus size={16} /> Add Standard
              </Button>
            )}
          </div>
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
              <Button
                onClick={handleAddStandard}
                className="mt-4"
              >
                <Plus size={16} /> Add First Standard
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0" style={{ tableLayout: 'fixed', width: '100%', minWidth: table.getTotalSize() }}>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className="group/header relative px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 first:pl-4"
                      >
                        {header.isPlaceholder ? null : (
                          <div 
                            className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: <ChevronUp className="w-3 h-3 text-sky-500" />,
                              desc: <ChevronDown className="w-3 h-3 text-sky-500" />,
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        )}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-4 cursor-col-resize select-none touch-none bg-transparent flex justify-center items-center group-hover/header:opacity-100 transition-opacity ${header.column.getIsResizing() ? 'opacity-100 bg-sky-500/20' : 'opacity-0'}`}
                          >
                            <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-600 group-hover/header:bg-sky-400 rounded-full" />
                          </div>
                        )}
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
