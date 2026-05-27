'use client';

import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { CoordGroupConfig } from '@/types/models';
import { GroupContextMenu } from './GroupContextMenu';
import { UNASSIGNED_GROUP_ID } from '@/lib/constants';

interface CoordinationGroupHeaderRowProps {
  group: CoordGroupConfig | null; // null = Unassigned
  groupId: string;
  itemCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onRename: (newLabel: string) => void;
  onColorChange: (newColor: string) => void;
  onSelectAll: () => void;
  onDelete: () => void;
  totalWidth: number;
  visibleColumnCount: number;
  style?: React.CSSProperties;
  measureElement?: (element: Element | null) => void;
  dataIndex?: number;
}

// eslint-disable-next-line react/display-name
const CoordinationGroupHeaderRow = React.memo(function CoordinationGroupHeaderRow({
  group,
  groupId,
  itemCount,
  isCollapsed,
  onToggle,
  onRename,
  onColorChange,
  onSelectAll,
  onDelete,
  totalWidth,
  visibleColumnCount,
  style,
  measureElement,
  dataIndex,
}: CoordinationGroupHeaderRowProps) {
  const isUnassigned = groupId === UNASSIGNED_GROUP_ID;
  const color = group?.color ?? '#94a3b8'; // slate-400 for Unassigned
  const label = group?.label ?? 'Unassigned';

  return (
    <tbody
      ref={measureElement}
      data-index={dataIndex}
      style={style}
    >
      <tr
        className="group/header cursor-pointer select-none hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
        onClick={onToggle}
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <td
          colSpan={visibleColumnCount}
          className="p-0"
          style={{ minWidth: totalWidth }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Collapse toggle */}
            <span className="text-slate-400 dark:text-slate-500 shrink-0">
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </span>

            {/* Color dot */}
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />

            {/* Label */}
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {label}
            </span>

            {/* Item count */}
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
              ({itemCount})
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Context menu — only for user-defined groups */}
            {!isUnassigned && group && (
              <div
                className="opacity-0 group-hover/header:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <GroupContextMenu
                  group={group}
                  onRename={onRename}
                  onColorChange={onColorChange}
                  onSelectAll={onSelectAll}
                  onDelete={onDelete}
                />
              </div>
            )}
          </div>
        </td>
      </tr>
    </tbody>
  );
});

export { CoordinationGroupHeaderRow };
