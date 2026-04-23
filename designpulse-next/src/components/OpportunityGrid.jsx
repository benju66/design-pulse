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

  const isImpactField = column.id === 'cost_impact' || column.id === 'days_impact';
  const { data: options = [] } = useOpportunityOptions(isImpactField ? row.original.id : null);

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

  if (isImpactField) {
    const hasOptions = options.length > 0;
    const lockedOption = options.find(o => o.is_locked);
    
    if (hasOptions && !lockedOption) {
      // It's unlocked! Show range
      const min = Math.min(...options.map(o => Number(o[column.id]) || 0));
      const max = Math.max(...options.map(o => Number(o[column.id]) || 0));
      
      const formatVal = (v) => column.id === 'cost_impact' 
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
        : `${v} days`;

      return (
        <div className="w-full h-full px-2 py-1 text-sm italic text-slate-400 dark:text-slate-500 flex items-center">
          {min === max ? formatVal(min) : `${formatVal(min)} to ${formatVal(max)}`}
        </div>
      );
    }
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
      type={isImpactField ? 'number' : 'text'}
    />
  );
};

const SortableFieldCard = ({ id, title, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 pr-6">{title}</label>
      {children}
    </div>
  );
};

const SortableContenderCard = ({ opt, updateOption, deleteOption, lockOption, opportunityId, updateParentOpportunity }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: opt.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shrink-0 w-80 flex flex-col bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-sm transition-all group relative ${
        opt.is_locked
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/30'
          : 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700'
      }`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-sm transition-opacity z-10 hover:text-sky-500"
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </div>

      <div className="flex justify-between items-start mb-2 pt-2">
        <div className="flex-1 mr-2">
          <input
            className="font-bold text-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 rounded px-1.5 py-0.5 -ml-1.5 w-full text-slate-800 dark:text-slate-100 cursor-pointer focus:cursor-text transition-colors truncate mb-1.5"
            defaultValue={opt.title}
            placeholder="Option Title"
            title="Click to edit title"
            onBlur={(e) => {
              if (e.target.value !== opt.title) updateOption.mutate({ id: opt.id, updates: { title: e.target.value } });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
            }}
          />
          <input
            list="category-options"
            className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-2.5 py-1 cursor-text outline-none hover:bg-slate-200 dark:hover:bg-slate-700 focus:ring-2 focus:ring-sky-500 transition-colors border-none w-36"
            defaultValue={opt.category || 'Other'}
            placeholder="Category..."
            onBlur={(e) => {
              const val = e.target.value.trim() || 'Other';
              if (val !== (opt.category || 'Other')) {
                updateOption.mutate({ id: opt.id, updates: { category: val } });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
            }}
          />
          <datalist id="category-options">
            <option value="Existing Conditions" />
            <option value="Arch Plans/Specs" />
            <option value="Owner Standard" />
            <option value="Budgeted Item" />
            <option value="Other" />
          </datalist>
        </div>
        <div className="flex gap-1 shrink-0 mt-1">
          <button 
            onClick={() => updateOption.mutate({ id: opt.id, updates: { is_favorite: !opt.is_favorite } })}
            className={`p-1.5 rounded-full transition-colors ${
              opt.is_favorite 
                ? 'bg-amber-100 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50' 
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:bg-amber-50 hover:text-amber-400 dark:hover:bg-slate-700'
            }`}
            title={opt.is_favorite ? "Remove Favorite" : "Mark as Favorite"}
          >
            <Star size={14} fill={opt.is_favorite ? 'currentColor' : 'none'} strokeWidth={opt.is_favorite ? 2 : 2.5} />
          </button>
          <button 
            onClick={() => deleteOption.mutate(opt.id)}
            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors p-1.5"
            title="Delete Option"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <textarea
        className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 mb-3 outline-none focus:ring-2 focus:ring-sky-500 resize-none h-16"
        placeholder="Description & Pros/Cons..."
        defaultValue={opt.description || ''}
        onBlur={(e) => {
          if (e.target.value !== opt.description) updateOption.mutate({ id: opt.id, updates: { description: e.target.value } });
        }}
      />

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Quantity / UoM</label>
          <div className="flex bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus-within:ring-2 focus-within:ring-sky-500">
            <input
              type="number"
              className="w-16 bg-transparent border-r border-slate-200 dark:border-slate-800 outline-none text-sm text-slate-800 dark:text-slate-200 p-1.5"
              defaultValue={opt.quantity ?? 1}
              onBlur={(e) => {
                const qty = Number(e.target.value);
                if (qty !== Number(opt.quantity)) {
                  const newCost = qty * (opt.unit_cost || 0);
                  updateOption.mutate({ id: opt.id, updates: { quantity: qty, cost_impact: newCost } });
                }
              }}
            />
            <select
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-600 dark:text-slate-400 p-1.5 cursor-pointer appearance-none"
              defaultValue={opt.uom || 'ls'}
              onChange={(e) => updateOption.mutate({ id: opt.id, updates: { uom: e.target.value } })}
            >
              <option value="ls">ls</option>
              <option value="ea">ea</option>
              <option value="lf">lf</option>
              <option value="sf">sf</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Unit Cost</label>
          <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 focus-within:ring-2 focus-within:ring-sky-500">
            <span className="text-slate-400 text-sm pl-1">$</span>
            <input
              type="number"
              className="w-full bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-200 px-1"
              defaultValue={opt.unit_cost ?? opt.cost_impact ?? 0}
              onBlur={(e) => {
                const uc = Number(e.target.value);
                if (uc !== Number(opt.unit_cost)) {
                  const newCost = (opt.quantity ?? 1) * uc;
                  updateOption.mutate({ id: opt.id, updates: { unit_cost: uc, cost_impact: newCost } });
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Cost</label>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5">
            <span className="text-slate-500 dark:text-slate-400 text-sm pl-1">$</span>
            <span className="w-full text-sm text-slate-800 dark:text-slate-200 px-1 font-bold truncate">
              {Number(opt.cost_impact ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Schedule</label>
          <div className="flex bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus-within:ring-2 focus-within:ring-sky-500">
            <input
              type="number"
              className="w-14 bg-transparent border-r border-slate-200 dark:border-slate-800 outline-none text-sm text-slate-800 dark:text-slate-200 p-1.5"
              defaultValue={opt.days_impact}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val !== Number(opt.days_impact)) updateOption.mutate({ id: opt.id, updates: { days_impact: val } });
              }}
            />
            <select
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-600 dark:text-slate-400 p-1.5 cursor-pointer appearance-none"
              defaultValue={opt.time_impact_uom || 'days'}
              onChange={(e) => updateOption.mutate({ id: opt.id, updates: { time_impact_uom: e.target.value } })}
            >
              <option value="days">days</option>
              <option value="wks">wks</option>
              <option value="mos">mos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={() => {
            const isIncluded = !opt.include_in_budget;
            updateOption.mutate({ id: opt.id, updates: { include_in_budget: isIncluded } });
            
            if (isIncluded) {
              updateParentOpportunity.mutate({ 
                id: opportunityId, 
                updates: { cost_impact: opt.cost_impact || 0, days_impact: opt.days_impact || 0 } 
              });
            } else {
              updateParentOpportunity.mutate({ 
                id: opportunityId, 
                updates: { cost_impact: 0, days_impact: 0 } 
              });
            }
          }}
          className={`py-2 px-3 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-2 border ${
            opt.include_in_budget
              ? 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700 shadow-sm'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-sky-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800'
          }`}
        >
          {opt.include_in_budget ? <Check size={16} /> : <div className="w-3.5 h-3.5 border-2 border-current rounded-sm opacity-50" />}
          Include in Budget
        </button>

        <button
          onClick={() => lockOption.mutate(opt.id)}
          disabled={opt.is_locked}
          className={`py-2 px-3 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
            opt.is_locked
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          {opt.is_locked ? <Check size={16} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-50" />}
          Final Selection
        </button>
      </div>
    </div>
  );
};

const ContendersMatrix = ({ opportunityId, updateParentOpportunity }) => {
  const { data: options = [] } = useOpportunityOptions(opportunityId);
  const createOption = useCreateOption(opportunityId);
  const updateOption = useUpdateOption(opportunityId);
  const lockOption = useLockOption(opportunityId);
  const deleteOption = useDeleteOption(opportunityId);

  const [orderedOptions, setOrderedOptions] = useState([]);

  useEffect(() => {
    // Sync local state when external data changes, preserving their sort if they have an order_index
    setOrderedOptions([...options].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
  }, [options]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderedOptions.findIndex(o => o.id === active.id);
      const newIndex = orderedOptions.findIndex(o => o.id === over.id);
      const newOrder = arrayMove(orderedOptions, oldIndex, newIndex);
      setOrderedOptions(newOrder);
      
      newOrder.forEach((opt, idx) => {
        if (opt.order_index !== idx) {
           updateOption.mutate({ id: opt.id, updates: { order_index: idx } });
        }
      });
    }
  };

  const sensors = useSensors(useSensor(PointerSensor));
  const scrollRef = useRef(null);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    // When options are finally loaded into the DOM, force scroll to the far left.
    if (options.length > 0 && !initialScrollDone.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      }, 50);
      initialScrollDone.current = true;
    }
  }, [options.length]);

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 px-2 flex items-center gap-3">
        Contenders Matrix
        <span className="text-xs font-normal text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full">
          {options.length} Options
        </span>
      </h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedOptions.map(o => o.id)} strategy={horizontalListSortingStrategy}>
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-6 pt-3 px-2">
            {orderedOptions.map(opt => (
              <SortableContenderCard 
                key={opt.id} 
                opt={opt} 
                updateOption={updateOption} 
                deleteOption={deleteOption} 
                lockOption={lockOption} 
                opportunityId={opportunityId}
                updateParentOpportunity={updateParentOpportunity}
              />
            ))}

            {/* Add Option Card */}
            <div 
              onClick={() => createOption.mutate({})}
              className="shrink-0 w-80 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors text-slate-500 hover:text-sky-600 dark:hover:text-sky-400"
            >
              <Plus size={32} className="mb-2 opacity-50" />
              <span className="font-semibold">+ Add Option</span>
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export const ExpandedCard = ({ row, updateData }) => {
  const { cardOrder, setCardOrder, visibleCards, toggleCardVisibility } = useUIStore();
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

  const activeFields = cardOrder
    .map(id => ALL_PRIMARY_FIELDS.find(f => f.id === id))
    .filter(f => f && visibleCards[f.id]);

  const ADVANCED_FIELD_IDS = ['existing_conditions', 'mep_impact', 'backing_required', 'coordination_required', 'design_lock_phase'];

  const primaryFields = activeFields.filter(f => !ADVANCED_FIELD_IDS.includes(f.id));
  const advancedFields = activeFields.filter(f => ADVANCED_FIELD_IDS.includes(f.id));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cardOrder.indexOf(active.id);
      const newIndex = cardOrder.indexOf(over.id);
      setCardOrder(arrayMove(cardOrder, oldIndex, newIndex));
    }
  };

  const renderFieldInput = (field) => {
    const val = row.original[field.id];
    if (field.id === 'status') {
      return (
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
      );
    } else if (field.id === 'cost_impact' || field.id === 'days_impact') {
      return (
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
      );
    } else {
      return (
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
      );
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
              className="flex items-center gap-2 p-1.5 px-3 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <Settings size={18} />
              <span className="text-sm font-semibold">Configure Layout</span>
            </button>
            {showSettings && (
              <div className="absolute right-0 top-10 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-20">
                <h5 className="text-xs font-semibold text-slate-500 mb-2 px-2">Visible Fields</h5>
                <div className="flex flex-col space-y-1 max-h-60 overflow-y-auto">
                  {ALL_PRIMARY_FIELDS.map(f => (
                    <label key={f.id} className="flex items-center px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="mr-2"
                        checked={!!visibleCards[f.id]}
                        onChange={() => toggleCardVisibility(f.id)}
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
          <>
            <ContendersMatrix opportunityId={row.original.id} updateParentOpportunity={updateData} />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {/* Primary Data Grid */}
              <SortableContext items={primaryFields.map(f => f.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                  {primaryFields.map(f => (
                    <SortableFieldCard key={f.id} id={f.id} title={f.label}>
                      {renderFieldInput(f)}
                    </SortableFieldCard>
                  ))}
                </div>
              </SortableContext>

              {/* Advanced Drawer */}
              <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors font-semibold text-slate-700 dark:text-slate-300">
                  Advanced Details & History
                  <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                  <SortableContext items={advancedFields.map(f => f.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {advancedFields.map(f => (
                        <SortableFieldCard key={f.id} id={f.id} title={f.label}>
                          {renderFieldInput(f)}
                        </SortableFieldCard>
                      ))}
                    </div>
                  </SortableContext>
                  
                  {/* Future Accountability History Log Placeholder */}
                  <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3">Accountability History Log</h4>
                    <div className="space-y-3">
                      <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">System</span> created this record. <span className="text-xs">Just now</span>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </DndContext>
          </>
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
