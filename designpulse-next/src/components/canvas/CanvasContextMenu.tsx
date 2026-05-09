import React, { useEffect, useRef } from 'react';
import { Copy, FlipHorizontal, FlipVertical, Pencil, RotateCcw, RotateCw, Trash2 } from 'lucide-react';

export interface ContextMenuState {
  x: number;
  y: number;
  zoneId: string;
}

export interface CanvasContextMenuProps {
  contextMenu: ContextMenuState | null;
  setContextMenu: (menu: ContextMenuState | null) => void;
  dimensions: { width: number; height: number };
  onRenameZone?: (id: string) => void;
  onDuplicateZone?: (id: string) => void;
  handleFlip?: (direction: 'horizontal' | 'vertical') => void;
  handleRotatePolygon?: (direction: 'left' | 'right', id: string) => void;
  onDeleteZone?: (id: string) => void;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  contextMenu,
  setContextMenu,
  dimensions,
  onRenameZone,
  onDuplicateZone,
  handleFlip,
  handleRotatePolygon,
  onDeleteZone
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    // Rule C.16: Use pointerdown/mousedown instead of synthetic onClick
    const handleOutsideClick = (e: MouseEvent | PointerEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  // Calculate position to prevent menu from going off-screen
  const menuWidth = 200;
  const menuHeight = 280;
  
  let left = contextMenu.x;
  let top = contextMenu.y;

  if (left + menuWidth > dimensions.width) {
    left = dimensions.width - menuWidth - 10;
  }
  
  if (top + menuHeight > dimensions.height) {
    top = dimensions.height - menuHeight - 10;
  }

  const handleAction = (action: () => void) => {
    action();
    setContextMenu(null);
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 p-1.5 flex flex-col min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{
        left,
        top,
      }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <button 
        type="button" 
        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors"
        onClick={() => handleAction(() => onRenameZone?.(contextMenu.zoneId))}
      >
        <Pencil size={16} className="text-purple-500" /> Rename
      </button>
      <button 
        type="button" 
        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors"
        onClick={() => handleAction(() => onDuplicateZone?.(contextMenu.zoneId))}
      >
        <Copy size={16} className="text-purple-500" /> Duplicate
      </button>
      
      <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
      
      <button 
        type="button" 
        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors"
        onClick={() => handleAction(() => handleFlip?.('horizontal'))}
      >
        <FlipHorizontal size={16} className="text-blue-500" /> Flip Horizontal
      </button>
      <button 
        type="button" 
        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors"
        onClick={() => handleAction(() => handleFlip?.('vertical'))}
      >
        <FlipVertical size={16} className="text-blue-500" /> Flip Vertical
      </button>
      
      <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
      
      <button 
        type="button" 
        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors"
        onClick={() => handleAction(() => handleRotatePolygon?.('left', contextMenu.zoneId))}
      >
        <RotateCcw size={16} className="text-emerald-500" /> Rotate Left
      </button>
      <button 
        type="button" 
        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors"
        onClick={() => handleAction(() => handleRotatePolygon?.('right', contextMenu.zoneId))}
      >
        <RotateCw size={16} className="text-emerald-500" /> Rotate Right
      </button>

      <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
      
      <button 
        type="button" 
        className="flex items-center gap-3 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-sm text-red-600 transition-colors"
        onClick={() => handleAction(() => onDeleteZone?.(contextMenu.zoneId))}
      >
        <Trash2 size={16} /> Delete
      </button>
    </div>
  );
};

export default CanvasContextMenu;
