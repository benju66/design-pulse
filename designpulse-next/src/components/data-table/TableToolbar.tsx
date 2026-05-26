'use client';

import React from 'react';
import { Search, SlidersHorizontal, Map as MapIcon, X } from 'lucide-react';

/**
 * Shared toolbar for DataTable grids.
 * Extracted from the ~45 lines of identical toolbar JSX in Coordination and Permit tables.
 *
 * Provides: search input, filter button with active count, optional map toggle,
 * column chooser slot, and leading/trailing slots for domain-specific controls.
 */

export interface TableToolbarProps {
  /** Global text search */
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  /** Filter drawer */
  filterCount: number;
  onFilterToggle: () => void;

  /** Map/drawings toggle (opt-in) */
  showMapToggle?: boolean;
  isMapVisible?: boolean;
  onMapToggle?: () => void;

  /** Column chooser — pass as a rendered component */
  columnChooser?: React.ReactNode;

  /** Additional toolbar items */
  leadingSlot?: React.ReactNode;
  trailingSlot?: React.ReactNode;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterCount,
  onFilterToggle,
  showMapToggle = false,
  isMapVisible = false,
  onMapToggle,
  columnChooser,
  leadingSlot,
  trailingSlot,
}: TableToolbarProps) {
  return (
    <div className="dt-toolbar">
      {/* Leading slot */}
      {leadingSlot}

      {/* Search input */}
      <div className="relative w-64">
        <Search
          size={16}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg
                     bg-white dark:bg-slate-800
                     border border-slate-200 dark:border-slate-700
                     text-slate-900 dark:text-white
                     placeholder:text-slate-400 dark:placeholder:text-slate-500
                     outline-none focus:ring-2 focus:ring-sky-400/50"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600
                       dark:hover:text-slate-300 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Spacer to push buttons to the right */}
      <div className="flex-1" />

      {/* Filter button */}
      <button
        onClick={onFilterToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          filterCount > 0
            ? 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
        }`}
      >
        <SlidersHorizontal size={14} />
        Filters
        {filterCount > 0 && (
          <span className="bg-sky-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {filterCount}
          </span>
        )}
      </button>

      {/* Map toggle */}
      {showMapToggle && onMapToggle && (
        <button
          onClick={onMapToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            isMapVisible
              ? 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
          }`}
        >
          <MapIcon size={14} />
          Drawings
        </button>
      )}

      {/* Column chooser */}
      {columnChooser}

      {/* Trailing slot */}
      {trailingSlot}
    </div>
  );
}
