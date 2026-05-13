import { useRef, useCallback, useEffect } from 'react';
import { Table, Row, Column } from '@tanstack/react-table';
import { Virtualizer } from '@tanstack/react-virtual';

interface UseVirtualGridKeyboardNavigationProps<TData> {
  table: Table<TData>;
  virtualizer: Virtualizer<any, any>;
  onEnter?: (row: Row<TData>, colId: string) => void;
  onSpace?: (row: Row<TData>, colId: string) => void;
  onEscape?: () => void;
  getValidColumnIds?: (row: Row<TData>, visibleCols: Column<TData, unknown>[]) => string[];
}

export function useVirtualGridKeyboardNavigation<TData>({
  table,
  virtualizer,
  onEnter,
  onSpace,
  onEscape,
  getValidColumnIds
}: UseVirtualGridKeyboardNavigationProps<TData>) {
  const activeCoordinate = useRef<{ rowIndex: number; colId: string } | null>(null);

  const paintFocus = useCallback(() => {
    // 1. Remove focus class from any currently focused cell
    document.querySelectorAll('.keyboard-focused-cell').forEach(el => {
      el.classList.remove('keyboard-focused-cell');
    });

    if (!activeCoordinate.current) return;

    // 2. Add focus class to the target cell
    const { rowIndex, colId } = activeCoordinate.current;
    
    // We use the attributes we'll inject into the tds: data-row-index and data-col-id
    const targetCell = document.querySelector(`[data-row-index="${rowIndex}"][data-col-id="${colId}"]`);
    
    if (targetCell) {
      targetCell.classList.add('keyboard-focused-cell');
    }
  }, []);

  // Sync focus when virtualizer re-renders (recycles DOM nodes)
  useEffect(() => {
    // A simple way to keep the focus ring painted on scroll is to re-paint
    // it frequently. For a virtualizer, we can watch the virtualItems.
    // However, react-virtual doesn't expose a simple "onRender" callback,
    // so we can use a ResizeObserver or scroll event on the container, or 
    // simply let the component's render cycle trigger it via useEffect.
    const animationFrame = requestAnimationFrame(() => {
        paintFocus();
    });
    return () => cancelAnimationFrame(animationFrame);
  });

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Input Protection
    const targetTagName = (e.target as HTMLElement).tagName;
    if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA') {
      return;
    }

    const { rows } = table.getRowModel();
    if (rows.length === 0) return;

    const visibleCols = table.getVisibleLeafColumns();
    if (visibleCols.length === 0) return;

    // Default start position if nothing is focused yet
    if (!activeCoordinate.current) {
      if (['ArrowDown', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        const firstRow = rows[0];
        const validCols = getValidColumnIds ? getValidColumnIds(firstRow, visibleCols) : visibleCols.map(c => c.id);
        activeCoordinate.current = { rowIndex: 0, colId: validCols[0] || visibleCols[0].id };
        paintFocus();
      }
      return;
    }

    let { rowIndex, colId } = activeCoordinate.current;
    const currentRow = rows[rowIndex];
    
    // Helper to get valid columns for a specific row
    const getColsForRow = (row: Row<TData>) => {
      return getValidColumnIds ? getValidColumnIds(row, visibleCols) : visibleCols.map(c => c.id);
    };

    let validCols = getColsForRow(currentRow);

    let handled = false;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handled = true;
      if (rowIndex > 0) {
        rowIndex--;
        // Snap colId if moving to a row with grouped layout that swallows columns
        const newRowCols = getColsForRow(rows[rowIndex]);
        if (!newRowCols.includes(colId)) {
           // Fallback to first available column or master header
           colId = newRowCols[0] || visibleCols[0].id;
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handled = true;
      if (rowIndex < rows.length - 1) {
        rowIndex++;
        const newRowCols = getColsForRow(rows[rowIndex]);
        if (!newRowCols.includes(colId)) {
           colId = newRowCols[0] || visibleCols[0].id;
        }
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      handled = true;
      const cIdx = validCols.indexOf(colId);
      if (cIdx > 0) {
        colId = validCols[cIdx - 1];
      }
    } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      handled = true;
      const cIdx = validCols.indexOf(colId);
      if (cIdx >= 0 && cIdx < validCols.length - 1) {
        colId = validCols[cIdx + 1];
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (onEnter) onEnter(currentRow, colId);
      return;
    } else if (e.key === ' ') {
      e.preventDefault();
      if (onSpace) onSpace(currentRow, colId);
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (onEscape) onEscape();
      return;
    }

    if (handled) {
      activeCoordinate.current = { rowIndex, colId };
      
      // Virtualizer Syncing (Vertical Movement)
      const virtualItems = virtualizer.getVirtualItems();
      const isVisible = virtualItems.some(item => item.index === rowIndex);
      
      if (!isVisible) {
        // Must scroll to bring it into view
        virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
        
        // Wait for next frame so the DOM is updated by virtualizer
        requestAnimationFrame(() => {
          paintFocus();
        });
      } else {
        // If it's visible, just paint immediately
        paintFocus();
      }
    }

  }, [table, virtualizer, onEnter, onSpace, getValidColumnIds, paintFocus]);

  return { onKeyDown };
}
