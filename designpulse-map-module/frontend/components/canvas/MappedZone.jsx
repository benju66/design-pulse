import React, { useState, useEffect } from 'react';
import { Group, Line, Circle } from 'react-konva';
import { getSnappedCoordinate } from '@/utils/geometry';

export const MappedZoneComponent = ({
  zone,
  isSelected,
  isHovered,
  toolMode,
  layout,
  stageScale,
  vectorTree,
  aspect,
  enableSnapping,
  snappingStrength,
  settings,
  activeDragNode,
  activeDragPolygon,
  isShiftDown,
  isZoomedOut,
  computedCursor,
  mixAlpha,
  toPixels,
  setHoveredZone,
  setActiveDragPolygon,
  handlePolygonDragEnd,
  handlePolygonClick,
  onSelectZone,
  onToolModeChange,
  setContextMenu,
  setIsHoveringAnchor,
  setActiveDragNode,
  handleAnchorDragEnd,
  handleAnchorClick
}) => {
  const [optimisticCoords, setOptimisticCoords] = useState(null);

  useEffect(() => {
    setOptimisticCoords(null);
  }, [zone.polygon_coordinates]);

  const highlight = (isSelected || isHovered);
  
  // Dynamic styling passed directly from the parent or zone object
  const baseColor = zone.color || '#475569';
  const opacity = zone.opacity ?? 0.8;
  const strokeColor = zone.strokeColor || baseColor;
  const strokeWidthBase = zone.strokeWidth || 2.5;
  const dashPattern = zone.dash || [];

  let currentFill = mixAlpha ? mixAlpha(baseColor, opacity) : baseColor;
  let currentStroke = highlight ? (isSelected ? '#8b5cf6' : '#0ea5e9') : strokeColor;

  const basePolygon = optimisticCoords || zone.polygon_coordinates;
  const currentPoints = toPixels(
    activeDragNode?.zoneId === zone.id
      ? basePolygon.map((p, i) =>
          i === activeDragNode.index ? { pctX: activeDragNode.pctX, pctY: activeDragNode.pctY } : p
        )
      : basePolygon
  );

  if (!basePolygon || basePolygon.length === 0) return null;

  return (
    <React.Fragment>
      <Group
        draggable={isSelected && toolMode === 'select'}
        onDragMove={(e) => {
          const dx = e.target.x() / layout.drawW;
          const dy = e.target.y() / layout.drawH;
          setActiveDragPolygon({ zoneId: zone.id, dx, dy });
        }}
        onDragEnd={(e) => {
          const dx = e.target.x() / layout.drawW;
          const dy = e.target.y() / layout.drawH;
          if (dx !== 0 || dy !== 0) {
            setOptimisticCoords(basePolygon.map(p => ({
               pctX: p.pctX + dx,
               pctY: p.pctY + dy
            })));
          }
          setActiveDragPolygon(null);
          handlePolygonDragEnd(e, zone);
        }}
        onMouseEnter={() => setHoveredZone(zone.id)}
        onMouseLeave={() => setHoveredZone(null)}
        onClick={(e) => handlePolygonClick(e, zone)}
        onTap={(e) => handlePolygonClick(e, zone)}
        onDblClick={(e) => {
          if (['draw', 'stamp'].includes(toolMode)) return;
          e.cancelBubble = true;
          onSelectZone?.(zone.id);
          onToolModeChange?.('select');
        }}
        onDblTap={(e) => {
          if (['draw', 'stamp'].includes(toolMode)) return;
          e.cancelBubble = true;
          onSelectZone?.(zone.id);
          onToolModeChange?.('select');
        }}
        onContextMenu={(e) => {
          if (['draw'].includes(toolMode)) return;
          e.cancelBubble = true;
          e.evt.preventDefault();
          onSelectZone?.(zone.id);
          onToolModeChange?.('select');
          const stage = e.target.getStage();
          const pointer = stage.getPointerPosition();
          setTimeout(() => {
              setContextMenu({ x: pointer.x, y: pointer.y, zoneId: zone.id });
          }, 10);
        }}
      >
        <Line
          points={currentPoints}
          fill={currentFill}
          closed={true}
          globalCompositeOperation="multiply"
          listening={false}
        />

        <Line
          points={currentPoints}
          stroke={currentStroke}
          strokeWidth={(highlight ? 4.0 : strokeWidthBase) * (settings?.markupThickness || 1)}
          dash={dashPattern}
          closed={true}
          shadowColor={highlight ? (isSelected ? 'rgba(139, 92, 246, 0.85)' : 'rgba(14, 165, 233, 0.85)') : 'transparent'}
          shadowBlur={highlight ? 18 : 0}
          shadowOpacity={highlight ? 0.9 : 0}
          listening={true}
        />
      </Group>
      
      {isSelected && basePolygon.map((pt, i) => (
         <Circle
           key={`anchor-${i}`}
           x={layout.offsetX + (pt.pctX + (activeDragPolygon?.zoneId === zone.id ? activeDragPolygon.dx : 0)) * layout.drawW}
           y={layout.offsetY + (pt.pctY + (activeDragPolygon?.zoneId === zone.id ? activeDragPolygon.dy : 0)) * layout.drawH}
           radius={(toolMode === 'delete_node' ? 6 : 5) / stageScale}
           fill={toolMode === 'delete_node' ? '#ef4444' : '#fff'}
           stroke={toolMode === 'delete_node' ? '#fff' : '#8b5cf6'}
           strokeWidth={2 / stageScale}
           draggable={['select', 'add_node'].includes(toolMode)}
           dragBoundFunc={(pos) => {
             if (isShiftDown) {
               const origX = layout.offsetX + (pt.pctX + (activeDragPolygon?.zoneId === zone.id ? activeDragPolygon.dx : 0)) * layout.drawW;
               const origY = layout.offsetY + (pt.pctY + (activeDragPolygon?.zoneId === zone.id ? activeDragPolygon.dy : 0)) * layout.drawH;
               if (Math.abs(pos.x - origX) > Math.abs(pos.y - origY)) {
                 return { x: pos.x, y: origY };
               } else {
                 return { x: origX, y: pos.y };
               }
             }
             if (enableSnapping) {
               let pctX = (pos.x - layout.offsetX) / layout.drawW;
               let pctY = (pos.y - layout.offsetY) / layout.drawH;
               const snap = getSnappedCoordinate(pctX, pctY, vectorTree, aspect, layout.drawW, stageScale, snappingStrength || 15);
               if (snap.snapped) {
                 return {
                   x: layout.offsetX + snap.pctX * layout.drawW,
                   y: layout.offsetY + snap.pctY * layout.drawH
                 };
               }
             }
             return pos;
           }}
           onDragMove={(e) => {
             const node = e.target;
             let pctX = (node.x() - layout.offsetX) / layout.drawW;
             let pctY = (node.y() - layout.offsetY) / layout.drawH;
             let isSnapped = false;
             if (enableSnapping && !isShiftDown) {
               const snap = getSnappedCoordinate(pctX, pctY, vectorTree, aspect, layout.drawW, stageScale, snappingStrength || 15);
               isSnapped = snap.snapped;
             }
             setActiveDragNode({ zoneId: zone.id, index: i, pctX, pctY, isSnapped });
           }}
           onDragEnd={(e) => {
             const node = e.target;
             let pctX = (node.x() - layout.offsetX) / layout.drawW;
             let pctY = (node.y() - layout.offsetY) / layout.drawH;
             const newPoints = [...basePolygon];
             newPoints[i] = { pctX, pctY };
             setOptimisticCoords(newPoints);

             setActiveDragNode(null);
             handleAnchorDragEnd(e, zone.id, i);
           }}
           onClick={(e) => handleAnchorClick(e, zone.id, i)}
           onTap={(e) => handleAnchorClick(e, zone.id, i)}
           onMouseEnter={() => setIsHoveringAnchor(true)}
           onMouseLeave={() => setIsHoveringAnchor(false)}
         />
      ))}
      
      {isSelected && activeDragNode?.zoneId === zone.id && activeDragNode?.isSnapped && (
         <Circle
           x={layout.offsetX + activeDragNode.pctX * layout.drawW}
           y={layout.offsetY + activeDragNode.pctY * layout.drawH}
           radius={8 / stageScale}
           stroke="#ec4899"
           strokeWidth={2 / stageScale}
           fill="transparent"
           listening={false}
         />
      )}
    </React.Fragment>
  );
};

export default React.memo(MappedZoneComponent, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isHovered === nextProps.isHovered &&
    prevProps.stageScale === nextProps.stageScale &&
    prevProps.toolMode === nextProps.toolMode &&
    prevProps.activeDragNode?.zoneId === nextProps.activeDragNode?.zoneId &&
    (prevProps.activeDragNode?.zoneId !== prevProps.zone.id ? true :
      prevProps.activeDragNode?.index === nextProps.activeDragNode?.index &&
      prevProps.activeDragNode?.pctX === nextProps.activeDragNode?.pctX &&
      prevProps.activeDragNode?.pctY === nextProps.activeDragNode?.pctY &&
      prevProps.activeDragNode?.isSnapped === nextProps.activeDragNode?.isSnapped) &&
    prevProps.activeDragPolygon?.zoneId === nextProps.activeDragPolygon?.zoneId &&
    (prevProps.activeDragPolygon?.zoneId !== prevProps.zone.id ? true :
      prevProps.activeDragPolygon?.dx === nextProps.activeDragPolygon?.dx &&
      prevProps.activeDragPolygon?.dy === nextProps.activeDragPolygon?.dy) &&
    prevProps.layout.drawW === nextProps.layout.drawW &&
    prevProps.zone.color === nextProps.zone.color &&
    prevProps.zone.opacity === nextProps.zone.opacity &&
    prevProps.zone.strokeColor === nextProps.zone.strokeColor
  );
});
