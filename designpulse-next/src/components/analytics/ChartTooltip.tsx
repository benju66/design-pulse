'use client';
/**
 * ChartTooltip — Portal-rendered, cursor-following tooltip for Budget Analytics.
 *
 * Renders into document.body via React Portal to escape all overflow/z-index
 * stacking contexts. Viewport edge detection flips position to prevent clipping.
 *
 * Architecture:
 *  - Shared across all 3 analytics tabs (waterfall, allocation, risk trend)
 *  - Accepts children for flexible content per chart type
 *  - Framer Motion AnimatePresence for smooth enter/exit
 *  - pointer-events-none to avoid intercepting mouse events
 *  - Dark theme card with dark: variants (AGENTS.md C3)
 */
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  children: React.ReactNode;
}

const EDGE_MARGIN = 200; // px — flip threshold from viewport edge
const OFFSET = 12;       // px — distance from cursor

export function ChartTooltip({ visible, x, y, children }: ChartTooltipProps) {
  if (typeof window === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Flip horizontally when near right edge
  const left = x + EDGE_MARGIN > vw ? x - EDGE_MARGIN : x + OFFSET;
  // Flip vertically when near bottom edge
  const top = y + EDGE_MARGIN > vh ? y - EDGE_MARGIN : y + OFFSET;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.08 }}
          className="fixed z-[200] pointer-events-none"
          style={{ left, top }}
        >
          <div className="bg-slate-800 dark:bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 dark:border-slate-600 min-w-[180px] max-w-[280px]">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
