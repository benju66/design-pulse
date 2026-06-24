import React from 'react';
import { usePointerSample, type PointerStore } from '@/utils/pointerStore';

export interface CrosshairOverlayProps {
  pointerStore: PointerStore;
}

/**
 * Full-bleed dashed crosshair that tracks the cursor. Extracted into its own
 * component so it can subscribe to the pointer store directly — the crosshair
 * re-renders at most once per frame instead of forcing a whole-canvas re-render
 * on every mouse move (which is what a `pointerPos` React state prop did).
 */
export const CrosshairOverlay: React.FC<CrosshairOverlayProps> = ({ pointerStore }) => {
  const pointer = usePointerSample(pointerStore);
  if (!pointer) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden mix-blend-difference opacity-40">
      <div
        className="absolute top-0 bottom-0 border-l border-dashed border-white"
        style={{ left: pointer.screenX }}
      />
      <div
        className="absolute left-0 right-0 border-t border-dashed border-white"
        style={{ top: pointer.screenY }}
      />
    </div>
  );
};

export default CrosshairOverlay;
