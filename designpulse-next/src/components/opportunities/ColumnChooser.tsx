"use client";
import { useState, useRef, useEffect } from 'react';
import { Settings, GripVertical, Check } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Table, Column } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

interface SortableColumnItemProps {
  column: Column<Opportunity, unknown>;
}

const SortableColumnItem = ({ column }: SortableColumnItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  const headerTitle = typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md ${isDragging ? 'bg-slate-100 dark:bg-slate-700 shadow-md ring-1 ring-slate-300 dark:ring-slate-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} transition-colors`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
        <GripVertical size={14} />
      </div>
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            checked={column.getIsVisible()}
            onChange={column.getToggleVisibilityHandler()}
            className="w-4 h-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded cursor-pointer appearance-none checked:bg-sky-500 checked:border-sky-500 dark:checked:bg-sky-500 dark:checked:border-sky-500 transition-colors"
          />
          {column.getIsVisible() && <Check size={12} className="absolute text-white pointer-events-none" strokeWidth={3} />}
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none">
          {headerTitle}
        </span>
      </label>
    </li>
  );
};

interface ColumnChooserProps {
  table: Table<Opportunity>;
}

export const ColumnChooser = ({ table }: ColumnChooserProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const allColumns = table.getAllLeafColumns();
  const configurableColumns = allColumns.filter(c => typeof c.columnDef.header === 'string');
  const pinnedColumnIds = allColumns.filter(c => typeof c.columnDef.header !== 'string').map(c => c.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = configurableColumns.findIndex(c => c.id === active.id);
      const newIndex = configurableColumns.findIndex(c => c.id === over.id);
      
      const newConfigurableOrder = arrayMove(configurableColumns.map(c => c.id), oldIndex, newIndex);
      
      table.setColumnOrder([...pinnedColumnIds, ...newConfigurableOrder]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${isOpen ? 'bg-slate-200 dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-inner' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700'}`}
        title="Column Settings"
      >
        <Settings size={16} />
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">View</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl z-[200] flex flex-col max-h-[400px]">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-xl">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Configure Columns</h4>
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                Toggle All
              </span>
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={configurableColumns.every(c => c.getIsVisible())}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    const newVisibility: Record<string, boolean> = {};
                    pinnedColumnIds.forEach(id => newVisibility[id] = true);
                    configurableColumns.forEach(c => newVisibility[c.id] = isChecked);
                    table.setColumnVisibility(newVisibility);
                  }}
                  className="w-4 h-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded cursor-pointer appearance-none checked:bg-sky-500 checked:border-sky-500 dark:checked:bg-sky-500 dark:checked:border-sky-500 transition-colors"
                />
                {configurableColumns.every(c => c.getIsVisible()) && <Check size={12} className="absolute text-white pointer-events-none" strokeWidth={3} />}
                {!configurableColumns.every(c => c.getIsVisible()) && configurableColumns.some(c => c.getIsVisible()) && (
                  <div className="absolute w-2 h-0.5 bg-sky-500 rounded-full pointer-events-none" />
                )}
              </div>
            </label>
          </div>
          
          <div className="p-2 overflow-auto flex-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={configurableColumns.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1">
                  {configurableColumns.map(column => (
                    <SortableColumnItem key={column.id} column={column} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
          
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-xl flex gap-2 justify-end">
            <button 
              onClick={() => {
                table.setColumnVisibility({});
                table.setColumnOrder([]);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
