"use client";

import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer } from 'react-konva';
import { Check } from 'lucide-react';

import { ViewportControls } from './canvas/ViewportControls';
import { ContextActionDock } from './canvas/ContextActionDock';
import { CanvasContextMenu, ContextMenuState } from './canvas/CanvasContextMenu';
import { MappedZoneComponent } from './canvas/MappedZone';
import { DraftPolygon } from './canvas/DraftPolygon';
import { StampPreview } from './canvas/StampPreview';
import { PendingPolygon } from './canvas/PendingPolygon';
import { MapLegend, ActiveStatus, MilestoneDef } from './canvas/MapLegend';
import { TileRenderer } from './canvas/TileRenderer';
import { PdfBaseLayer } from './canvas/PdfBaseLayer';
import { CrosshairOverlay } from './canvas/CrosshairOverlay';
import { createPointerStore, type PointerStore } from '@/utils/pointerStore';
import { classifyWheelIntent, clampStagePosition, createViewportSync, dampToward } from '@/utils/viewport';
import { Button } from '@/components/ui/Button';

// Feature flag: opt-out via NEXT_PUBLIC_USE_PDF_RENDERER=false
const usePdf = process.env.NEXT_PUBLIC_USE_PDF_RENDERER !== 'false';

// Zoom bounds + smooth-wheel time constant (shared by wheel, button zoom, glide).
const MIN_SCALE = 0.1;
const MAX_SCALE = 15;
const WHEEL_SMOOTH_TAU = 0.07; // seconds — see dampToward()

import { distToSegment, getCentroid } from '@/utils/geometry';
import { useMapStore } from '@/stores/useMapStore';
import { useSnappingVectors } from '@/hooks/useSnappingVectors';

import { Point, Zone, SnapCallback } from '@/types/map.types';
import { DragNode, DragPolygon } from './canvas/MappedZone';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

export interface FloorplanCanvasProps {
  projectId: string;
  sheetId: string;
  /** @deprecated Silently ignored when PDF renderer is active. Kept for TileRenderer fallback. */
  maxZoom?: number;
  originalWidth?: number;
  originalHeight?: number;
  /** Supabase Storage path to raw PDF (e.g., "{projectId}/{sheetId}/sheet.pdf") */
  pdfStoragePath?: string | null;
  zones?: Zone[];
  onUpdateZonePolygon?: (zoneId: string, points: Point[]) => void;
  onDuplicateZone?: (zoneId: string) => void;
  onPolygonComplete?: (points: Point[]) => void;
  onRenameZone?: (zoneId: string) => void;
  onDeleteZone?: (zoneId: string | string[]) => void;
  onInstantStamp?: (zoneId: string, points: Point[]) => void;
  pendingPolygonPoints?: Point[] | null;
  onPendingPolygonMove?: (points: Point[]) => void;
  // Planned for future use
  onAddNodeToSegment?: (zoneId: string, points: Point[]) => void;
  onPendingPolygonComplete?: () => void;
  legendItems?: MilestoneDef[];
  activeStatuses?: ActiveStatus[];
}

export interface FloorplanCanvasHandle {
  exportFullImage: () => { dataUrl: string; width: number; height: number } | null;
}

export const FloorplanCanvas = forwardRef<FloorplanCanvasHandle, FloorplanCanvasProps>(({
  projectId,
  sheetId,
  maxZoom = 0,
  originalWidth = 1000,
  originalHeight = 1000,
  pdfStoragePath,
  zones = [],
  onUpdateZonePolygon,
  onDuplicateZone,
  onPolygonComplete,
  onRenameZone,
  onDeleteZone,
  onInstantStamp,
  pendingPolygonPoints,
  onPendingPolygonMove,
  legendItems = [],
  activeStatuses = []
}, ref) => {
  const toolMode = useMapStore(s => s.toolMode);
  const onToolModeChange = useMapStore(s => s.setToolMode);
  const selectedZoneIds = useMapStore(s => s.selectedZoneIds);
  const onSelectZone = useMapStore(s => s.toggleSelectedZoneId);
  const onClearSelection = useMapStore(s => s.clearSelectedZones);
  const onSetSelectedZoneIds = useMapStore(s => s.setSelectedZoneIds);

  const mapSettings = { enableSnapping: true, snappingStrength: 15, showCrosshair: true };
  const settings = { showHistoryHover: true, markupThickness: 1 };
  
  const [legendPosition, setLegendPosition] = useState({ isVisible: false, pctX: 0.05, pctY: 0.05, scaleX: 1, scaleY: 1, rotation: 0 });

  // ── Snapping worker setup ──────────────────────────────────────────────────
  // useSnappingVectors downloads vectors.json and loads them into the off-thread
  // RBush spatial index. calculateSnap returns a Promise<Point | null>.
  // snapCallbackRef is a stable ref (AGENTS.md C10: never mutate table.options.meta
  // inline on render — same principle applies here for stable async references).
  const { calculateSnap } = useSnappingVectors(projectId, sheetId || null);
  const snapCallbackRef = useRef<SnapCallback | null>(null);
  useEffect(() => {
    // Wrap calculateSnap so we always call the latest version without stale closure.
    snapCallbackRef.current = (point: Point, thresholdPct: number) =>
      calculateSnap(point, thresholdPct);
  }, [calculateSnap]);

  // snapPreviewPoint: resolved snap candidate for the DraftPolygon cursor ghost.
  // Updated async via a 16ms debounce on pointer move to keep the main thread free.
  const [snapPreviewPoint, setSnapPreviewPoint] = useState<Point | null>(null);
  const snapDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Cleanup snap debounce on unmount (AGENTS.md C15 — animation/timer cleanup)
  useEffect(() => {
    return () => {
      if (snapDebounceRef.current) clearTimeout(snapDebounceRef.current);
    };
  }, []);

  const stageRef = useRef<Konva.Stage | null>(null);

  // Smooth-wheel-zoom glide state. Each wheel notch updates a target scale + cursor
  // anchor; a single rAF loop eases the live transform toward it via dampToward().
  // Refs (not state) so the loop never triggers a React render — same direct-Konva-
  // mutation pattern as handleWheel.
  const wheelTargetScaleRef = useRef<number | null>(null);
  const wheelAnchorRef = useRef<{ screenX: number; screenY: number; contentX: number; contentY: number } | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const wheelLastFrameRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // Latest stage dimensions for the rAF glide loop / dragBoundFunc to read without
  // a stale closure (the loop outlives the render that started it).
  const dimensionsRef = useRef(dimensions);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);

  // HiDPI: render the Konva stage at the device pixel ratio. Konva already defaults to
  // this at canvas creation, but it does NOT re-apply when the window moves to a monitor
  // with a different DPR — leaving the canvas soft until reload. Re-apply and force the
  // stage to rebuild its layer canvases at the new ratio whenever the resolution changes.
  useEffect(() => {
    const apply = () => {
      Konva.pixelRatio = window.devicePixelRatio || 1;
      const stage = stageRef.current;
      const { width, height } = dimensionsRef.current;
      if (stage && width > 0 && height > 0) {
        stage.size({ width, height });
        stage.batchDraw();
      }
    };
    apply();
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const draftPointsRef = useRef(draftPoints);
  useEffect(() => { draftPointsRef.current = draftPoints; }, [draftPoints]);

  const zonesRef = useRef(zones);
  useEffect(() => { zonesRef.current = zones; }, [zones]);

  const selectedZoneIdsRef = useRef(selectedZoneIds);
  useEffect(() => { selectedZoneIdsRef.current = selectedZoneIds; }, [selectedZoneIds]);

  const onUpdateZonePolygonRef = useRef(onUpdateZonePolygon);
  useEffect(() => { onUpdateZonePolygonRef.current = onUpdateZonePolygon; }, [onUpdateZonePolygon]);

  const layoutRef = useRef({ offsetX: 0, offsetY: 0, drawW: 0, drawH: 0 });
  
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [isHoveringAnchor, setIsHoveringAnchor] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [activeDragNode, setActiveDragNode] = useState<DragNode | null>(null);
  const [activeDragPolygon, setActiveDragPolygon] = useState<DragPolygon | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isLegendSelected, setIsLegendSelected] = useState(false);

  // Pointer position lives OUTSIDE React state. A per-mousemove setState here
  // re-rendered the entire canvas tree on every frame during pan/draw. Leaf consumers
  // (draft ghost, stamp preview, crosshair) subscribe to this store and re-render at
  // most once per animation frame; in plain select/pan mode nothing is subscribed, so
  // mouse movement causes zero React work. (Rule 24: the store is created once here and
  // passed down — never a hook inside the N-rendered MappedZoneComponent.)
  const pointerStoreRef = useRef<PointerStore | null>(null);
  if (!pointerStoreRef.current) pointerStoreRef.current = createPointerStore();
  const pointerStore = pointerStoreRef.current;
  useEffect(() => () => pointerStore.dispose(), [pointerStore]);

  const [isShiftDown, setIsShiftDown] = useState(false);
  const [boxOrigin, setBoxOrigin] = useState<Point | null>(null);

  const aspect = layoutRef.current.drawW / Math.max(1, layoutRef.current.drawH);
  const lastBoxEndRef = useRef(0);

  // stageScale/stagePosition (React state) drive DERIVED math only — visible-zone
  // culling, LOD bitmap selection, child stroke widths. The Stage's own transform reads
  // from liveViewportRef (below), not these, so a re-render mid-gesture never reconciles
  // the stage back to a stale value (the "snap-back" bug).
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  // Live viewport transform — the single freshest source of truth for the Stage's x/y/scale,
  // updated synchronously at every mutation site (wheel, glide, drag, button zoom). Stage
  // props read from this ref so direct-mutation 60fps gestures are never fought by React.
  const liveViewportRef = useRef({ scale: 1, x: 0, y: 0 });

  // Leading+trailing throttle pacing the React-state commits of the live transform.
  // Leading commit = instant culling/LOD response at gesture start; ~1 commit / 120ms
  // mid-gesture keeps them fresh; flush lands the final value. Every mutation site writes
  // liveViewportRef BEFORE pushing, so a commit-triggered re-render reconciles the Stage to
  // the value it already has. (Replaces the old pure-trailing 100ms zoom debounce.)
  const viewportSync = useMemo(() => createViewportSync(({ scale, x, y }) => {
    setStageScale(scale);
    setStagePosition({ x, y });
  }), []);
  useEffect(() => () => viewportSync.cancel(), [viewportSync]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      
      if (e.key === 'Shift') setIsShiftDown(true);
      
      if (e.key === 'Escape') {
        setIsLegendSelected(false);
        if (!isInputActive) {
          if (toolMode === 'draw' && draftPointsRef.current.length > 0) {
            e.stopImmediatePropagation();
            setDraftPoints([]);
          } else if (toolMode !== 'pan') {
            onToolModeChange('pan');
          }
        }
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedZoneIdsRef.current?.length > 0 && !isInputActive) {
        e.preventDefault();
        const activeIds = selectedZoneIdsRef.current;
        const currentZones = zonesRef.current;
        const currentLayout = layoutRef.current;

        if (currentLayout && currentLayout.drawW && currentLayout.drawH) {
          const nudgePx = 1; 
          const dx = e.key === 'ArrowLeft' ? -nudgePx / currentLayout.drawW : e.key === 'ArrowRight' ? nudgePx / currentLayout.drawW : 0;
          const dy = e.key === 'ArrowUp' ? -nudgePx / currentLayout.drawH : e.key === 'ArrowDown' ? nudgePx / currentLayout.drawH : 0;

          activeIds.forEach(id => {
            const zone = currentZones.find(z => z.id === id);
            if (zone && zone.coordinates) {
              const newPoints = zone.coordinates.map(p => ({
                pctX: p.pctX + dx,
                pctY: p.pctY + dy
              }));
              onUpdateZonePolygonRef.current?.(zone.id, newPoints);
            }
          });
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (toolMode === 'draw' && draftPointsRef.current.length > 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setDraftPoints(prev => prev.slice(0, -1));
        }
      }
      
      if (toolMode === 'draw' && e.key === 'Enter') {
        if (!isInputActive && draftPointsRef.current.length > 2) {
          e.stopImmediatePropagation();
          onPolygonComplete?.(draftPointsRef.current);
          setDraftPoints([]);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    const checkSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    checkSize();
    const timeouts = [100, 500, 1000].map((t) => setTimeout(checkSize, t));

    window.addEventListener('resize', checkSize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('resize', checkSize);
      timeouts.forEach(clearTimeout);
    };
  }, [sheetId, toolMode, onPolygonComplete]);

  useEffect(() => {
    if (toolMode !== 'draw') setDraftPoints([]);
    if (!['select', 'multi_select', 'add_node', 'delete_node', 'stamp'].includes(toolMode)) {
      onClearSelection();
    }
  }, [toolMode]);

  const layout = useMemo(() => {
    const stageW = dimensions.width;
    const stageH = dimensions.height;
    if (!stageW || !stageH) {
      return { offsetX: 0, offsetY: 0, drawW: 0, drawH: 0, stageW: 0, stageH: 0 };
    }
    const nw = originalWidth;
    const nh = originalHeight;
    if (!nw || !nh) {
      return { offsetX: 0, offsetY: 0, drawW: stageW, drawH: stageH, stageW, stageH };
    }
    const scale = Math.min(stageW / nw, stageH / nh);
    const drawW = nw * scale;
    const drawH = nh * scale;
    const offsetX = (stageW - drawW) / 2;
    const offsetY = (stageH - drawH) / 2;
    return { offsetX, offsetY, drawW, drawH, stageW, stageH };
  }, [originalWidth, originalHeight, dimensions.width, dimensions.height]);

  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const visibleBoundingBox = useMemo(() => {
    if (!layout.drawW || !layout.drawH || !dimensions.width || !dimensions.height) return null;
    const minX = ((-stagePosition.x / stageScale) - layout.offsetX) / layout.drawW;
    const minY = ((-stagePosition.y / stageScale) - layout.offsetY) / layout.drawH;
    const maxX = (((dimensions.width - stagePosition.x) / stageScale) - layout.offsetX) / layout.drawW;
    const maxY = (((dimensions.height - stagePosition.y) / stageScale) - layout.offsetY) / layout.drawH;
    return {
      minPctX: minX - 0.05,
      maxPctX: maxX + 0.05,
      minPctY: minY - 0.05,
      maxPctY: maxY + 0.05,
    };
  }, [stagePosition, stageScale, dimensions, layout]);

  const visibleZones = useMemo(() => {
    if (!visibleBoundingBox || !layout.drawW) return zones;
    const { minPctX, maxPctX, minPctY, maxPctY } = visibleBoundingBox;

    return zones.filter(zone => {
      if (!zone.coordinates || zone.coordinates.length === 0) return true;
      
      return zone.coordinates.some(pt => 
        pt.pctX >= minPctX && 
        pt.pctX <= maxPctX && 
        pt.pctY >= minPctY && 
        pt.pctY <= maxPctY
      );
    });
  }, [zones, visibleBoundingBox, layout.drawW]);

  // ── PDF loading/error state (bubbled from PdfBaseLayer) ──────────────────
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfRetry, setPdfRetry] = useState<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    exportFullImage: () => {
      if (!stageRef.current) return null;
      const dataUrl = stageRef.current.toDataURL({
        x: layout.offsetX,
        y: layout.offsetY,
        width: layout.drawW,
        height: layout.drawH,
        pixelRatio: 2, // retina quality
      });
      return {
        dataUrl,
        width: Math.round(layout.drawW * 2),
        height: Math.round(layout.drawH * 2),
      };
    }
  }), [layout]);

  const cancelSmoothWheel = useCallback(() => {
    if (wheelRafRef.current != null) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }
    wheelTargetScaleRef.current = null;
    wheelAnchorRef.current = null;
  }, []);

  // rAF glide step: eases the live scale toward the wheel target, re-clamping the
  // cursor-anchored position each frame, until within 0.1% of target.
  const stepSmoothWheel = useCallback(() => {
    const stage = stageRef.current;
    const anchor = wheelAnchorRef.current;
    const target = wheelTargetScaleRef.current;
    if (!stage || !anchor || target == null) {
      wheelRafRef.current = null;
      return;
    }

    const now = performance.now();
    const dt = (now - wheelLastFrameRef.current) / 1000;
    wheelLastFrameRef.current = now;

    const current = stage.scaleX();
    let next = dampToward(current, target, dt, WHEEL_SMOOTH_TAU);
    const done = Math.abs(next - target) / target < 0.001;
    if (done) next = target;

    const dims = dimensionsRef.current;
    const pos = clampStagePosition(
      { x: anchor.screenX - anchor.contentX * next, y: anchor.screenY - anchor.contentY * next },
      next,
      layoutRef.current,
      dims.width,
      dims.height,
    );

    stage.scale({ x: next, y: next });
    stage.position(pos);
    stage.batchDraw();
    liveViewportRef.current = { scale: next, x: pos.x, y: pos.y };
    viewportSync.push(liveViewportRef.current);

    if (done) {
      wheelRafRef.current = null;
      wheelTargetScaleRef.current = null;
      wheelAnchorRef.current = null;
      viewportSync.flush();
    } else {
      wheelRafRef.current = requestAnimationFrame(stepSmoothWheel);
    }
  }, [viewportSync]);

  // Cancel any running glide on unmount (Rule 15 — rAF/timer cleanup).
  useEffect(() => () => cancelSmoothWheel(), [cancelSmoothWheel]);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const intent = classifyWheelIntent(e.evt);

    // Hybrid scroll model: trackpad two-finger scroll pans; mouse wheel + pinch zoom.
    if (intent === 'pan') {
      cancelSmoothWheel();
      const panPos = clampStagePosition(
        { x: stage.x() - e.evt.deltaX, y: stage.y() - e.evt.deltaY },
        oldScale,
        layoutRef.current,
        dimensions.width,
        dimensions.height,
      );
      stage.position(panPos);
      stage.batchDraw();
      liveViewportRef.current = { scale: oldScale, x: panPos.x, y: panPos.y };
      viewportSync.push(liveViewportRef.current);
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Smooth glide path — MOUSE WHEEL ONLY. Each notch nudges a target scale
    // (compounding off the live target, not the mid-glide scale) and re-anchors at the
    // cursor; stepSmoothWheel eases toward it. Trackpad pinch uses the instant path below.
    if (intent === 'zoom-wheel') {
      const base = wheelTargetScaleRef.current ?? oldScale;
      const delta = Math.min(Math.abs(e.evt.deltaY), 50);
      const stretch = Math.pow(1.05, delta / 25);
      let target = e.evt.deltaY > 0 ? base / stretch : base * stretch;
      target = Math.max(MIN_SCALE, Math.min(target, MAX_SCALE));
      wheelTargetScaleRef.current = target;
      wheelAnchorRef.current = {
        screenX: pointer.x,
        screenY: pointer.y,
        contentX: (pointer.x - stage.x()) / oldScale,
        contentY: (pointer.y - stage.y()) / oldScale,
      };
      if (wheelRafRef.current == null) {
        wheelLastFrameRef.current = performance.now();
        wheelRafRef.current = requestAnimationFrame(stepSmoothWheel);
      }
      return;
    }

    // Instant path (trackpad pinch — ctrl/meta wheel).
    cancelSmoothWheel();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    let newScale = oldScale * Math.exp(-e.evt.deltaY / 100);
    newScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
    const newPos = clampStagePosition(
      { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale },
      newScale,
      layoutRef.current,
      dimensions.width,
      dimensions.height,
    );
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();
    liveViewportRef.current = { scale: newScale, x: newPos.x, y: newPos.y };
    viewportSync.push(liveViewportRef.current);
  };

  const handleZoom = (direction: number) => {
    setContextMenu(null);
    const stage = stageRef.current;
    if (!stage) return;
    cancelSmoothWheel();
    const oldScale = stage.scaleX();
    const scaleBy = 1.2;
    let newScale = direction === 1 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));

    const centerPoint = { x: dimensions.width / 2, y: dimensions.height / 2 };
    const mousePointTo = {
      x: (centerPoint.x - stage.x()) / oldScale,
      y: (centerPoint.y - stage.y()) / oldScale,
    };
    const newPos = clampStagePosition(
      { x: centerPoint.x - mousePointTo.x * newScale, y: centerPoint.y - mousePointTo.y * newScale },
      newScale,
      layoutRef.current,
      dimensions.width,
      dimensions.height,
    );

    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();
    liveViewportRef.current = { scale: newScale, x: newPos.x, y: newPos.y };
    viewportSync.push(liveViewportRef.current);
    viewportSync.flush();
  };

  const mixAlpha = (colorStr: string, alpha: number) => {
    if (!colorStr) return colorStr;
    if (colorStr.startsWith('rgba')) {
      return colorStr.replace(/[\d.]+\)$/g, `${alpha})`);
    } else if (colorStr.startsWith('#')) {
      let c = colorStr.substring(1).split('');
      if(c.length === 3){
          c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      let cv = parseInt('0x'+c.join(''), 16);
      return 'rgba('+[(cv>>16)&255, (cv>>8)&255, cv&255].join(',')+','+alpha+')';
    }
    return colorStr;
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    // Synchronous void wrapper — makes return type void (not Promise<void>) so Konva's
    // event system receives the correct type. All rejections are caught explicitly.
    void (async () => {
      setContextMenu(null);
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const logicalX = (pointer.x - stage.x()) / stageScale;
      const logicalY = (pointer.y - stage.y()) / stageScale;

      const { offsetX, offsetY, drawW, drawH } = layout;
      if (drawW <= 0 || drawH <= 0) return;

      let pctX = (logicalX - offsetX) / drawW;
      let pctY = (logicalY - offsetY) / drawH;

      if (toolMode === 'stamp' && selectedZoneIds?.length === 1) {
        const sourceZone = zones.find(z => z.id === selectedZoneIds[0]);
        if (sourceZone && sourceZone.coordinates && sourceZone.coordinates.length > 0) {
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

          onInstantStamp?.(selectedZoneIds[0], translatedPoints);
        }
      } else if (toolMode === 'draw') {
        if (Date.now() - lastBoxEndRef.current < 200) return;
        // Read from ref — not closure-captured draftPoints — prevents stale read
        // when two rapid clicks both fire before the first await resolves.
        const currentDraftPoints = draftPointsRef.current;
        if (e.evt.shiftKey && currentDraftPoints.length > 0) {
          const lastPoint = currentDraftPoints[currentDraftPoints.length - 1];
          const dx = Math.abs(pctX - lastPoint.pctX);
          const dy = Math.abs(pctY - lastPoint.pctY);
          if (dx > dy) pctY = lastPoint.pctY;
          else pctX = lastPoint.pctX;
        }
        let finalPctX = pctX;
        let finalPctY = pctY;
        if (mapSettings.enableSnapping && snapCallbackRef.current) {
          const thresholdPct = (mapSettings.snappingStrength || 15) / Math.max(1, layoutRef.current.drawW * stageScale);
          const snapped = await snapCallbackRef.current({ pctX, pctY }, thresholdPct);
          if (snapped) { finalPctX = snapped.pctX; finalPctY = snapped.pctY; }
        }
        setDraftPoints([...currentDraftPoints, { pctX: finalPctX, pctY: finalPctY }]);
      } else if (['select', 'multi_select', 'add_node', 'delete_node'].includes(toolMode)) {
        if (e.target === stage || e.target.nodeType === 'Image' || e.target.attrs?.id === 'bg-rect') {
          onClearSelection();
          setIsLegendSelected(false);
        }
      } else {
        if (e.target === stage || e.target.nodeType === 'Image' || e.target.attrs?.id === 'bg-rect') {
          setIsLegendSelected(false);
        }
      }
    })().catch((err: unknown) => {
      console.error('[FloorplanCanvas] handleStageClick error:', err);
    });
  };

  const finishDrawing = () => {
    if (draftPoints.length > 2) {
      onPolygonComplete?.(draftPoints);
      setDraftPoints([]);
    }
  };

  const handlePolygonClick = (e: KonvaEventObject<MouseEvent | TouchEvent>, zone: Zone) => {
    if (!['select', 'multi_select', 'add_node', 'delete_node'].includes(toolMode)) return;
    e.cancelBubble = true;
    
    if (toolMode === 'multi_select') {
       onSelectZone(zone.id);
       return;
    }

    if (toolMode === 'select') {
      if (!selectedZoneIds.includes(zone.id)) {
        onSetSelectedZoneIds([zone.id]);
        return;
      }
    }

    if (['add_node', 'delete_node'].includes(toolMode)) {
      if (!selectedZoneIds.includes(zone.id)) {
        onSetSelectedZoneIds([zone.id]);
      }
    }

    if (toolMode === 'add_node') {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const logicalX = (pointer.x - stage.x()) / stageScale;
      const logicalY = (pointer.y - stage.y()) / stageScale;
      const pctX = (logicalX - layout.offsetX) / layout.drawW;
      const pctY = (logicalY - layout.offsetY) / layout.drawH;
      
      let bestIdx = -1;
      let minDistance = Infinity;
      const pts = zone.coordinates || [];
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i+1) % pts.length];
        const d = distToSegment({pctX, pctY}, p1, p2);
        if (d < minDistance) {
          minDistance = d;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1) {
        const newPoints = [...pts];
        newPoints.splice(bestIdx + 1, 0, {pctX, pctY});
        onUpdateZonePolygon?.(zone.id, newPoints);
      }
    }
  };

  const handleFlip = (direction: 'horizontal' | 'vertical') => {
    if (pendingPolygonPoints && pendingPolygonPoints.length > 0) {
      const newPoints = pendingPolygonPoints.map(p => ({ ...p }));
      if (direction === 'horizontal') {
        const xs = newPoints.map(p => p.pctX);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        newPoints.forEach(p => p.pctX = centerX - (p.pctX - centerX));
      } else {
        const ys = newPoints.map(p => p.pctY);
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        newPoints.forEach(p => p.pctY = centerY - (p.pctY - centerY));
      }
      onPendingPolygonMove?.(newPoints);
      return;
    }

    if (selectedZoneIds?.length !== 1) return;
    const zone = zones.find(z => z.id === selectedZoneIds[0]);
    if (!zone || !zone.coordinates || zone.coordinates.length === 0) return;
    
    const pts = zone.coordinates;
    const newPoints = pts.map(p => ({ ...p }));
    
    if (direction === 'horizontal') {
      const xs = pts.map(p => p.pctX);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      newPoints.forEach(p => p.pctX = centerX - (p.pctX - centerX));
    } else {
      const ys = pts.map(p => p.pctY);
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      newPoints.forEach(p => p.pctY = centerY - (p.pctY - centerY));
    }
    
    onUpdateZonePolygon?.(zone.id, newPoints);
  };

  const handleRotatePolygon = (direction: 'left' | 'right', overrideId?: string) => {
    const targetId = overrideId || (selectedZoneIds?.length === 1 ? selectedZoneIds[0] : null);
    if (!targetId) return;
    const zone = zones.find(z => z.id === targetId);
    if (!zone || !zone.coordinates || zone.coordinates.length === 0) return;

    const { drawW, drawH } = layout;
    if (drawW <= 0 || drawH <= 0) return;
    const aspect = drawW / drawH;

    const pts = zone.coordinates;
    const centroid = getCentroid(pts);
    const cx = centroid.pctX || 0;
    const cy = centroid.pctY || 0;

    const newPoints = pts.map(p => {
      const dx = p.pctX - cx;
      const dy = p.pctY - cy;

      const realX = dx * aspect;
      const realY = dy;

      let rotX, rotY;
      if (direction === 'left') { 
        rotX = realY;
        rotY = -realX;
      } else { 
        rotX = -realY;
        rotY = realX;
      }

      return { 
        pctX: cx + (rotX / aspect), 
        pctY: cy + rotY 
      };
    });

    onUpdateZonePolygon?.(zone.id, newPoints);
  };

  const handlePolygonDragEnd = (e: KonvaEventObject<MouseEvent | TouchEvent>, zone: Zone) => {
    if (toolMode !== 'select') return;
    const dx = e.target.x() / layout.drawW;
    const dy = e.target.y() / layout.drawH;
    
    e.target.x(0);
    e.target.y(0);
    
    if (dx === 0 && dy === 0) return;

    const pts = zone.coordinates;
    if (!pts) return;

    const newPoints = pts.map(p => ({
      pctX: p.pctX + dx,
      pctY: p.pctY + dy
    }));
    
    onUpdateZonePolygon?.(zone.id, newPoints);
  };

  const handleAnchorDragEnd = (e: KonvaEventObject<MouseEvent | TouchEvent>, zoneId: string, index: number) => {
    if (!['select', 'add_node'].includes(toolMode)) return;
    const node = e.target;
    
    let pctX = (node.x() - layout.offsetX) / layout.drawW;
    let pctY = (node.y() - layout.offsetY) / layout.drawH;
    
    const zone = zones.find(z => z.id === zoneId);
    if (!zone || !zone.coordinates) return;
    
    const newPoints = [...zone.coordinates];
    newPoints[index] = { pctX, pctY };
    onUpdateZonePolygon?.(zoneId, newPoints);
  };

  const handleAnchorClick = (e: KonvaEventObject<MouseEvent | TouchEvent>, zoneId: string, index: number) => {
    e.cancelBubble = true;
    if (toolMode !== 'delete_node') return;
    const zone = zones.find(z => z.id === zoneId);
    if (!zone || !zone.coordinates || zone.coordinates.length <= 3) return;
    
    const newPoints = [...zone.coordinates];
    newPoints.splice(index, 1);
    onUpdateZonePolygon?.(zoneId, newPoints);
  };

  const toPixels = (pointsArray: Point[]) => {
    const { offsetX, offsetY, drawW, drawH } = layout;
    return pointsArray.flatMap((p) => [
      offsetX + p.pctX * drawW,
      offsetY + p.pctY * drawH,
    ]);
  };

  const resetView = () => {
    cancelSmoothWheel();
    const stage = stageRef.current;
    liveViewportRef.current = { scale: 1, x: 0, y: 0 };
    if (stage) {
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
    }
    viewportSync.push(liveViewportRef.current);
    viewportSync.flush();
  };

  const addSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#10b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='16'/><line x1='8' y1='12' x2='16' y2='12'/></svg>`;
  const removeSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><line x1='8' y1='12' x2='16' y2='12'/></svg>`;

  const addNodeCursor = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(addSvg)}") 12 12, crosshair`;
  const removeNodeCursor = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(removeSvg)}") 12 12, crosshair`;

  let computedCursor = 'grab';
  if (isDraggingCanvas) {
    computedCursor = 'grabbing';
  } else if (activeDragPolygon || activeDragNode) {
    computedCursor = 'grabbing';
  } else if (toolMode === 'draw') {
    computedCursor = 'crosshair';
  } else if (toolMode === 'stamp') {
    computedCursor = 'copy';
  } else if (toolMode === 'add_node') {
    computedCursor = isHoveringAnchor ? 'grab' : addNodeCursor;
  } else if (['select', 'multi_select'].includes(toolMode)) {
    if (isHoveringAnchor) computedCursor = 'pointer';
    else if (hoveredZone) computedCursor = selectedZoneIds?.includes(hoveredZone) ? 'grab' : 'pointer';
    else computedCursor = 'default';
  } else if (toolMode === 'delete_node') {
    computedCursor = isHoveringAnchor ? removeNodeCursor : 'default';
  }



  return (
    <div
      id="designpulse-floorplan-container"
      ref={containerRef}
      className="relative w-full h-full flex-1 border rounded-xl overflow-hidden"
      style={{
        cursor: computedCursor,
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
      }}
    >
      {/* PDF Loading overlay — shown during initial download+render */}
      {pdfLoading && !pdfError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
            <div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Loading drawing…</span>
          </div>
        </div>
      )}

      {/* PDF Error overlay — shown when download/render fails */}
      {pdfError && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg">
            <p className="text-sm text-red-500 font-medium">Failed to load drawing</p>
            <p className="text-xs text-slate-500 max-w-64 text-center">{pdfError}</p>
            {pdfRetry && (
              <Button variant="primary" size="sm" onClick={pdfRetry}>Retry</Button>
            )}
          </div>
        </div>
      )}
      <ViewportControls 
        resetView={resetView} 
        handleZoom={handleZoom} 
      />

      <ContextActionDock
        selectedZoneIds={selectedZoneIds}
        isLegendSelected={isLegendSelected}
        onToolModeChange={onToolModeChange}
        onRenameZone={onRenameZone}
        onDuplicateZone={onDuplicateZone}
        handleFlip={handleFlip}
        handleRotatePolygon={handleRotatePolygon}
        onDeleteZone={onDeleteZone}
        onHideLegend={() => setLegendPosition(p => ({ ...p, isVisible: false }))}
        onRotateLegend={(dir) => {
          const rotDelta = dir === 'left' ? -90 : 90;
          setLegendPosition(p => ({ ...p, rotation: p.rotation + rotDelta }));
        }}
      />

      {toolMode === 'draw' && draftPoints.length > 2 && (
        <button
          type="button"
          onClick={finishDrawing}
          className="absolute top-6 right-6 z-20 bg-emerald-500/95 backdrop-blur-sm text-white px-6 py-2 rounded-full shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2 font-bold border border-white/20"
        >
          <Check size={18} /> Finish Shape
        </button>
      )}

      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleStageClick}
          onWheel={handleWheel}
          draggable={true}
          onPointerDown={(e) => {
            if (toolMode === 'pan' || (e.evt && e.evt.button === 1)) {
              setIsDraggingCanvas(true);
            } else if (toolMode === 'draw' && (!e.evt || e.evt.button === 0) && draftPoints.length === 0) {
              const stage = e.target.getStage();
              const pointer = stage?.getPointerPosition();
              if (!stage || !pointer) return;
              const logicalX = (pointer.x - stage.x()) / stageScale;
              const logicalY = (pointer.y - stage.y()) / stageScale;
              const pctX = (logicalX - layout.offsetX) / layout.drawW;
              const pctY = (logicalY - layout.offsetY) / layout.drawH;
              setBoxOrigin({ pctX, pctY });
            }
          }}
          onPointerUp={(e) => {
            setIsDraggingCanvas(false);
            if (toolMode === 'draw' && boxOrigin) {
              const stage = e.target.getStage();
              const lastSample = pointerStore.get();
              const pointer = stage?.getPointerPosition()
                || (lastSample ? { x: lastSample.screenX, y: lastSample.screenY } : null);
              if (!stage || !pointer) {
                setBoxOrigin(null);
                return;
              }
              const logicalX = (pointer.x - stage.x()) / stageScale;
              const logicalY = (pointer.y - stage.y()) / stageScale;
              const pctX = (logicalX - layout.offsetX) / layout.drawW;
              const pctY = (logicalY - layout.offsetY) / layout.drawH;
              const dx = Math.abs(pctX - boxOrigin.pctX);
              const dy = Math.abs(pctY - boxOrigin.pctY);
              
              const startX = boxOrigin.pctX;
              const startY = boxOrigin.pctY;
              setBoxOrigin(null);
              
              if ((dx > 0.005 && dy > 0.005) && draftPoints.length === 0) {
                lastBoxEndRef.current = Date.now();
                onPolygonComplete?.([
                  { pctX: startX, pctY: startY },
                  { pctX: pctX, pctY: startY },
                  { pctX: pctX, pctY: pctY },
                  { pctX: startX, pctY: pctY }
                ]);
                setDraftPoints([]);
              }
            }
          }}
          onMouseMove={(e) => {
            const stage = e.target.getStage();
            if (!stage) return;
            const pos = stage.getPointerPosition();
            if (!pos) return;

            // Convert against the LIVE Konva transform (not the throttled React state)
            // so previews track the cursor exactly even mid-gesture.
            const liveScale = stage.scaleX();
            const logX = (pos.x - stage.x()) / liveScale;
            const logY = (pos.y - stage.y()) / liveScale;
            const layout = layoutRef.current;
            const pctX = layout.drawW > 0 ? (logX - layout.offsetX) / layout.drawW : 0;
            const pctY = layout.drawH > 0 ? (logY - layout.offsetY) / layout.drawH : 0;

            // Single synchronous store write; listeners are notified once per frame.
            // No React state is touched on the plain pan/zoom path — this is what
            // eliminates the per-mousemove whole-canvas re-render.
            pointerStore.set({ screenX: pos.x, screenY: pos.y, pctX, pctY, snap: null });

            // Debounced async snap preview for the DraftPolygon cursor ghost (worker-based,
            // draw mode only). AGENTS.md C15 — timer cleared on unmount.
            if (toolMode === 'draw' && mapSettings.enableSnapping && snapCallbackRef.current && layout.drawW > 0 && layout.drawH > 0) {
              if (snapDebounceRef.current) clearTimeout(snapDebounceRef.current);
              snapDebounceRef.current = setTimeout(async () => {
                const thresholdPct = (mapSettings.snappingStrength || 15) / Math.max(1, layout.drawW * liveScale);
                const snapped = await snapCallbackRef.current!({ pctX, pctY }, thresholdPct);
                setSnapPreviewPoint(snapped);
              }, 16);
            } else if (toolMode !== 'draw') {
              setSnapPreviewPoint(null);
            }
          }}
          x={liveViewportRef.current.x}
          y={liveViewportRef.current.y}
          scaleX={liveViewportRef.current.scale}
          scaleY={liveViewportRef.current.scale}
          dragBoundFunc={(pos) => clampStagePosition(
            pos,
            stageRef.current?.scaleX() ?? 1,
            layoutRef.current,
            dimensionsRef.current.width,
            dimensionsRef.current.height,
          )}
          onDragStart={(e) => {
            if (e.target === stageRef.current) {
              const evt = e.evt;
              if (toolMode !== 'pan' && (!evt || evt.button !== 1)) {
                 e.target.stopDrag();
              }
            }
          }}
          onDragMove={(e) => {
            if (e.target !== stageRef.current) return;
            // Keep the live ref fresh DURING the drag — throttled commits re-render
            // mid-drag, and the Stage props must reconcile to the value the stage already
            // has (snap-back invariant). Also keeps culling/LOD tracking long pans.
            const s = e.target;
            liveViewportRef.current = { scale: s.scaleX(), x: s.x(), y: s.y() };
            viewportSync.push(liveViewportRef.current);
          }}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
               setIsDraggingCanvas(false);
               liveViewportRef.current = { scale: e.target.scaleX(), x: e.target.x(), y: e.target.y() };
               viewportSync.push(liveViewportRef.current);
               viewportSync.flush();
            }
          }}
        >
          {/* Base layer: the PDF bitmap lives alone here, excluded from the hit graph
              (listening=false) and never redrawn by overlay/hover/selection churn on the
              layers above.
              Smoothing is toggled by zoom: ON when zoomed out (stageScale < 1) so the
              downscaled bitmap is anti-aliased instead of shimmering/aliasing on thin
              lines; OFF when zoomed in so construction lines stay pixel-crisp (no blur). */}
          <Layer listening={false} imageSmoothingEnabled={stageScale < 1}>
            {layout.drawW > 0 && layout.drawH > 0 && (
              usePdf && pdfStoragePath ? (
                <PdfBaseLayer
                  projectId={projectId}
                  sheetId={sheetId}
                  pdfStoragePath={pdfStoragePath}
                  offsetX={layout.offsetX}
                  offsetY={layout.offsetY}
                  drawW={layout.drawW}
                  drawH={layout.drawH}
                  stageScale={stageScale}
                  onLoadingChange={setPdfLoading}
                  onError={(err, retry) => { setPdfError(err); setPdfRetry(() => retry); }}
                  viewportRect={visibleBoundingBox}
                />
              ) : (
                <TileRenderer
                  projectId={projectId}
                  sheetId={sheetId}
                  maxZoom={maxZoom}
                  originalWidth={originalWidth}
                  originalHeight={originalHeight}
                  stageScale={stageScale}
                  stagePosition={stagePosition}
                  viewportWidth={dimensions.width}
                  viewportHeight={dimensions.height}
                  offsetX={layout.offsetX}
                  offsetY={layout.offsetY}
                />
              )
            )}
          </Layer>

          {/* Zones layer: interactive polygons, vertex anchors, and editing handles. */}
          <Layer>
            {visibleZones &&
              visibleZones.map((zone) => (
                <MappedZoneComponent
                  key={zone.id}
                  zone={zone}
                  isSelected={selectedZoneIds?.includes(zone.id)}
                  isHovered={hoveredZone === zone.id}
                  toolMode={toolMode}
                  layout={layout}
                  stageScale={stageScale}
                  snapCallback={snapCallbackRef.current}
                  enableSnapping={mapSettings?.enableSnapping}
                  snappingStrength={mapSettings?.snappingStrength || 15}
                  settings={settings}
                  activeDragNode={activeDragNode}
                  activeDragPolygon={activeDragPolygon}
                  isShiftDown={isShiftDown}
                  mixAlpha={mixAlpha}
                  toPixels={toPixels}
                  setHoveredZone={setHoveredZone}
                  setActiveDragPolygon={setActiveDragPolygon}
                  handlePolygonDragEnd={handlePolygonDragEnd}
                  handlePolygonClick={handlePolygonClick}
                  onSelectZone={onSelectZone}
                  onToolModeChange={onToolModeChange}
                  setContextMenu={setContextMenu}
                  setIsHoveringAnchor={setIsHoveringAnchor}
                  setActiveDragNode={setActiveDragNode}
                  handleAnchorDragEnd={handleAnchorDragEnd}
                  handleAnchorClick={handleAnchorClick}
                />
              ))}
          </Layer>

          {/* Overlay layer: ephemeral, high-churn previews + editing chrome (draft/stamp/
              pending shapes, legend). Per-frame redraws here never touch the zones or
              base PDF layers. */}
          <Layer>
            {/* Pointer-following previews are mounted only in their tool mode, so the
                pointer store has zero subscribers during plain select/pan/zoom. */}
            {toolMode === 'draw' && (
              <DraftPolygon
                toolMode={toolMode}
                draftPoints={draftPoints}
                pointerStore={pointerStore}
                boxOrigin={boxOrigin}
                stageScale={stageScale}
                layout={layout}
                snapPreviewPoint={snapPreviewPoint}
                snapCallback={snapCallbackRef.current}
                aspect={aspect}
                enableSnapping={mapSettings?.enableSnapping}
                snappingStrength={mapSettings?.snappingStrength || 15}
                isShiftDown={isShiftDown}
                toPixels={toPixels}
              />
            )}

            {toolMode === 'stamp' && (
              <StampPreview
                toolMode={toolMode}
                selectedZoneId={selectedZoneIds?.length === 1 ? selectedZoneIds[0] : null}
                pointerStore={pointerStore}
                stageScale={stageScale}
                zones={zones}
                activeStatuses={activeStatuses}
                toPixels={toPixels}
              />
            )}

            <PendingPolygon
              pendingPolygonPoints={pendingPolygonPoints || null}
              activeDragNode={activeDragNode}
              activeDragPolygon={activeDragPolygon}
              settings={settings}
              stageScale={stageScale}
              layout={layout}
              isShiftDown={isShiftDown}
              toPixels={toPixels}
              setActiveDragPolygon={setActiveDragPolygon}
              onPendingPolygonMove={onPendingPolygonMove}
              setActiveDragNode={setActiveDragNode}
              setIsHoveringAnchor={setIsHoveringAnchor}
            />

            {legendItems.length > 0 && (
              <MapLegend
                isVisible={legendPosition?.isVisible}
                pctX={legendPosition?.pctX}
                pctY={legendPosition?.pctY}
                scaleX={legendPosition?.scaleX}
                scaleY={legendPosition?.scaleY}
                rotation={legendPosition?.rotation}
                layout={layout}
                milestones={legendItems}
                zones={zones}
                activeStatuses={activeStatuses}
                isSelected={isLegendSelected}
                onSelect={() => setIsLegendSelected(true)}
                onUpdate={(payload) => {
                  setLegendPosition(p => ({ ...p, ...payload }));
                }}
              />
            )}
          </Layer>
        </Stage>
      )}

      {mapSettings?.showCrosshair && (
        <CrosshairOverlay pointerStore={pointerStore} />
      )}

      <CanvasContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        dimensions={dimensions}
        onRenameZone={onRenameZone}
        onDuplicateZone={onDuplicateZone}
        handleFlip={handleFlip}
        handleRotatePolygon={handleRotatePolygon}
        onDeleteZone={onDeleteZone}
      />
    </div>
  );
});

FloorplanCanvas.displayName = 'FloorplanCanvas';

export default FloorplanCanvas;
