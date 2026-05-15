'use client';
/**
 * useChartTooltip — shared tooltip state hook for Budget Analytics charts.
 *
 * Encapsulates hover position + data payload so each chart component
 * doesn't duplicate the same state management (AGENTS.md D3).
 *
 * Usage:
 *   const { state, handlers } = useChartTooltip<MyTooltipData>();
 *   <rect onMouseMove={(e) => handlers.onMouseMove(e, rowData)} onMouseLeave={handlers.onMouseLeave} />
 *   {state.visible && <ChartTooltip x={state.x} y={state.y}><MyContent data={state.data} /></ChartTooltip>}
 */
import { useCallback, useState } from 'react';

export interface TooltipState<T> {
  visible: boolean;
  x: number;
  y: number;
  data: T | null;
}

export interface ChartTooltipHandlers<T> {
  onMouseMove: (e: React.MouseEvent, data: T) => void;
  onMouseLeave: () => void;
}

export function useChartTooltip<T>(): {
  state: TooltipState<T>;
  handlers: ChartTooltipHandlers<T>;
} {
  const [state, setState] = useState<TooltipState<T>>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  const onMouseMove = useCallback((e: React.MouseEvent, data: T) => {
    setState({ visible: true, x: e.clientX, y: e.clientY, data });
  }, []);

  const onMouseLeave = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return { state, handlers: { onMouseMove, onMouseLeave } };
}
