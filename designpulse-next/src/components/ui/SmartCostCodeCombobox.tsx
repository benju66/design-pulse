import { useState, useRef, useEffect } from 'react';
import { Search, Lock } from 'lucide-react';
import { CostType, CostCode, ProjectCsiSpec } from '@/types/models';
import { formatCostCode } from '@/lib/formatCostCode';

const COST_TYPE_PILL: Record<string, string> = {
  Labor:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Material:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Subcontract: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Equipment:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Other:       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

// Standard construction suffix notation: suffix sits directly after the numeric code.
// e.g. "10-2600.M – Wall and Door Protection"
const COST_TYPE_ABBR: Record<string, string> = {
  Labor:       '.L',
  Material:    '.M',
  Subcontract: '.S',
  Equipment:   '.E',
  Other:       '.O',
};

// Maps each category_* boolean flag on a CostCode row to its suffix + CostType value.
// Used to fan out a single code into multiple selectable entries in the dropdown.
const CATEGORY_SUFFIX: { field: keyof CostCode; suffix: string; costType: CostType }[] = [
  { field: 'category_l', suffix: '.L', costType: 'Labor' },
  { field: 'category_m', suffix: '.M', costType: 'Material' },
  { field: 'category_s', suffix: '.S', costType: 'Subcontract' },
  { field: 'category_e', suffix: '.E', costType: 'Equipment' },
  { field: 'category_o', suffix: '.O', costType: 'Other' },
];

const COST_TYPES: CostType[] = ['Labor', 'Material', 'Subcontract', 'Equipment', 'Other'];

// iOS-safe normalization: strip non-alphanumeric, lowercase (no negative lookbehind)
function normalizeSearch(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// A single selectable entry — one per active category flag per cost code.
// Codes with no flags appear once with suffix='' and costType=null.
interface CodeEntry {
  code: string;         // raw stored code e.g. '102600'
  description: string;  // e.g. 'Wall and Door Protection'
  suffix: string;       // '.M' | '' etc.
  costType: CostType | null;
  displayCode: string;  // '10-2600.M' — used in both dropdown and trigger
}

// Expand each CostCode into one entry per active category flag.
// A code with category_m=true + category_s=true yields TWO entries in the list.
// A code with no flags yields one entry without a suffix (no cost type forced).
function expandCodeEntries(codes: CostCode[]): CodeEntry[] {
  const result: CodeEntry[] = [];
  for (const c of codes) {
    const description = c.description ?? '';
    const formatted = formatCostCode(c.code);
    const activeSuffixes = CATEGORY_SUFFIX.filter(cs => c[cs.field] === true);
    if (activeSuffixes.length === 0) {
      result.push({ code: c.code, description, suffix: '', costType: null, displayCode: formatted });
    } else {
      for (const cs of activeSuffixes) {
        result.push({
          code: c.code,
          description,
          suffix: cs.suffix,
          costType: cs.costType,
          displayCode: `${formatted}${cs.suffix}`,
        });
      }
    }
  }
  return result;
}

export interface SmartCostCodeComboboxProps {
  value: string | null | undefined;
  costType?: CostType | null | undefined;
  specNumberId?: string | null | undefined;
  mode?: 'combined' | 'cost_code_only' | 'csi_spec_only';
  onChange: (updates: { cost_code?: string; division?: string; cost_type?: CostType; spec_number_id?: string | null }) => void;
  rawCostCodes: CostCode[];
  csiSpecs?: ProjectCsiSpec[];
  disabled?: boolean;
  showCostTypeSegment?: boolean;
}

export function SmartCostCodeCombobox({
  value,
  costType,
  specNumberId,
  mode = 'combined',
  onChange,
  rawCostCodes,
  csiSpecs = [],
  disabled = false,
  showCostTypeSegment = true,
}: SmartCostCodeComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Rule C16: useRef containment for click-outside — NEVER stopPropagation
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const nq = normalizeSearch(searchQuery);

  // Fan out codes into one entry per category flag, then filter.
  const allEntries: CodeEntry[] = mode === 'csi_spec_only' ? [] : expandCodeEntries(rawCostCodes);
  const filteredEntries = allEntries.filter((entry) => {
    if (!searchQuery) return true;
    return (
      normalizeSearch(entry.code).includes(nq) ||
      normalizeSearch(entry.description).includes(nq) ||
      normalizeSearch(entry.displayCode).includes(nq) // supports searching "10-2600.M"
    );
  });

  const filteredCsiSpecs = mode === 'cost_code_only' ? [] : csiSpecs.filter((spec) => {
    if (!searchQuery) return true;
    return (
      spec.normalized_csi_number.includes(nq) ||
      normalizeSearch(spec.csi_number).includes(nq) ||
      normalizeSearch(spec.description || '').includes(nq)
    );
  });

  // Rule C23: atomic onChange — selects both cost_code and cost_type in one mutation.
  // The suffix entry determines the cost_type; no separate manual selector needed in the grid.
  const handleSelectEntry = (entry: CodeEntry) => {
    const updates: {
      cost_code: string;
      division?: string;
      cost_type?: CostType;
      spec_number_id: string | null;
    } = {
      cost_code: entry.code,
      spec_number_id: null,
      ...(entry.costType ? { cost_type: entry.costType } : {}),
    };
    // Derive division from the matching cost code row.
    const matched = rawCostCodes.find((c) => c.code === entry.code);
    if (matched) {
      if (matched.parent_division) {
        const parentDiv = rawCostCodes.find((c) => c.code === matched.parent_division && c.is_division);
        if (parentDiv) updates.division = `${parentDiv.code} - ${parentDiv.description}`;
      } else if (matched.is_division) {
        updates.division = `${matched.code} - ${matched.description}`;
      }
    }
    onChange(updates);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCsiSpec = (spec: ProjectCsiSpec) => {
    if (!spec.cost_code) return;
    const updates: { cost_code: string; division?: string; spec_number_id: string } = {
      cost_code: spec.cost_code,
      spec_number_id: spec.id,
    };
    const matched = rawCostCodes.find((c) => c.code === spec.cost_code);
    if (matched) {
      if (matched.parent_division) {
        const parentDiv = rawCostCodes.find((c) => c.code === matched.parent_division && c.is_division);
        if (parentDiv) updates.division = `${parentDiv.code} - ${parentDiv.description}`;
      } else if (matched.is_division) {
        updates.division = `${matched.code} - ${matched.description}`;
      }
    }
    onChange(updates);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCostType = (type: CostType) => {
    onChange({ cost_type: type });
  };

  // Trigger display: "10-2600.M – Wall and Door Protection"
  // Suffix immediately follows the number, description after the dash.
  const isEmpty = !value;
  const selectedSpec = specNumberId ? csiSpecs.find(s => s.id === specNumberId) : undefined;
  const selectedCodeRow = value ? rawCostCodes.find(c => c.code === value) : undefined;
  const costTypeSuffix = costType ? (COST_TYPE_ABBR[costType] ?? '') : '';
  const triggerLabel = value
    ? selectedCodeRow
      ? `${formatCostCode(value)}${costTypeSuffix} \u2013 ${selectedCodeRow.description}`
      : `${formatCostCode(value)}${costTypeSuffix}`
    : null;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* ── Read-only display ── */}
      <div
        onClick={() => { if (!disabled) setIsOpen(true); }}
        className={`
          w-full h-full px-2 py-1 text-xs min-h-[28px] flex items-center gap-1.5
          ${disabled ? 'cursor-not-allowed opacity-75 bg-slate-50 dark:bg-slate-800/30' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}
          ${isOpen ? 'ring-2 ring-inset ring-sky-500 bg-sky-50/50 dark:bg-sky-900/20' : ''}
        `}
      >
        <span className={`truncate flex-1 flex items-center gap-1 min-w-0 ${
          isEmpty && mode !== 'csi_spec_only' ? 'text-slate-400 italic' : 'text-slate-800 dark:text-slate-100'
        }`}>
          {disabled && mode === 'cost_code_only' && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
          <span className="truncate text-xs">
            {mode === 'csi_spec_only'
              ? (selectedSpec?.csi_number || '\u2014')
              : (triggerLabel || 'Set Code\u2026')
            }
          </span>
          {selectedSpec && mode !== 'csi_spec_only' && (
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono tracking-tight font-medium shrink-0" title={selectedSpec.description || undefined}>
              {selectedSpec.csi_number}
            </span>
          )}
        </span>
        {/* Full colored pill — only when showCostTypeSegment is true (Detail Panel) */}
        {showCostTypeSegment && costType && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${COST_TYPE_PILL[costType] || ''}`}>
            {costType}
          </span>
        )}
      </div>

      {/* ── Smart Popover ── */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-0.5 z-[200] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-80 overflow-hidden flex flex-col">

          {/* Search input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Rule C18: Escape CANCELS, closes popover (inline grid behavior)
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsOpen(false);
                    setSearchQuery('');
                  }
                }}
                placeholder="Search codes or descriptions\u2026"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Results list */}
          <div className="max-h-56 overflow-y-auto">
            {mode === 'csi_spec_only' && (
              <button
                onClick={() => {
                  onChange({ spec_number_id: null });
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800"
              >
                <span className="font-semibold italic">Clear Spec\u2026</span>
              </button>
            )}

            {/* Base codes — one row per suffix variant */}
            {filteredEntries.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                  Cost Codes
                </div>
                {filteredEntries.map((entry) => {
                  const isSelected = entry.code === value && entry.costType === costType;
                  return (
                    <button
                      key={`${entry.code}${entry.suffix}`}
                      onClick={() => handleSelectEntry(entry)}
                      className={`w-full text-left px-3 py-1.5 flex items-baseline gap-2 transition-colors ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-900/20'
                          : 'hover:bg-sky-50 dark:hover:bg-sky-900/20'
                      }`}
                    >
                      <span className={`text-xs tabular-nums font-semibold shrink-0 ${
                        isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200'
                      }`}>{entry.displayCode}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{entry.description}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* CSI specs */}
            {filteredCsiSpecs.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400 dark:text-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                  CSI Specs \u2014 This Project
                </div>
                {filteredCsiSpecs.map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => handleSelectCsiSpec(spec)}
                    disabled={!spec.cost_code}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 shrink-0">{spec.csi_number}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate">{spec.description}</span>
                    {spec.cost_code && (
                      <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono whitespace-nowrap">
                        \u2192 {spec.cost_code}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}

            {filteredEntries.length === 0 && filteredCsiSpecs.length === 0 && (
              <div className="px-3 py-5 text-xs text-slate-400 text-center italic">
                No matches found
              </div>
            )}
          </div>

          {/* ── Cost Type Segmented Control (Detail Panel only) ── */}
          {showCostTypeSegment && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                Cost Type
              </p>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {COST_TYPES.map((type, i) => (
                  <button
                    key={type}
                    onClick={() => handleSelectCostType(type)}
                    title={type}
                    className={`
                      flex-1 py-1.5 text-[10px] font-semibold transition-colors
                      ${i > 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''}
                      ${costType === type
                        ? 'bg-sky-500 text-white shadow-inner'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                      }
                    `}
                  >
                    {type.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
