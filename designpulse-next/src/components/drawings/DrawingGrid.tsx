"use client";
import React, { useState, useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  RowSelectionState,
  GroupingState,
  Row,
  Cell
} from '@tanstack/react-table';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { ProjectSheet } from '@/types/map.types';
import { DisciplineConfig } from '@/types/models';
import { Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, PanelRight, List, AlertTriangle } from 'lucide-react';
import { useUpdateProjectSheet, useDeleteProjectSheet } from '@/hooks/useMapQueries';
import { useUIStore } from '@/stores/useUIStore';
import { DrawingColumnChooser } from './DrawingColumnChooser';
import { useDrawingSets } from '@/hooks/useDrawingSetQueries';
import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';

const columnHelper = createColumnHelper<ProjectSheet>();

export function suggestDiscipline(sheetName: string, disciplines: DisciplineConfig[]): DisciplineConfig | null {
  if (!sheetName) return null;
  const match = sheetName.match(/^[A-Za-z]+/);
  if (!match) return null;
  const prefix = match[0].toUpperCase();
  
  if (prefix === 'A') return disciplines.find(d => d.label === 'Architectural') || null;
  if (prefix === 'S') return disciplines.find(d => d.label === 'Structural') || null;
  if (prefix === 'C') return disciplines.find(d => d.label === 'Civil') || null;
  if (prefix === 'L') return disciplines.find(d => d.label === 'Landscape') || null;
  if (prefix === 'M') return disciplines.find(d => d.label === 'Mechanical') || null;
  if (prefix === 'E') return disciplines.find(d => d.label === 'Electrical') || null;
  if (prefix === 'P') return disciplines.find(d => d.label === 'Plumbing') || null;
  if (prefix === 'FP') return disciplines.find(d => d.label === 'Fire Protection') || null;
  if (prefix === 'G') return disciplines.find(d => d.label === 'General') || null;
  
  return null;
}

// ── Memoized Grouped Row ────────────────────────────────────────────────────────
interface GroupedRowProps {
  row: Row<ProjectSheet>;
  virtualRow: VirtualItem;
  measureElement: (el: Element | null) => void;
  disciplinesMap: Record<string, string>;
  visibleColumnIds: string;
  pinnedColumnOffsets: string;
}

// eslint-disable-next-line react/display-name
const MemoizedGroupedRow = React.memo(({ row, virtualRow, measureElement, disciplinesMap }: GroupedRowProps) => {
  const disciplineId = row.getValue('discipline_id') as string | null;
  const label = disciplineId && disciplinesMap[disciplineId] ? disciplinesMap[disciplineId] : 'Uncategorized';
  
  return (
    <tbody
      ref={measureElement}
      data-index={virtualRow.index}
      className="border-b-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
    >
      <tr>
        <td
          colSpan={row.getVisibleCells().length}
          className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          onClick={row.getToggleExpandedHandler()}
        >
          <span className="flex items-center">
            <span className="mr-2">
              {row.getIsExpanded() ? '▼' : '▶'}
            </span>
            {label}
            <span className="ml-2 text-sm text-slate-500 font-normal">({row.subRows.length} items)</span>
          </span>
        </td>
      </tr>
    </tbody>
  );
}, (prev, next) => 
  prev.row.getIsExpanded() === next.row.getIsExpanded() && 
  prev.virtualRow.index === next.virtualRow.index &&
  prev.visibleColumnIds === next.visibleColumnIds &&
  prev.pinnedColumnOffsets === next.pinnedColumnOffsets
);

// ── Memoized Grid Row ──────────────────────────────────────────────────────────
interface GridRowProps {
  row: Row<ProjectSheet>;
  virtualRow: VirtualItem;
  measureElement: (el: Element | null) => void;
  isSelected: boolean;
  isPanelOpen: boolean;
  visibleColumnIds: string;
  pinnedColumnOffsets: string;
}

// eslint-disable-next-line react/display-name
const MemoizedGridRow = React.memo(({ row, virtualRow, measureElement, isSelected, isPanelOpen }: GridRowProps) => {
  return (
    <tbody
      ref={measureElement}
      data-index={virtualRow.index}
      className="border-b border-slate-200 dark:border-slate-800/50 group/row"
    >
      <tr 
        onClick={(e) => {
          if ((e.target as Element).closest('button, input, select, a, span.cursor-pointer')) return;
          const { setSelectedDrawingId, setDrawingGridViewMode } = useUIStore.getState();
          setSelectedDrawingId(row.original.id);
          setDrawingGridViewMode('split');
        }}
        className={`group transition-colors cursor-pointer ${
          isSelected 
            ? 'bg-sky-50/80 dark:bg-sky-900/40 border-l-2 border-sky-500' 
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-transparent'
        }`}
      >
        {row.getVisibleCells().map((cell: Cell<ProjectSheet, unknown>) => {
          if (cell.getIsGrouped() || cell.getIsPlaceholder()) {
            return <td key={cell.id} className="p-0 h-[1px]" />;
          }
          const isPinnedLeft = cell.column.getIsPinned() === 'left';
          return (
            <td 
              key={cell.id} 
              className={`px-3 py-2 align-middle bg-clip-padding border-r border-b border-slate-200 dark:border-slate-800 ${isPinnedLeft ? 'sticky z-10 bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''} ${isPanelOpen && isPinnedLeft ? '!bg-sky-50 dark:!bg-sky-900/40' : ''} ${isSelected && isPinnedLeft ? '!bg-sky-50 dark:!bg-sky-900/20' : ''}`}
              style={isPinnedLeft ? { left: `${cell.column.getStart('left')}px` } : undefined}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    </tbody>
  );
}, (prev, next) => 
  prev.isSelected === next.isSelected && 
  prev.isPanelOpen === next.isPanelOpen &&
  prev.row.original === next.row.original && 
  prev.virtualRow.index === next.virtualRow.index &&
  prev.visibleColumnIds === next.visibleColumnIds &&
  prev.pinnedColumnOffsets === next.pinnedColumnOffsets
);

// ── Main Component ─────────────────────────────────────────────────────────────
interface DrawingGridProps {
  projectId: string;
  sheets: ProjectSheet[];
  disciplines: DisciplineConfig[];
  onOpenViewer: (sheetId: string) => void;
}

export function DrawingGrid({ projectId, sheets, disciplines, onOpenViewer }: DrawingGridProps) {
  const selectedDrawingId = useUIStore(state => state.selectedDrawingId);
  const viewMode = useUIStore(state => state.drawingGridViewMode);
  const setViewMode = useUIStore(state => state.setDrawingGridViewMode);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(['discipline_id']);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { data: drawingSets = [] } = useDrawingSets(projectId);
  const drawingSetsMap = useMemo(() => {
    return drawingSets.reduce((acc, d) => {
      acc[d.id] = d.set_name;
      return acc;
    }, {} as Record<string, string>);
  }, [drawingSets]);
  
  const updateSheetMutation = useUpdateProjectSheet();
  const deleteSheetMutation = useDeleteProjectSheet();
  const [bulkDisciplineId, setBulkDisciplineId] = useState<string>('');

  const disciplinesMap = useMemo(() => {
    return disciplines.reduce((acc, d) => {
      acc[d.id] = d.label;
      return acc;
    }, {} as Record<string, string>);
  }, [disciplines]);

  const handleBulkAssign = () => {
    if (!bulkDisciplineId) return;
    const selectedIds = Object.keys(rowSelection);
    selectedIds.forEach((id) => {
      // Find the sheet
      const sheet = sheets.find(s => s.id === id);
      if (sheet) {
        updateSheetMutation.mutate({
          projectId,
          sheetId: sheet.id,
          updates: { discipline_id: bulkDisciplineId }
        });
      }
    });
    setRowSelection({});
    setBulkDisciplineId('');
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const selectedIds = Object.keys(rowSelection);
      for (const id of selectedIds) {
        const sheet = sheets.find(s => s.id === id);
        if (sheet) {
          await deleteSheetMutation.mutateAsync({ projectId, sheetId: sheet.id });
        }
      }
      setRowSelection({});
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to bulk delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'selection',
      header: ({ table }) => (
        <div className="flex items-center justify-center w-full">
          <input
            type="checkbox"
            className="w-4 h-4 text-sky-600 bg-slate-100 border-slate-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-slate-900 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center w-full">
          <input
            type="checkbox"
            className="w-4 h-4 text-sky-600 bg-slate-100 border-slate-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-slate-900 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        </div>
      ),
      size: 40,
    }),
    columnHelper.display({
      id: 'open_panel',
      header: '',
      cell: ({ row }) => {
        const sheet = row.original;
        if (!sheet) return null;
        const isOpen = selectedDrawingId === sheet.id;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const { setSelectedDrawingId, setDrawingGridViewMode } = useUIStore.getState();
              if (isOpen) {
                setSelectedDrawingId(null);
              } else {
                setSelectedDrawingId(sheet.id);
                setDrawingGridViewMode('split');
              }
            }}
            className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
              isOpen 
                ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800'
            }`}
            title="Open Details Panel"
          >
            <PanelRight size={16} />
          </button>
        );
      },
      size: 40,
    }),
    columnHelper.accessor('sheet_name', {
      header: 'Drawing Number',
      cell: (info) => {
        const sheet = info.row.original;
        if (!sheet) return null;
        return (
          <span 
            className={`font-semibold ${sheet.status === 'ready' ? 'text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 hover:underline cursor-pointer' : 'text-slate-500 dark:text-slate-400'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (sheet.status === 'ready') {
                onOpenViewer(sheet.id);
              }
            }}
          >
            {info.getValue() || 'Unnamed'}
          </span>
        );
      },
      size: 150,
    }),
    columnHelper.accessor('drawing_title', {
      header: 'Drawing Title',
      cell: (info) => <span className="text-slate-700 dark:text-slate-300">{info.getValue() || ''}</span>,
    }),
    columnHelper.accessor('revision', {
      header: 'Revision',
      cell: (info) => <span className="text-slate-700 dark:text-slate-300">{info.getValue() || ''}</span>,
      size: 100,
    }),
    columnHelper.accessor('drawing_set_id', {
      header: 'Drawing Set',
      enableHiding: true,
      cell: (info) => {
        const setId = info.getValue();
        return <span className="text-slate-700 dark:text-slate-300">{setId ? drawingSetsMap[setId] || 'Unknown Set' : ''}</span>;
      }
    }),
    columnHelper.accessor('drawing_date', {
      header: 'Drawing Date',
      enableHiding: true,
      cell: (info) => <span className="text-slate-700 dark:text-slate-300">{info.getValue() || ''}</span>,
    }),
    columnHelper.accessor('received_date', {
      header: 'Received Date',
      enableHiding: true,
      cell: (info) => <span className="text-slate-700 dark:text-slate-300">{info.getValue() || ''}</span>,
    }),
    columnHelper.accessor('discipline_id', {
      header: 'Discipline',
      enableHiding: true,
      cell: (info) => {
        const val = info.getValue();
        const sheet = info.row.original;
        if (!sheet) return null;
        return (
          <div className="relative group" onClick={e => e.stopPropagation()}>
            <select
              value={val || ''}
              onChange={(e) => {
                updateSheetMutation.mutate({
                  projectId,
                  sheetId: sheet.id,
                  updates: { discipline_id: e.target.value || null }
                });
              }}
              className="w-full bg-transparent text-sm font-medium border-0 focus:ring-0 cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <option value="">Select Discipline...</option>
              {disciplines.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
        );
      }
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const val = info.getValue();
        if (val === 'ready') return <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded w-fit"><CheckCircle2 size={14} /> Ready</span>;
        if (val === 'processing') return <span className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-2 py-1 rounded w-fit"><Loader2 size={14} className="animate-spin" /> Processing</span>;
        return <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded w-fit" title={info.row.original?.status_message || ''}><AlertCircle size={14} /> Error</span>;
      }
    }),
    columnHelper.accessor('created_at', {
      header: 'Uploaded Date',
      cell: (info) => <span className="text-slate-500 text-sm">{info.getValue() ? format(new Date(info.getValue()), 'MMM d, yyyy') : ''}</span>,
    }),
  ], [disciplines, projectId, updateSheetMutation, drawingSetsMap, onOpenViewer]);

  const table = useReactTable({
    data: sheets,
    columns,
    state: {
      rowSelection,
      globalFilter,
      grouping,
      columnPinning: { left: ['selection', 'open_panel', 'sheet_name'] },
      columnVisibility: { discipline_id: false }
    },
    initialState: {
      expanded: true,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id,
    columnResizeMode: 'onChange',
    autoResetExpanded: false,
    autoResetPageIndex: false,
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60, // Base height for a drawing row
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0;

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative">
      {/* Search Header */}
      <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-t-xl z-20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-2 mr-4">Grid V2 View</span>
          <input 
            type="text"
            placeholder="Search items..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 w-64"
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('split')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
              viewMode === 'split' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            title="Split View"
          >
            <PanelRight size={18} />
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
              viewMode === 'flat' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            title="Flat View"
          >
            <List size={18} />
          </button>
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
          <DrawingColumnChooser table={table as any} projectId={projectId} />
        </div>
      </div>

      <div 
        ref={tableContainerRef}
        className="flex-1 overflow-auto custom-scrollbar outline-none"
        tabIndex={0}
      >
        <table 
          className="text-left text-sm whitespace-nowrap border-separate border-spacing-0"
          style={{ tableLayout: 'fixed', width: table.getTotalSize() }}
        >
          <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const isPinnedLeft = header.column.getIsPinned() === 'left';
                  const isLastPinned = isPinnedLeft && header.column.getIsLastColumn('left');
                  return (
                    <th 
                      key={header.id} 
                      className={`relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 bg-clip-padding group select-none ${isPinnedLeft ? 'sticky z-30' : ''} ${isLastPinned ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r-2' : ''}`}
                      style={{ width: header.getSize(), ...(isPinnedLeft ? { left: header.column.getStart('left') } : {}) }}
                    >
                      <div className="truncate w-full flex items-center justify-between">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize user-select-none touch-none bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity ${
                            header.column.getIsResizing() ? 'opacity-100 bg-sky-600 w-2' : ''
                          }`}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          
          {paddingTop > 0 && (
            <tbody>
              <tr>
                <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
              </tr>
            </tbody>
          )}
          
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            const isSelected = row.getIsSelected();
            const visibleColumnIds = row.getVisibleCells().map(c => c.column.id).join(',');
            const pinnedColumnOffsets = table.getState().columnPinning.left?.join(',') || '';

            if (row.getIsGrouped()) {
              return (
                <MemoizedGroupedRow 
                  key={row.id}
                  row={row}
                  virtualRow={virtualRow}
                  measureElement={virtualizer.measureElement}
                  disciplinesMap={disciplinesMap}
                  visibleColumnIds={visibleColumnIds}
                  pinnedColumnOffsets={pinnedColumnOffsets}
                />
              );
            }

            return (
              <MemoizedGridRow 
                key={row.id}
                row={row}
                virtualRow={virtualRow}
                measureElement={virtualizer.measureElement}
                isSelected={isSelected}
                isPanelOpen={selectedDrawingId === row.original.id}
                visibleColumnIds={visibleColumnIds}
                pinnedColumnOffsets={pinnedColumnOffsets}
              />
            );
          })}
          
          {paddingBottom > 0 && (
            <tbody>
              <tr>
                <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
              </tr>
            </tbody>
          )}
          
          {sheets.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <ImageIcon size={48} strokeWidth={1} className="mb-4 text-slate-300 dark:text-slate-700" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No drawings uploaded yet</p>
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    <p className="text-sm mt-1">Click "Import Drawings" to upload a PDF set.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {/* Sticky Bottom Action Bar */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 w-full bg-slate-900 text-white p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 rounded-b-xl border-t border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-sky-500 text-white text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">
              {selectedCount}
            </div>
            <span className="font-medium text-sm text-slate-200">Drawings Selected</span>
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={bulkDisciplineId}
              onChange={e => setBulkDisciplineId(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none w-48"
            >
              <option value="">Assign Discipline...</option>
              {disciplines.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleBulkAssign}
              disabled={!bulkDisciplineId || updateSheetMutation.isPending}
            >
              Apply
            </Button>
            <div className="w-px h-6 bg-slate-700 mx-1" />
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="text-rose-400 hover:text-rose-300 shadow-none"
            >
              Delete ({selectedCount})
            </Button>
            <button 
              onClick={() => setRowSelection({})}
              className="px-4 py-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isDeleteModalOpen && (
        <ModalShell isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} size="sm">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete {selectedCount} Drawings?</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Are you sure you want to delete these sheets? This will permanently remove them from the project and cannot be undone.
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="ghost"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                isLoading={isDeleting}
                loadingText="Deleting..."
              >
                Delete Items
              </Button>
            </div>
        </ModalShell>
      )}
    </div>
  );
}
