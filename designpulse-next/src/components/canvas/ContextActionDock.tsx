import React from 'react';
import { Copy, FlipHorizontal, FlipVertical, Pencil, Trash2, Stamp, RotateCcw, RotateCw, Flag, Activity, History, LucideIcon } from 'lucide-react';

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  colorClass?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-white/10`}
    >
      <Icon size={18} /> <span className="hidden lg:inline">{label}</span>
    </button>
  );
};

import { ToolMode } from '@/types/map.types';

export interface ContextActionDockProps {
  selectedZoneIds: string[];
  onToolModeChange?: (mode: ToolMode) => void;
  onRenameZone?: (id: string) => void;
  onDuplicateZone?: (id: string) => void;
  handleFlip?: (direction: 'horizontal' | 'vertical') => void;
  handleRotatePolygon?: (direction: 'left' | 'right') => void;
  onDeleteZone?: (id: string | string[]) => void;
  onOpenMilestoneModal?: (id: string) => void;
  onOpenStatusModal?: (id: string) => void;
  onOpenHistoryModal?: (id: string) => void;
  isLegendSelected?: boolean;
  onRotateLegend?: (direction: 'left' | 'right') => void;
  onHideLegend?: () => void;
}

export const ContextActionDock: React.FC<ContextActionDockProps> = ({
  selectedZoneIds,
  onToolModeChange,
  onRenameZone,
  onDuplicateZone,
  handleFlip,
  handleRotatePolygon,
  onDeleteZone,
  onOpenMilestoneModal,
  onOpenStatusModal,
  onOpenHistoryModal,
  isLegendSelected,
  onRotateLegend,
  onHideLegend
}) => {
  if ((!selectedZoneIds || selectedZoneIds.length === 0) && !isLegendSelected) return null;

  const isMulti = selectedZoneIds?.length > 1;
  const isSingle = selectedZoneIds?.length === 1;
  const targetId = isSingle ? selectedZoneIds[0] : null;

  const dockClass = 'pointer-events-auto flex flex-col gap-1 p-2 rounded-2xl border shadow-xl backdrop-blur-md z-20';

  if (isLegendSelected) {
    return (
      <div
        className={`${dockClass} absolute left-3 top-1/2 -translate-y-1/2`}
        style={{
          background: 'var(--glass-bg, rgba(255, 255, 255, 0.7))',
          borderColor: 'var(--glass-border, rgba(226, 232, 240, 0.5))',
        }}
      >
        <ActionButton
          icon={RotateCcw}
          label="Rotate Left"
          onClick={() => onRotateLegend?.('left')}
          colorClass="emerald"
        />
        <ActionButton
          icon={RotateCw}
          label="Rotate Right"
          onClick={() => onRotateLegend?.('right')}
          colorClass="emerald"
        />
        <div className="h-px bg-slate-200/80 dark:bg-white/10 mx-1 my-1" />
        <ActionButton 
          icon={Trash2} 
          label="Delete" 
          onClick={() => onHideLegend?.()} 
          colorClass="red" 
        />
      </div>
    );
  }

  return (
    <div
      className={`${dockClass} absolute left-3 top-1/2 -translate-y-1/2`}
      style={{
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.7))',
        borderColor: 'var(--glass-border, rgba(226, 232, 240, 0.5))',
      }}
    >
      {isSingle && targetId && (
        <>
          <ActionButton
            icon={Stamp}
            label="Stamp Trace"
            onClick={() => onToolModeChange?.('stamp')}
            colorClass="fuchsia"
          />
          <ActionButton 
            icon={Pencil} 
            label="Rename" 
            onClick={() => onRenameZone?.(targetId)} 
            colorClass="purple" 
          />
          <ActionButton 
            icon={Copy} 
            label="Duplicate" 
            onClick={() => onDuplicateZone?.(targetId)} 
            colorClass="purple" 
          />
        </>
      )}
      <ActionButton 
        icon={FlipHorizontal} 
        label="Flip H" 
        onClick={() => handleFlip?.('horizontal')} 
        colorClass="purple" 
      />
      <ActionButton 
        icon={FlipVertical} 
        label="Flip V" 
        onClick={() => handleFlip?.('vertical')} 
        colorClass="purple" 
      />
      <ActionButton
        icon={RotateCcw}
        label="Rotate Left"
        onClick={() => handleRotatePolygon?.('left')}
        colorClass="emerald"
      />
      <ActionButton
        icon={RotateCw}
        label="Rotate Right"
        onClick={() => handleRotatePolygon?.('right')}
        colorClass="emerald"
      />
      {isSingle && targetId && (
        <>
          <ActionButton
            icon={Flag}
            label="Set Milestone"
            onClick={() => onOpenMilestoneModal?.(targetId)}
            colorClass="amber"
          />
          <ActionButton
            icon={Activity}
            label="Set Status"
            onClick={() => onOpenStatusModal?.(targetId)}
            colorClass="amber"
          />
          <ActionButton
            icon={History}
            label="History"
            onClick={() => onOpenHistoryModal?.(targetId)}
            colorClass="blue"
          />
        </>
      )}
      <div className="h-px bg-slate-200/80 dark:bg-white/10 mx-1 my-1" />
      <ActionButton 
        icon={Trash2} 
        label={isMulti ? "Delete All" : "Delete"} 
        onClick={() => onDeleteZone?.(isMulti ? selectedZoneIds : targetId!)} 
        colorClass="red" 
      />
    </div>
  );
}

export default ContextActionDock;
