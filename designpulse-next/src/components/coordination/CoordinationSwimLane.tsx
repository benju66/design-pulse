'use client';

import { useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Opportunity, CoordGroupConfig, ProjectSettings, ProjectMember } from '@/types/models';
import { CoordinationColumn } from './CoordinationColumn';
import { CoordinationCard } from './CoordinationCard';
import type { UseMutationResult } from '@tanstack/react-query';

interface CoordinationSwimLaneProps {
  group: CoordGroupConfig | null;  // null = Unassigned
  groupId: string;
  opportunities: Opportunity[];
  columns: { id: string; title: string }[];
  isCollapsed: boolean;
  onToggle: () => void;
  updateMutation: UseMutationResult<Opportunity, Error, { id: string; updates: Partial<Opportunity> }, unknown>;
  settings: ProjectSettings | undefined;
  members: ProjectMember[];
}

export function CoordinationSwimLane({
  group,
  groupId,
  opportunities,
  columns,
  isCollapsed,
  onToggle,
  updateMutation,
  settings,
  members,
}: CoordinationSwimLaneProps) {
  const color = group?.color ?? '#94a3b8';
  const label = group?.label ?? 'Unassigned';

  const columnOpps = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const col of columns) {
      map[col.id] = opportunities.filter(o => (o.coordination_status || 'Draft') === col.id);
    }
    return map;
  }, [opportunities, columns]);

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 last:border-b-0">
      {/* Swim lane header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors text-left"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <span className="text-slate-400 dark:text-slate-500 shrink-0">
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </span>
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
          {label}
        </span>
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
          ({opportunities.length})
        </span>
      </button>

      {/* Columns row — hidden when collapsed */}
      {!isCollapsed && (
        <div className="flex gap-4 px-4 pb-4 pt-2">
          {columns.map((col) => {
            const colOpps = columnOpps[col.id] ?? [];
            return (
              <CoordinationColumn
                key={`${groupId}:${col.id}`}
                id={`${groupId}:${col.id}`}
                title={col.title}
                count={colOpps.length}
              >
                {colOpps.map(opp => (
                  <CoordinationCard
                    key={opp.id}
                    opportunity={opp}
                    updateMutation={updateMutation}
                    settings={settings}
                    members={members}
                  />
                ))}
              </CoordinationColumn>
            );
          })}
        </div>
      )}
    </div>
  );
}
