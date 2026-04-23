"use client";
import React, { useState, useEffect, useRef, useMemo, forwardRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import useImage from 'use-image';
import { Check, ZoomIn, ZoomOut, Maximize, MousePointer2, PenTool } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';

const MarkupCanvas = forwardRef(({
  imageUrl = "/placeholder-floorplan.jpg", // placeholder if none
  markups = [],
  onAddMarkup = () => {},
}, ref) => {
  const [image] = useImage(imageUrl, 'anonymous');
  const stageRef = useRef(null);
  const containerRef = useRef(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  
  const [toolMode, setToolMode] = useState('pan'); // pan, draw
  const [draftPoints, setDraftPoints] = useState([]);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (toolMode === 'draw' && draftPoints.length > 0) {
          setDraftPoints([]);
        } else {
          setToolMode('pan');
        }
      }
      if (toolMode === 'draw' && e.key === 'Enter') {
        if (draftPoints.length > 2) {
          onAddMarkup({ points: draftPoints, color: '#ef4444' });
          setDraftPoints([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolMode, draftPoints, onAddMarkup]);

  const layout = useMemo(() => {
    const stageW = dimensions.width;
    const stageH = dimensions.height;
    if (!stageW || !stageH || !image) {
      return { offsetX: 0, offsetY: 0, drawW: stageW || 800, drawH: stageH || 600, stageW, stageH };
    }
    const nw = image.naturalWidth || image.width;
    const nh = image.naturalHeight || image.height;
    const scale = Math.min(stageW / nw, stageH / nh);
    const drawW = nw * scale;
    const drawH = nh * scale;
    const offsetX = (stageW - drawW) / 2;
    const offsetY = (stageH - drawH) / 2;
    return { offsetX, offsetY, drawW, drawH, stageW, stageH };
  }, [image, dimensions]);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY > 0 ? oldScale / 1.1 : oldScale * 1.1;
    newScale = Math.max(0.1, Math.min(newScale, 15));

    setStageScale(newScale);
    setStagePosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleZoom = (direction) => {
    const oldScale = stageScale;
    const scaleBy = 1.2;
    const newScale = direction === 1 ? oldScale * scaleBy : oldScale / scaleBy;
    const centerPoint = { x: dimensions.width / 2, y: dimensions.height / 2 };
    const mousePointTo = {
      x: (centerPoint.x - stagePosition.x) / oldScale,
      y: (centerPoint.y - stagePosition.y) / oldScale,
    };
    setStageScale(newScale);
    setStagePosition({
      x: centerPoint.x - mousePointTo.x * newScale,
      y: centerPoint.y - mousePointTo.y * newScale,
    });
  };

  const resetView = () => {
    setStageScale(1);
    setStagePosition({ x: 0, y: 0 });
  };

  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const logicalX = (pointer.x - stage.x()) / stageScale;
    const logicalY = (pointer.y - stage.y()) / stageScale;

    const { offsetX, offsetY, drawW, drawH } = layout;
    if (drawW <= 0 || drawH <= 0) return;

    let pctX = (logicalX - offsetX) / drawW;
    let pctY = (logicalY - offsetY) / drawH;

    if (toolMode === 'draw') {
      setDraftPoints([...draftPoints, { pctX, pctY }]);
    } else if (toolMode === 'pan') {
      setSelectedOpportunityId(null);
    }
  };

  const finishDrawing = () => {
    if (draftPoints.length > 2) {
      onAddMarkup({ points: draftPoints, color: '#ef4444' });
      setDraftPoints([]);
    }
  };

  const toPixels = (pointsArray) => {
    const { offsetX, offsetY, drawW, drawH } = layout;
    return pointsArray.flatMap((p) => [
      offsetX + p.pctX * drawW,
      offsetY + p.pctY * drawH,
    ]);
  };

  let computedCursor = 'grab';
  if (isDraggingCanvas) computedCursor = 'grabbing';
  else if (toolMode === 'draw') computedCursor = 'crosshair';
  else if (toolMode === 'pan') computedCursor = 'grab';

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-1 flex gap-1">
        <button 
          onClick={() => setToolMode('pan')}
          className={`p-2 rounded-md ${toolMode === 'pan' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
        >
          <MousePointer2 size={20} />
        </button>
        <button 
          onClick={() => setToolMode('draw')}
          className={`p-2 rounded-md ${toolMode === 'draw' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
        >
          <PenTool size={20} />
        </button>
        <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
        <button onClick={() => handleZoom(1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-400 dark:hover:bg-gray-700"><ZoomIn size={20} /></button>
        <button onClick={() => handleZoom(-1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-400 dark:hover:bg-gray-700"><ZoomOut size={20} /></button>
        <button onClick={resetView} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-400 dark:hover:bg-gray-700"><Maximize size={20} /></button>
      </div>

      {toolMode === 'draw' && draftPoints.length > 2 && (
        <button
          onClick={finishDrawing}
          className="absolute top-4 right-4 z-10 bg-emerald-500 text-white px-4 py-2 rounded-md shadow hover:bg-emerald-600 flex items-center gap-2 font-medium"
        >
          <Check size={18} /> Finish Shape
        </button>
      )}

      <div
        ref={containerRef}
        className="flex-1 w-full bg-gray-100 dark:bg-gray-900 overflow-hidden"
        style={{ cursor: computedCursor }}
      >
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            onClick={handleStageClick}
            onWheel={handleWheel}
            draggable={toolMode === 'pan'}
            x={stagePosition.x}
            y={stagePosition.y}
            scaleX={stageScale}
            scaleY={stageScale}
            onDragStart={() => setIsDraggingCanvas(true)}
            onDragEnd={(e) => {
              setIsDraggingCanvas(false);
              setStagePosition({ x: e.target.x(), y: e.target.y() });
            }}
          >
            <Layer listening={false}>
              {image && layout.drawW > 0 && layout.drawH > 0 && (
                <KonvaImage
                  image={image}
                  x={layout.offsetX}
                  y={layout.offsetY}
                  width={layout.drawW}
                  height={layout.drawH}
                />
              )}
            </Layer>
            <Layer>
              {/* Render Saved Markups */}
              {markups.map((markup, idx) => {
                const isSelected = selectedOpportunityId === markup.opportunity_id;
                return (
                  <Line
                    key={idx}
                    points={toPixels(markup.points)}
                    closed
                    fill={`${markup.color}66`}
                    stroke={isSelected ? '#38bdf8' : markup.color}
                    strokeWidth={isSelected ? 4 / stageScale : 2 / stageScale}
                    shadowColor={isSelected ? '#38bdf8' : null}
                    shadowBlur={isSelected ? 10 / stageScale : 0}
                    tension={0}
                    onClick={(e) => {
                      if (toolMode === 'pan') {
                        e.cancelBubble = true;
                        if (markup.opportunity_id) {
                          setSelectedOpportunityId(markup.opportunity_id);
                        }
                      }
                    }}
                    onTap={(e) => {
                      if (toolMode === 'pan') {
                        e.cancelBubble = true;
                        if (markup.opportunity_id) {
                          setSelectedOpportunityId(markup.opportunity_id);
                        }
                      }
                    }}
                  />
                );
              })}

              {/* Render Draft Polygon */}
              {draftPoints.length > 0 && (
                <Line
                  points={toPixels(draftPoints)}
                  closed={false}
                  stroke="#ef4444"
                  strokeWidth={2 / stageScale}
                  dash={[5 / stageScale, 5 / stageScale]}
                />
              )}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
});

MarkupCanvas.displayName = 'MarkupCanvas';
export default MarkupCanvas;
