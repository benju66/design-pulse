import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { CompanyCsiDefault } from '@/types/models';

function normalizeSearch(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface SmartCsiComboboxProps {
  value: string | null | undefined;
  onChange: (updates: { normalized_csi_number: string; cost_code?: string | null }) => void;
  companyDefaults: CompanyCsiDefault[];
  disabled?: boolean;
}

export function SmartCsiCombobox({
  value,
  onChange,
  companyDefaults,
  disabled = false,
}: SmartCsiComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (containerRef.current) {
          setRect(containerRef.current.getBoundingClientRect());
        }
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition, true);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition, true);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const nq = normalizeSearch(searchQuery);

  const filteredDefaults = companyDefaults.filter((def) => {
    if (!searchQuery) return true;
    return (
      normalizeSearch(def.csi_number).includes(nq) ||
      normalizeSearch(def.normalized_csi_number).includes(nq) ||
      normalizeSearch(def.description || '').includes(nq)
    );
  });

  const handleSelectDefault = (def: CompanyCsiDefault) => {
    onChange({
      normalized_csi_number: def.normalized_csi_number,
      cost_code: def.cost_code,
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCustomSubmit = () => {
    if (!searchQuery.trim()) return;
    onChange({
      normalized_csi_number: searchQuery.trim(),
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  const isEmpty = !value;
  const match = companyDefaults.find(d => d.normalized_csi_number === value);
  const displayValue = match ? `${match.csi_number} - ${match.description}` : value;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div
        onClick={() => { if (!disabled) setIsOpen(true); }}
        className={`
          w-full h-full px-2 py-1 text-xs min-h-[28px] flex items-center gap-1.5
          ${disabled ? 'cursor-not-allowed opacity-75 bg-slate-50 dark:bg-slate-800/30' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}
          ${isOpen ? 'ring-2 ring-inset ring-sky-500 bg-sky-50/50 dark:bg-sky-900/20' : ''}
        `}
      >
        <span className={`truncate flex-1 flex items-center gap-1 min-w-0 ${
          isEmpty ? 'text-slate-400 italic' : 'text-slate-800 dark:text-slate-100 font-mono tracking-tight'
        }`}>
          <span className="truncate text-xs">
            {displayValue || 'e.g. 09 65 16'}
          </span>
        </span>
      </div>

      {isOpen && rect && typeof document !== 'undefined' && createPortal(
        <div 
          ref={popoverRef}
          className="fixed z-[200] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-80 overflow-hidden flex flex-col"
          style={{
            top: rect.bottom + 4,
            left: rect.left,
            maxWidth: 'calc(100vw - 16px)',
          }}
        >
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsOpen(false);
                    setSearchQuery('');
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredDefaults.length === 1) {
                      handleSelectDefault(filteredDefaults[0]);
                    } else if (searchQuery.trim().length > 0) {
                      handleCustomSubmit();
                    }
                  }
                }}
                placeholder="Search CSI or type custom..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
            {searchQuery.trim() && (
              <button
                onClick={handleCustomSubmit}
                className="w-full mt-2 text-left px-2 py-1.5 text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded transition-colors"
              >
                Use custom: <span className="font-mono font-semibold">&quot;{searchQuery.trim()}&quot;</span>
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filteredDefaults.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                  Company Defaults
                </div>
                {filteredDefaults.map((def) => {
                  const isSelected = def.normalized_csi_number === value;
                  return (
                    <button
                      key={def.id}
                      onClick={() => handleSelectDefault(def)}
                      className={`w-full text-left px-3 py-1.5 flex items-baseline gap-2 transition-colors ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-900/20'
                          : 'hover:bg-sky-50 dark:hover:bg-sky-900/20'
                      }`}
                    >
                      <span className={`text-xs tabular-nums font-mono shrink-0 ${
                        isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200'
                      }`}>{def.csi_number}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{def.description}</span>
                    </button>
                  );
                })}
              </>
            )}

            {filteredDefaults.length === 0 && (
              <div className="px-3 py-5 text-xs text-slate-400 text-center italic">
                No standard found. Press Enter to use custom.
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
