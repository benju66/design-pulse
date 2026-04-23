"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { ChevronRight, ChevronDown, ChevronUp, GripVertical, Settings, Paperclip, List, MessageSquare } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUpdateOpportunity, useCreateOpportunity } from '@/hooks/useProjectQueries';
import { useUIStore } from '@/stores/useUIStore';

// Custom cell for inline editing (The "Excel" feel)
const EditableCell = ({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const updateMutation = table.options.meta?.updateData;

  const onBlur = () => {
    if (value !== initialValue) {
      updateMutation.mutate({
        id: row.original.id,
        updates: { [column.id]: value }
      });
    }
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (column.id === 'status') {
    return (
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          updateMutation.mutate({ id: row.original.id, updates: { status: e.target.value } });
        }}
        className="w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100"
      >
        <option value="Draft">Draft</option>
        <option value="Pending Review">Pending Review</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
      </select>
    );
  }

  return (
    <input
      value={value || ''}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm text-slate-900 dark:text-slate-100 ${
        column.id === 'cost_impact' && value < 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''
      }`}
      type={column.id === 'cost_impact' || column.id === 'days_impact' ? 'number' : 'text'}
    />
  );
};

const SortableFieldCard = ({ field, row, updateData }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const val = row.original[field.id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-opacity"
      >
        <GripVertical size={16} />
      </div>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 pr-6">{field.label}</label>
      
      {field.id === 'status' ? (
        <select
          defaultValue={val || 'Draft'}
          onChange={(e) => {
            updateData.mutate({ id: row.original.id, updates: { status: e.target.value } });
          }}
          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        >
          <option value="Draft">Draft</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      ) : field.id === 'cost_impact' || field.id === 'days_impact' ? (
        <input
          type="number"
          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          defaultValue={val || ''}
          onBlur={(e) => {
            const num = Number(e.target.value);
            if (num !== (val || 0)) {
              updateData.mutate({ id: row.original.id, updates: { [field.id]: num } });
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        />
      ) : (
        <textarea
          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none"
          rows={2}
          defaultValue={val || ''}
          onBlur={(e) => {
            if (e.target.value !== (val || '')) {
              updateData.mutate({ id: row.original.id, updates: { [field.id]: e.target.value } });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.target.blur();
            }
          }}
        />
      )}
    </div>
  );
};

export const ExpandedCard = ({ row, updateData }) => {
  const { fieldOrder, setFieldOrder, visibleFields, toggleFieldVisibility } = useUIStore();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('Details');

  // ALL possible fields mapped for selection/toggling
  const ALL_PRIMARY_FIELDS = [
    { id: 'cost_impact', label: 'Cost Impact' },
    { id: 'days_impact', label: 'Days Impact' },
    { id: 'assignee', label: 'Assignee' },
    { id: 'status', label: 'Status' },
    { id: 'arch_plans_spec', label: 'Arch Plans/Spec' },
    { id: 'bok_standard', label: 'BOK Standard' },
    { id: 'existing_conditions', label: 'Existing Conditions' },
    { id: 'mep_impact', label: 'MEP Impact' },
    { id: 'owner_goals', label: 'Owner Goals' },
    { id: 'final_direction', label: 'Final Direction' },
    { id: 'backing_required', label: 'Backing Required' },
    { id: 'coordination_required', label: 'Coordination Required' },
    { id: 'design_lock_phase', label: 'Design Lock Phase' },
  ];

  const activeFields = fieldOrder
    .map(id => ALL_PRIMARY_FIELDS.find(f => f.id === id))
    .filter(f => f && visibleFields[f.id]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fieldOrder.indexOf(active.id);
      const newIndex = fieldOrder.indexOf(over.id);
      setFieldOrder(arrayMove(fieldOrder, oldIndex, newIndex));
    }
  };

  return (
    <div className="flex flex-col m-4 border border-slate-300 dark:border-slate-700 rounded-xl shadow-lg bg-slate-50 dark:bg-slate-900/50 whitespace-normal overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 px-4">
        <div className="flex space-x-1 py-2">
          {['Details', 'Attachments', 'Activity'].map(tab => {
            const Icon = tab === 'Details' ? List : tab === 'Attachments' ? Paperclip : MessageSquare;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab 
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon size={16} />
                {tab}
              </button>
            )
          })}
        </div>
        {activeTab === 'Details' && (
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <Settings size={18} />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-8 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-20">
                <h5 className="text-xs font-semibold text-slate-500 mb-2 px-2">Visible Fields</h5>
                <div className="flex flex-col space-y-1 max-h-60 overflow-y-auto">
                  {ALL_PRIMARY_FIELDS.map(f => (
                    <label key={f.id} className="flex items-center px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="mr-2"
                        checked={!!visibleFields[f.id]}
                        onChange={() => toggleFieldVisibility(f.id)}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
        {activeTab === 'Details' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fieldOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeFields.map(f => (
                  <SortableFieldCard key={f.id} field={f} row={row} updateData={updateData} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {activeTab === 'Attachments' && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-slate-800/50">
            <Paperclip size={32} className="mb-3 text-slate-400" />
            <p className="font-medium text-slate-600 dark:text-slate-300">Drag and drop files here, or click to browse</p>
            <p className="text-sm mt-1 text-slate-400">Supports PDF, JPG, PNG, DOCX</p>
          </div>
        )}

        {activeTab === 'Activity' && (
          <div className="flex flex-col space-y-4">
            <div className="space-y-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 pb-4 mt-2">
              <div className="relative pl-6">
                <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-slate-50 dark:ring-slate-900/50" />
                <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-white">System</span> created this option.</p>
                <span className="text-xs text-slate-400">Just now</span>
              </div>
              <div className="relative pl-6">
                <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-sky-400 ring-4 ring-slate-50 dark:ring-slate-900/50" />
                <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-white">You</span> updated <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1 rounded">status</span> from Draft to Pending Review.</p>
                <span className="text-xs text-slate-400">2 mins ago</span>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Write a comment..." className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
              <button className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors">Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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

  const flatColumns = useMemo(
    () => [
      checkboxColumn,
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
    [compareQueue]
  );

  const cardColumns = useMemo(
    () => [
      checkboxColumn,
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
    [compareQueue]
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
                  onClick={() => setSelectedOpportunityId(row.original.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-sky-50 dark:bg-sky-900/20 border-l-2 border-sky-500' 
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
              if (column.id === 'select') return <td key={column.id} className="p-0 border-r border-b border-slate-200 dark:border-slate-800" />;
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
