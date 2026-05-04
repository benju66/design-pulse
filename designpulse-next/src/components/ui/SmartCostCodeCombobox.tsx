import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { CostType, CostCode, ProjectCsiSpec } from '@/types/models';

const COST_TYPE_PILL: Record<string, string> = {
  Labor:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Material:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Subcontract: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Equipment:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Other:       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const COST_TYPES: CostType[] = ['Labor', 'Material', 'Subcontract', 'Equipment', 'Other'];

// iOS-safe normalization: strip non-alphanumeric, lowercase (no negative lookbehind)
function normalizeSearch(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface SmartCostCodeComboboxProps {
  value: string | null | undefined;
  costType?: CostType | null | undefined;
  specNumberId?: string | null | undefined;
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

  const filteredBaseCodes = rawCostCodes.filter((c) => {
    if (c.is_division) return false;
    if (!searchQuery) return true;
    return normalizeSearch(c.code).includes(nq) || normalizeSearch(c.description || '').includes(nq);
  });

  const filteredCsiSpecs = csiSpecs.filter((spec) => {
    if (!searchQuery) return true;
    return (
      spec.normalized_csi_number.includes(nq) ||
      normalizeSearch(spec.csi_number).includes(nq) ||
      normalizeSearch(spec.description || '').includes(nq)
    );
  });

  // Rule C23: atomic onChange mutation — never onBlur
  const handleSelectBaseCode = (code: string) => {
    const updates: { cost_code: string; division?: string; spec_number_id: string | null } = { 
      cost_code: code,
      spec_number_id: null // clear spec if base code is manually selected
    };
    const matched = rawCostCodes.find((c) => c.code === code && !c.is_division);
    if (matched?.parent_division) {
      const parentDiv = rawCostCodes.find((c) => c.code === matched.parent_division && c.is_division);
      if (parentDiv) updates.division = `${parentDiv.code} - ${parentDiv.description}`;
    }
    onChange(updates);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCsiSpec = (spec: ProjectCsiSpec) => {
    if (!spec.cost_code) return;
    const updates: { cost_code: string; division?: string; spec_number_id: string } = { 
      cost_code: spec.cost_code,
      spec_number_id: spec.id
    };
    const matched = rawCostCodes.find((c) => c.code === spec.cost_code && !c.is_division);
    if (matched?.parent_division) {
      const parentDiv = rawCostCodes.find((c) => c.code === matched.parent_division && c.is_division);
      if (parentDiv) updates.division = `${parentDiv.code} - ${parentDiv.description}`;
    }
    onChange(updates);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCostType = (type: CostType) => {
    onChange({ cost_type: type });
  };

  const isEmpty = !value;
  const selectedSpec = specNumberId ? csiSpecs.find(s => s.id === specNumberId) : undefined;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* ── Read-only display ── */}
      <div
        onClick={() => { if (!disabled) setIsOpen(true); }}
        className={`
          w-full h-full px-2 py-1 text-sm min-h-[28px] flex items-center gap-1.5
          ${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}
          ${isOpen ? 'ring-2 ring-inset ring-sky-500 bg-sky-50/50 dark:bg-sky-900/20' : ''}
        `}
      >
        <span className={`truncate flex-1 ${isEmpty ? 'text-slate-400 italic' : 'text-slate-900 dark:text-slate-100'}`}>
          {value || 'Set Code…'}
          {selectedSpec && (
            <span className="ml-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono tracking-tight font-medium" title={selectedSpec.description || undefined}>
              {selectedSpec.csi_number}
            </span>
          )}
        </span>
        {showCostTypeSegment && costType && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${COST_TYPE_PILL[costType] || ''}`}>
            {costType}
          </span>
        )}
      </div>

      {/* ── Smart Popover ── */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-0.5 z-[200] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-72 overflow-hidden flex flex-col">

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
                placeholder="Search codes or descriptions…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Results list */}
          <div className="max-h-52 overflow-y-auto">
            {/* Base codes */}
            {filteredBaseCodes.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                  Cost Codes
                </div>
                {filteredBaseCodes.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => handleSelectBaseCode(c.code)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                      value === c.code
                        ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                    }`}
                  >
                    <span className="font-mono font-semibold shrink-0">{c.code}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate text-right text-[11px]">{c.description}</span>
                  </button>
                ))}
              </>
            )}

            {/* CSI specs */}
            {filteredCsiSpecs.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400 dark:text-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                  CSI Specs — This Project
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
                        → {spec.cost_code}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}

            {filteredBaseCodes.length === 0 && filteredCsiSpecs.length === 0 && (
              <div className="px-3 py-5 text-xs text-slate-400 text-center italic">
                No matches found
              </div>
            )}
          </div>

          {/* ── Cost Type Segmented Control ── */}
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
