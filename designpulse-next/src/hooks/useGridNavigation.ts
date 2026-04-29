import { KeyboardEvent } from 'react';
import { Table } from '@tanstack/react-table';
import { useUIStore } from '@/stores/useUIStore';

export function useGridNavigation<TData>(
  table: Table<TData>,
  virtualizer?: { scrollToIndex: (index: number, options?: any) => void }
) {
  const activeCell = useUIStore(state => state.activeCell);
  const setActiveCell = useUIStore(state => state.setActiveCell);
  const gridMode = useUIStore(state => state.gridMode);
  const setGridMode = useUIStore(state => state.setGridMode);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (gridMode !== 'navigate') return;
    if (!activeCell) return;

    const { rowIndex, columnId } = activeCell;
    const rows = table.getRowModel().rows;
    const leafColumns = table.getVisibleLeafColumns();
    
    const excludedColumns = ['select', 'open_panel', 'options', 'expander'];
    const navigableColumns = leafColumns.filter(col => !excludedColumns.includes(col.id));

    const currentColIndex = navigableColumns.findIndex(col => col.id === columnId);
    
    if (currentColIndex === -1 && e.key.startsWith('Arrow')) return;

    let nextRowIndex = rowIndex;
    let nextColIndex = currentColIndex;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        nextRowIndex = Math.max(0, rowIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextRowIndex = Math.min(rows.length - 1, rowIndex + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextColIndex = Math.max(0, currentColIndex - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextColIndex = Math.min(navigableColumns.length - 1, currentColIndex + 1);
        break;
      case 'Enter':
        e.preventDefault();
        setGridMode('edit');
        return;
      default:
        return;
    }

    const nextRow = rows[nextRowIndex];
    let finalColIndex = nextColIndex;

    if (nextRow && nextRow.depth === 1) {
      const validSubRowCols = ['title', 'cost_impact', 'days_impact'];
      const targetColId = navigableColumns[nextColIndex]?.id;
      if (targetColId && !validSubRowCols.includes(targetColId)) {
        const validIndices = navigableColumns
          .map((col, idx) => validSubRowCols.includes(col.id) ? idx : -1)
          .filter(idx => idx !== -1);
        
        if (validIndices.length > 0) {
          finalColIndex = validIndices.reduce((prev, curr) => 
            Math.abs(curr - nextColIndex) < Math.abs(prev - nextColIndex) ? curr : prev
          );
        }
      }
    }

    if (nextRowIndex !== rowIndex || finalColIndex !== currentColIndex) {
      setActiveCell({
        rowIndex: nextRowIndex,
        columnId: navigableColumns[finalColIndex].id
      });
      
      if (nextRowIndex !== rowIndex && virtualizer) {
        virtualizer.scrollToIndex(nextRowIndex, { align: 'auto' });
      }
    }
  };

  const moveActiveCell = (direction: 'down' | 'right' | 'left' | 'up') => {
    if (!activeCell) return;
    const { rowIndex, columnId } = activeCell;
    const rows = table.getRowModel().rows;
    const navigableColumns = table.getVisibleLeafColumns().filter(col => !['select', 'open_panel', 'options', 'expander'].includes(col.id));
    const currentColIndex = navigableColumns.findIndex(col => col.id === columnId);

    let nextRowIndex = rowIndex;
    let nextColIndex = currentColIndex;

    if (direction === 'down') nextRowIndex = Math.min(rows.length - 1, rowIndex + 1);
    if (direction === 'up') nextRowIndex = Math.max(0, rowIndex - 1);
    
    if (direction === 'right') {
      if (currentColIndex < navigableColumns.length - 1) {
        nextColIndex = currentColIndex + 1;
      } else if (rowIndex < rows.length - 1) {
        nextRowIndex = rowIndex + 1;
        nextColIndex = 0;
      }
    }
    
    if (direction === 'left') {
      if (currentColIndex > 0) {
        nextColIndex = currentColIndex - 1;
      } else if (rowIndex > 0) {
        nextRowIndex = rowIndex - 1;
        nextColIndex = navigableColumns.length - 1;
      }
    }

    const nextRow = rows[nextRowIndex];
    let finalColIndex = nextColIndex;

    if (nextRow && nextRow.depth === 1) {
      const validSubRowCols = ['title', 'cost_impact', 'days_impact'];
      const targetColId = navigableColumns[nextColIndex]?.id;
      if (targetColId && !validSubRowCols.includes(targetColId)) {
        const validIndices = navigableColumns
          .map((col, idx) => validSubRowCols.includes(col.id) ? idx : -1)
          .filter(idx => idx !== -1);
        
        if (validIndices.length > 0) {
          finalColIndex = validIndices.reduce((prev, curr) => 
            Math.abs(curr - nextColIndex) < Math.abs(prev - nextColIndex) ? curr : prev
          );
        }
      }
    }

    setActiveCell({
      rowIndex: nextRowIndex,
      columnId: navigableColumns[finalColIndex].id
    });

    if (nextRowIndex !== rowIndex && virtualizer) {
      virtualizer.scrollToIndex(nextRowIndex, { align: 'auto' });
    }
  };

  return { handleKeyDown, moveActiveCell };
}
