"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Star } from 'lucide-react';
import { OpportunityOption } from '@/types/models';
import { UseMutationResult } from '@tanstack/react-query';

interface SortableContenderCardProps {
  opt: OpportunityOption & { quantity?: number; unit_cost?: number; uom?: string; time_impact_uom?: string; is_favorite?: boolean };
  categories: string[];
  updateOption: UseMutationResult<OpportunityOption, Error, { id: string; updates: Partial<OpportunityOption & { quantity?: number; unit_cost?: number; uom?: string; time_impact_uom?: string; is_favorite?: boolean }> }, unknown>;
  deleteOption: UseMutationResult<string, Error, string, unknown>;
  lockOption: UseMutationResult<unknown, Error, string, unknown>;
  toggleOptionBudget: UseMutationResult<unknown, Error, { optionId: string; isIncluded: boolean }, unknown>;
  opportunityId: string;
  hasLockedOption: boolean;
  isLocked?: boolean;
}

export const SortableContenderCard = ({ 
  opt, 
  categories, 
  updateOption, 
  deleteOption, 
  lockOption, 
  toggleOptionBudget, 
  hasLockedOption,
  isLocked
}: SortableContenderCardProps) => {

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: opt.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shrink-0 w-80 flex flex-col bg-white dark:bg-slate-900 border-2 rounded-xl p-4 shadow-sm transition-all group relative ${
        opt.is_locked
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/30'
          : 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700'
      }`}
    >
      {!isLocked && !opt.is_locked && (
        <div 
          {...attributes} 
          {...listeners} 
          className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-sm transition-opacity z-10 hover:text-sky-500"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>
      )}

      <div className="flex justify-between items-start mb-2 pt-2">
        <div className="flex-1 mr-2">
          <input
            className="font-bold text-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-950 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 rounded px-1.5 py-0.5 -ml-1.5 w-full text-slate-800 dark:text-slate-100 cursor-pointer focus:cursor-text transition-colors truncate mb-1.5 disabled:opacity-80 disabled:cursor-default disabled:hover:border-transparent"
            defaultValue={opt.title}
            placeholder="Option Title"
            title="Click to edit title"
            disabled={opt.is_locked || isLocked}
            onBlur={(e) => {
              if (e.target.value !== opt.title) updateOption.mutate({ id: opt.id, updates: { title: e.target.value } });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <input
            list={`category-options-${opt.id}`}
            className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-2.5 py-1 cursor-text outline-none hover:bg-slate-200 dark:hover:bg-slate-700 focus:ring-2 focus:ring-sky-500 transition-colors border-none w-36 disabled:opacity-70 disabled:cursor-not-allowed"
            defaultValue={opt.category || 'Other'}
            disabled={opt.is_locked || isLocked}
            placeholder="Category..."
            onBlur={(e) => {
              const val = e.target.value.trim() || 'Other';
              if (val !== (opt.category || 'Other')) {
                updateOption.mutate({ id: opt.id, updates: { category: val } });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <datalist id={`category-options-${opt.id}`}>
            {categories.map(cat => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>
        <div className="flex gap-1 shrink-0 mt-1">
          <button 
            onClick={() => updateOption.mutate({ id: opt.id, updates: { is_favorite: !opt.is_favorite } })}
            className={`p-1.5 rounded-full transition-colors ${
              opt.is_favorite 
                ? 'bg-amber-100 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50' 
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:bg-amber-50 hover:text-amber-400 dark:hover:bg-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={opt.is_favorite ? "Remove Favorite" : "Mark as Favorite"}
            disabled={opt.is_locked || isLocked}
          >
            <Star size={14} fill={opt.is_favorite ? 'currentColor' : 'none'} strokeWidth={opt.is_favorite ? 2 : 2.5} />
          </button>
          <button 
            onClick={() => deleteOption.mutate(opt.id)}
            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors p-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete Option"
            disabled={opt.is_locked || isLocked}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <textarea
        className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 mb-3 outline-none focus:ring-2 focus:ring-sky-500 resize-none h-16 disabled:opacity-70 disabled:cursor-not-allowed"
        placeholder="Description & Pros/Cons..."
        defaultValue={opt.description || ''}
        disabled={opt.is_locked || isLocked}
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
              className="w-16 bg-transparent border-r border-slate-200 dark:border-slate-800 outline-none text-sm text-slate-800 dark:text-slate-200 p-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
              defaultValue={opt.quantity || ''}
              placeholder="1"
              disabled={opt.is_locked || isLocked}
              onBlur={(e) => {
                const qty = Number(e.target.value);
                if (qty !== Number(opt.quantity)) {
                  const newCost = qty * (opt.unit_cost || 0);
                  updateOption.mutate({ id: opt.id, updates: { quantity: qty, cost_impact: newCost } });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
            <select
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-600 dark:text-slate-400 p-1.5 cursor-pointer appearance-none disabled:opacity-70 disabled:cursor-not-allowed"
              defaultValue={opt.uom || 'ls'}
              disabled={opt.is_locked || isLocked}
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
              className="w-full bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-200 px-1 disabled:opacity-70 disabled:cursor-not-allowed"
              defaultValue={opt.unit_cost || opt.cost_impact || ''}
              placeholder="0"
              disabled={opt.is_locked || isLocked}
              onBlur={(e) => {
                const uc = Number(e.target.value);
                if (uc !== Number(opt.unit_cost)) {
                  const newCost = (opt.quantity ?? 1) * uc;
                  updateOption.mutate({ id: opt.id, updates: { unit_cost: uc, cost_impact: newCost } });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
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
              className="w-14 bg-transparent border-r border-slate-200 dark:border-slate-800 outline-none text-sm text-slate-800 dark:text-slate-200 p-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
              defaultValue={opt.days_impact || ''}
              placeholder="0"
              disabled={opt.is_locked || isLocked}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val !== Number(opt.days_impact)) updateOption.mutate({ id: opt.id, updates: { days_impact: val } });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
            <select
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-600 dark:text-slate-400 p-1.5 cursor-pointer appearance-none disabled:opacity-70 disabled:cursor-not-allowed"
              defaultValue={opt.time_impact_uom || 'days'}
              disabled={opt.is_locked || isLocked}
              onChange={(e) => updateOption.mutate({ id: opt.id, updates: { time_impact_uom: e.target.value } })}
            >
              <option value="days">days</option>
              <option value="wks">wks</option>
              <option value="mos">mos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Target for Forecast</span>
          <button
            onClick={() => {
              const isIncluded = !opt.include_in_budget;
              toggleOptionBudget.mutate({ optionId: opt.id, isIncluded });
            }}
            disabled={hasLockedOption || isLocked}
            role="switch"
            aria-checked={opt.include_in_budget || false}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
              opt.include_in_budget ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
            } ${(hasLockedOption || isLocked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${opt.include_in_budget ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Final Selection</span>
          <button
            onClick={() => lockOption.mutate(opt.id)}
            disabled={opt.is_locked || isLocked}
            role="switch"
            aria-checked={opt.is_locked || false}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              opt.is_locked ? 'bg-emerald-500 cursor-default' : 'bg-slate-300 dark:bg-slate-600 cursor-pointer hover:bg-slate-400 dark:hover:bg-slate-500'
            }`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${opt.is_locked ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
