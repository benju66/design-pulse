import React from 'react';
import { Line } from 'react-konva';
import { Point, Zone } from '@/types/map.types';
import { ActiveStatus } from './MapLegend';
import { usePointerSample, type PointerStore } from '@/utils/pointerStore';

export interface StampPreviewProps {
  toolMode: string;
  selectedZoneId: string | null;
  // Pointer position lives outside React state — this leaf subscribes to the store
  // and re-renders at most once per frame (only while mounted in stamp mode).
  pointerStore: PointerStore;
  stageScale: number;
  zones: Zone[];
  activeStatuses?: ActiveStatus[];
  toPixels: (points: Point[]) => number[];
}

export const StampPreview: React.FC<StampPreviewProps> = ({
  toolMode,
  selectedZoneId,
  pointerStore,
  stageScale,
  zones,
  activeStatuses = [],
  toPixels
}) => {
  const pointer = usePointerSample(pointerStore);
  if (toolMode !== 'stamp' || !selectedZoneId || !pointer) return null;

  const sourceZone = zones.find(u => u.id === selectedZoneId);
  if (!sourceZone || !sourceZone.coordinates || sourceZone.coordinates.length === 0) return null;

  // Sample pctX/pctY are already in sheet-normalized space (converted in the parent
  // against the live transform), so no screen→logical conversion is needed here.
  const pctX = pointer.pctX;
  const pctY = pointer.pctY;

  let sumX = 0, sumY = 0;
  sourceZone.coordinates.forEach(pt => { sumX += pt.pctX; sumY += pt.pctY; });
  const cx = sumX / sourceZone.coordinates.length;
  const cy = sumY / sourceZone.coordinates.length;
  const dx = pctX - cx;
  const dy = pctY - cy;

  const translatedPoints = sourceZone.coordinates.map(pt => ({
    pctX: pt.pctX + dx,
    pctY: pt.pctY + dy
  }));

  const activeStatus = activeStatuses.find((s) => s.zone_id === selectedZoneId);
  let fillColor = 'rgba(139, 92, 246, 0.3)';
  let strokeColor = '#8b5cf6';
  if (activeStatus?.status_color) {
    strokeColor = activeStatus.status_color;
    fillColor = activeStatus.status_color.replace('rgb', 'rgba').replace(')', ', 0.3)');
  } else if (sourceZone.color) {
    strokeColor = sourceZone.color;
    fillColor = sourceZone.color.replace('rgb', 'rgba').replace(')', ', 0.3)');
  }

  return (
    <Line
      points={toPixels(translatedPoints)}
      stroke={strokeColor}
      strokeWidth={2 / stageScale}
      dash={[6 / stageScale, 6 / stageScale]}
      fill={fillColor}
      closed={true}
      listening={false}
    />
  );
}

export default StampPreview;
