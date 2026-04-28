import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';

interface AssigneeSelectProps {
  value: string;
  onChange: (newValue: string) => void;
  onClose?: () => void;
  members: any[];
  autoFocus?: boolean;
}

export function AssigneeSelect({ value, onChange, onClose, members, autoFocus }: AssigneeSelectProps) {
  const [selectedEmails, setSelectedEmails] = useState<string[]>(
    value ? value.split(',').map(e => e.trim()).filter(Boolean) : []
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && dropdownRef.current) {
      dropdownRef.current.focus();
    }
  }, [autoFocus]);

  const [isOpen, setIsOpen] = useState(autoFocus || false);

  useEffect(() => {
    if (autoFocus && !isOpen) {
      setIsOpen(true);
    }
  }, [autoFocus]);

  const toggleEmail = (email: string) => {
    let newSelected;
    if (selectedEmails.includes(email)) {
      newSelected = selectedEmails.filter(e => e !== email);
    } else {
      newSelected = [...selectedEmails, email];
    }
    setSelectedEmails(newSelected);
    onChange(newSelected.join(','));
  };

  return (
    <div 
      ref={dropdownRef}
      tabIndex={0}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsOpen(false);
          onClose?.();
        }
      }}
      className="relative w-full"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none text-left flex justify-between items-center"
      >
        <span className="truncate">
          {selectedEmails.length > 0 ? `${selectedEmails.length} Assigned` : 'Unassigned'}
        </span>
        <span className="text-slate-400 text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-lg p-2 z-50 outline-none">
          <div className="text-xs font-semibold text-slate-500 mb-2 px-2 uppercase tracking-wider">Assign Users</div>
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
        {members.map(m => {
          const isSelected = selectedEmails.includes(m.email);
          const isLegacySelected = selectedEmails.includes(m.name);
          const active = isSelected || isLegacySelected;
          
          return (
            <button
              key={m.user_id}
              onClick={() => toggleEmail(m.email)}
              className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {(m.name || m.email).substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{m.name || m.email}</span>
                </div>
              </div>
              {active && <Check size={16} className="text-sky-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
      )}
    </div>
  );
}
