"use client";
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { ChevronRight, ChevronDown, ChevronUp, GripVertical, Settings, Paperclip, List, MessageSquare, Plus, X, Check, PanelRight, Star } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUpdateOpportunity, useCreateOpportunity, useOpportunityOptions, useCreateOption, useUpdateOption, useLockOption, useDeleteOption } from '@/hooks/useProjectQueries';
import { useUIStore } from '@/stores/useUIStore';

import { EditableCell } from './opportunities/EditableCell';
import { ExpandedCard } from './opportunities/ExpandedCard';

export default function OpportunityGrid({ projectId, data, viewMode = 'flat', onOpenCompare }) {
  const updateMutation = useUpdateOpportunity(projectId);
  const createMutation = useCreateOpportunity(projectId);
  const { selectedOpportunityId, setSelectedOpportunityId, compareQueue, toggleCompareItem, clearCompareQueue } = useUIStore();

  useEffect(() => {
    if (selectedOpportunityId) {
      const element = document.getElementById(`row-${selectedOpportunityId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedOpportunityId]);

  const [expanded, setExpanded] = useState({});

  const checkboxColumn = {
    id: 'select',
    header: () => null,
    cell: ({ row }) => {
      // Direct store access is fine here since it's a render function inside the component tree
      const isSelected = compareQueue.includes(row.original.id);
      return (
        <div className="flex items-center justify-center py-2 px-1">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={() => toggleCompareItem(row.original.id)}
            className="w-4 h-4 text-sky-600 bg-slate-100 border-slate-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
          />
        </div>
      );
    },
  };

  const openPanelColumn = {
    id: 'open_panel',
    header: () => null,
    cell: ({ row }) => (
      <div className="flex items-center justify-center p-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (selectedOpportunityId === row.original.id) {
              setSelectedOpportunityId(null);
            } else {
              setSelectedOpportunityId(row.original.id);
            }
          }}
          className={`p-1 rounded transition-colors ${
            selectedOpportunityId === row.original.id 
              ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/30' 
              : 'text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30'
          }`}
          title="Open Details Panel"
        >
          <PanelRight size={16} />
        </button>
      </div>
    )
  };

  const flatColumns = useMemo(
    () => [
      checkboxColumn,
      ...(viewMode === 'split' ? [openPanelColumn] : []),
      { accessorKey: 'title', header: 'Title (Element)', cell: EditableCell },
      { accessorKey: 'location', header: 'Location', cell: EditableCell },
      { accessorKey: 'scope', header: 'Scope', cell: EditableCell },
      { accessorKey: 'arch_plans_spec', header: 'Arch Plans/Spec', cell: EditableCell },
      { accessorKey: 'bok_standard', header: 'BOK Standard', cell: EditableCell },
      { accessorKey: 'existing_conditions', header: 'Existing Conditions', cell: EditableCell },
      { accessorKey: 'mep_impact', header: 'MEP Impact', cell: EditableCell },
      { accessorKey: 'owner_goals', header: 'Owner Goals', cell: EditableCell },
      { accessorKey: 'backing_required', header: 'Backing Req.', cell: EditableCell },
      { accessorKey: 'coordination_required', header: 'Coord Req.', cell: EditableCell },
      { accessorKey: 'design_lock_phase', header: 'Design Lock Phase', cell: EditableCell },
      { accessorKey: 'final_direction', header: 'Final Direction', cell: EditableCell },
      { accessorKey: 'assignee', header: 'Assignee', cell: EditableCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: EditableCell },
      { accessorKey: 'status', header: 'Status', cell: EditableCell },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: EditableCell },
    ],
    [compareQueue, viewMode, selectedOpportunityId]
  );

  const cardColumns = useMemo(
    () => [
      checkboxColumn,
      ...(viewMode === 'split' ? [openPanelColumn] : []),
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
          >
            {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ),
      },
      { accessorKey: 'title', header: 'Title (Element)', cell: EditableCell },
      { accessorKey: 'location', header: 'Location', cell: EditableCell },
      { accessorKey: 'assignee', header: 'Assignee', cell: EditableCell },
      { accessorKey: 'due_date', header: 'Due Date', cell: EditableCell },
      { accessorKey: 'status', header: 'Status', cell: EditableCell },
      { accessorKey: 'cost_impact', header: 'Cost Impact ($)', cell: EditableCell },
    ],
    [compareQueue, viewMode, selectedOpportunityId]
  );

  const columns = viewMode === 'card' ? cardColumns : flatColumns;

  const table = useReactTable({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    columnResizeMode: 'onChange',
    meta: {
      updateData: updateMutation,
    },
  });

  return (
    <div className="w-full h-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th 
                  key={header.id} 
                  className="relative px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 select-none group"
                  style={{ width: header.getSize() }}
                >
                  <div className="truncate">
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
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {table.getRowModel().rows.map((row) => {
            const isSelected = selectedOpportunityId === row.original.id;
            return (
              <React.Fragment key={row.id}>
                <tr 
                  id={`row-${row.original.id}`}
                  className={`transition-colors ${
                    isSelected 
                      ? 'bg-sky-50/50 dark:bg-sky-900/10 border-l-2 border-sky-500' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {viewMode === 'card' && row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-slate-100 dark:border-slate-800/50">
                      <ExpandedCard row={row} updateData={updateMutation} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={15} className="px-4 py-8 text-center text-slate-500">
                No VE or Alternates logged yet. Start typing below to add one!
              </td>
            </tr>
          )}

          {/* Ghost Row for Quick Add */}
          <tr className="bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/50 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
            {table.getVisibleLeafColumns().map((column) => {
              if (column.id === 'select' || column.id === 'open_panel') return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800" />;
              if (column.id === 'expander') {
                return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle text-slate-400 text-center text-xs font-bold">+</td>;
              }
              if (column.id === 'status') {
                return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-middle"><span className="text-sm text-slate-400 px-2 py-1 italic block w-full h-full">Draft</span></td>;
              }
              return (
                <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800 align-top">
                  <input
                    type={column.id === 'cost_impact' || column.id === 'days_impact' ? 'number' : 'text'}
                    placeholder={`+ Add ${typeof column.columnDef.header === 'string' ? column.columnDef.header : 'Item'}...`}
                    className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400/70 dark:placeholder-slate-500/70 italic"
                    onBlur={(e) => {
                      if (e.target.value.trim() !== '') {
                        let val = e.target.value;
                        if (column.id === 'cost_impact' || column.id === 'days_impact') val = Number(val) || 0;
                        createMutation.mutate({ [column.id]: val });
                        e.target.value = '';
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim() !== '') {
                        let val = e.target.value;
                        if (column.id === 'cost_impact' || column.id === 'days_impact') val = Number(val) || 0;
                        createMutation.mutate({ [column.id]: val });
                        e.target.value = '';
                        e.target.blur();
                      }
                    }}
                  />
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      {compareQueue.length > 0 && (
        <div className="sticky bottom-0 w-full bg-slate-900 text-white p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 rounded-b-xl border-t border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-sky-500 text-white text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">
              {compareQueue.length}
            </div>
            <span className="font-medium text-sm text-slate-200">Options Selected</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={clearCompareQueue}
              className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Clear
            </button>
            <button 
              onClick={onOpenCompare}
              className="px-6 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
            >
              Compare Options
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
