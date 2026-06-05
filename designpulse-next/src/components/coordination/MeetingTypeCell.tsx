"use client";
import React, { useRef, useEffect } from 'react';
import type { CellContext } from '@tanstack/react-table';
import type { Opportunity, MeetingTypeConfig } from '@/types/models';
import { useUIStore } from '@/stores/useUIStore';

const EMPTY_OPTIONS: MeetingTypeConfig[] = [];

// eslint-disable-next-line react/display-name
export const MeetingTypeCell = React.memo(({ getValue, row, column, table }: CellContext<Opportunity, unknown>) => {
  const initialValue = getValue() as string | null | undefined;
  const updateMutation = table.options.meta?.updateData;
  const meetingTypes = ((table.options.meta as any)?.meetingTypes as MeetingTypeConfig[]) ?? EMPTY_OPTIONS;
  const permissions = (table.options.meta as any)?.permissions || { can_edit_records: false };

  const setActiveCell = useUIStore(state => state.setActiveCell);
  const setGridMode = useUIStore(state => state.setGridMode);
  const isCellActive = useUIStore(
    state => state.activeCell?.rowIndex === row.index && state.activeCell?.columnId === column.id
  );

  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isCellActive && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isCellActive]);

  return (
    <select
      ref={selectRef}
      onFocus={() => setActiveCell({ rowIndex: row.index, columnId: column.id })}
      value={initialValue || ''}
      disabled={!permissions.can_edit_records}
      onChange={(e) => {
        if (updateMutation) {
          updateMutation.mutate({ id: row.original.id, updates: { meeting_type: e.target.value || null } });
        }
        setGridMode('navigate');
      }}
      className={`w-full h-full bg-transparent border-none outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 relative px-2 py-1 text-sm font-medium cursor-pointer text-slate-900 dark:text-slate-100 ${isCellActive ? 'ring-2 ring-sky-400 bg-sky-50/50 dark:bg-sky-900/20' : ''}`}
    >
      <option value="">—</option>
      {meetingTypes.map((mt) => (
        <option key={mt.id} value={mt.label}>{mt.label}</option>
      ))}
    </select>
  );
});
