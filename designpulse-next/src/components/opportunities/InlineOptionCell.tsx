import React, { useState, useEffect } from 'react';
import { CellContext } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

interface InlineOptionCellProps {
  context: CellContext<Opportunity, unknown>;
}

export const InlineOptionCell = React.memo(({ context }: InlineOptionCellProps) => {
  const { row, column, table } = context;
  const meta = table.options.meta;
  const optionsMap = meta?.optionsMap || {};
  const createOption = meta?.createOption;
  const updateOption = meta?.updateOption;
  const permissions = meta?.permissions;

  const opportunityId = row.original.id;
  const projectId = row.original.project_id;
  const orderIndex = (column.columnDef.meta as any)?.order_index as number;
  const field = (column.columnDef.meta as any)?.field as 'title' | 'cost_impact';

  const options = optionsMap[opportunityId] || [];
  const option = options.find((o) => o.order_index === orderIndex);

  const initialValue = option ? option[field] : (field === 'cost_impact' ? '' : '');
  const [value, setValue] = useState<string | number>(initialValue || '');
  
  // Sync state if props change (structural sharing allows this to be performant)
  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const isLocked = option?.is_locked || row.original.status === 'Approved';
  const canEdit = permissions?.can_edit_records && !isLocked;

  const handleBlur = () => {
    let parsedValue = value;
    if (field === 'cost_impact') {
      parsedValue = Number(value);
      if (isNaN(parsedValue)) parsedValue = 0;
    }

    if (parsedValue === initialValue) return;
    if (parsedValue === '' && !option) return; // Don't create empty options

    if (option) {
      updateOption?.({ id: option.id, updates: { [field]: parsedValue } });
    } else {
      createOption?.({
        opportunityId,
        option: {
          project_id: projectId,
          order_index: orderIndex,
          [field]: parsedValue
        } as any
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // Trigger blur to save
    }
    if (e.key === 'Escape') {
      setValue(initialValue || '');
      e.currentTarget.blur();
    }
  };

  if (!canEdit) {
    return (
      <div className="px-2 py-1 truncate text-slate-500 w-full h-full flex items-center">
        {field === 'cost_impact' 
          ? (typeof initialValue === 'number' ? `$${initialValue.toLocaleString()}` : '') 
          : initialValue}
      </div>
    );
  }

  return (
    <input
      type={field === 'cost_impact' ? 'number' : 'text'}
      className="w-full h-full bg-transparent border-none outline-none px-2 py-1 focus:bg-slate-50 dark:focus:bg-slate-800/50 transition-colors rounded ring-inset focus:ring-1 focus:ring-sky-500"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={field === 'cost_impact' ? 'Cost' : 'Add Contender...'}
    />
  );
}, (prev, next) => {
  // Deep performance optimization (AGENTS.md C10): 
  // Rely exclusively on the original row reference changing
  return prev.context.row.original === next.context.row.original && 
         prev.context.column.id === next.context.column.id;
});
