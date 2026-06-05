"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Constants ────────────────────────────────────────────────────────────────
// Desktop-only target (no iPad). 67M is safe for Safari desktop (lowest desktop
// ceiling). Chrome/Edge support 268M+, Firefox 124M+. This gives maxScale ≈ 3.86×
// for typical 36"×24" architectural sheets — 2× headroom over the previous 16M cap.
const MAX_CANVAS_PIXELS = 67_000_000;

// Zoom threshold: beyond this stageScale, we re-render the visible viewport
// at higher resolution. Lowered from 3.0 to catch blur early.
const DEEP_ZOOM_THRESHOLD = 1.5;

// Base render scale: match physical screen density for retina sharpness.
// Math.max ensures at least 2× on standard screens.
const BASE_RENDER_SCALE = typeof window !== 'undefined'
  ? Math.max(window.devicePixelRatio || 1, 2.0)
  : 2.0;

// Low-quality preview scale for instant visual feedback
const PREVIEW_RENDER_SCALE = 1.0;

// LOD high-res scale: pre-rendered in background for smooth deep zoom.
// renderPage clamps this to MAX_CANVAS_PIXELS internally (~3.87× for 36"×24").
const LOD_HIGH_SCALE = 4.0;

// ── Types ────────────────────────────────────────────────────────────────────
/** Visible region in normalized [0–1] PDF page coordinates */
export interface ViewportRect {
  minPctX: number;
  minPctY: number;
  maxPctX: number;
  maxPctY: number;
}

interface PdfRenderState {
  imageBitmap: ImageBitmap | null;
  pageWidth: number;
  pageHeight: number;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  // Viewport overlay for deep zoom
  viewportBitmap: ImageBitmap | null;
  /** Normalized [0–1] position of the viewport overlay on the PDF page */
  viewportPosition: {
    x: number; y: number;
    width: number; height: number;
  } | null;
}

// ── Supabase client (singleton for storage downloads) ────────────────────────
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _supabase;
}

// ── Helper: create canvas with OffscreenCanvas feature detection (DR3) ───────
function createRenderCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

// ── Helper: extract ImageBitmap from canvas (DR3) ────────────────────────────
async function canvasToImageBitmap(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): Promise<ImageBitmap> {
  if ('transferToImageBitmap' in canvas) {
    return (canvas as OffscreenCanvas).transferToImageBitmap();
  }
  return createImageBitmap(canvas as HTMLCanvasElement);
}

/**
 * usePdfRenderer — Core pdf.js rendering hook for FloorplanCanvas.
 *
 * Downloads a PDF from Supabase Storage, renders it via pdf.js into an
 * ImageBitmap suitable for <KonvaImage>. Supports progressive rendering,
 * stale-while-revalidate sheet switching, and zoom-aware re-rendering.
 *
 * @param sheetId     - The sheet UUID (null/empty = idle)
 * @param pdfStoragePath - Supabase Storage path (e.g., "{projectId}/{sheetId}/sheet.pdf")
 * @param renderScale - Base render scale (e.g., 2.0 for retina)
 * @param stageScale  - Current Konva stage zoom level
 */
export function usePdfRenderer(
  sheetId: string | null,
  pdfStoragePath: string | null,
  renderScale: number,
  stageScale: number,
  viewportRect: ViewportRect | null,
): PdfRenderState {
  // LOD bitmap pyramid — three pre-rendered quality levels
  const [lodLowBitmap, setLodLowBitmap] = useState<ImageBitmap | null>(null);   // 1× preview
  const [lodBaseBitmap, setLodBaseBitmap] = useState<ImageBitmap | null>(null); // 2× base
  const [lodHighBitmap, setLodHighBitmap] = useState<ImageBitmap | null>(null); // 4× deep

  // LOD selection — pick the sharpest bitmap that won't stretch more than ~2×.
  // During zoom, Konva scales this bitmap via canvas transform. A bitmap at
  // 4× stretched to 5× zoom = only 1.25× stretch (sharp). Without LOD, a 2×
  // bitmap at 5× zoom = 2.5× stretch (blurry).
  const imageBitmap = useMemo(() => {
    // Deep zoom: use 4× LOD when available
    if (stageScale >= 2.0 && lodHighBitmap) return lodHighBitmap;
    // Low zoom: prefer 1× to avoid 4:1 downscale aliasing on fine lines
    if (stageScale < 1.0 && lodLowBitmap) return lodLowBitmap;
    // Normal zoom: use 2× base
    if (lodBaseBitmap) return lodBaseBitmap;
    // Initial load fallback: use 1× preview
    return lodLowBitmap;
  }, [stageScale, lodHighBitmap, lodBaseBitmap, lodLowBitmap]);

  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Viewport overlay state for deep zoom
  const [viewportBitmap, setViewportBitmap] = useState<ImageBitmap | null>(null);
  const [viewportPosition, setViewportPosition] = useState<PdfRenderState['viewportPosition']>(null);

  // Refs for cleanup and race condition prevention
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRenderRef = useRef<{ cancel: () => void } | null>(null);
  const activeViewportRenderRef = useRef<{ cancel: () => void } | null>(null);
  const pdfDocRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const cachedArrayBufferRef = useRef<{ sheetId: string; buffer: ArrayBuffer } | null>(null);
  const currentSheetIdRef = useRef<string | null>(null);
  const retryCounterRef = useRef(0);
  const mountedRef = useRef(true);

  // Track the active render scale to avoid redundant re-renders
  const activeScaleRef = useRef(0);

  // Cached pdf.js page object — avoids async doc.getPage(1) in the zoom hot path.
  // Set during main download effect, cleared on cleanup/sheet switch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cachedPageRef = useRef<any>(null);

  // Deep Review Fix: ref-based viewportRect to prevent useEffect churn.
  // visibleBoundingBox creates a new object on every pan frame — if used as a
  // useEffect dep, the effect would fire on every pan micro-step. The ref lets
  // the render callback read the latest value without being a dependency.
  const viewportRectRef = useRef<ViewportRect | null>(null);
  // eslint-disable-next-line react-hooks/refs -- intentional latest-value ref read by the async render callback (see note above)
  viewportRectRef.current = viewportRect;

  // Ref-based stageScale: the async render callback reads the latest value
  // instead of the closure-captured stale value during rapid zoom.
  const stageScaleRef = useRef(stageScale);
  // eslint-disable-next-line react-hooks/refs -- intentional latest-value ref read by the async render callback during rapid zoom
  stageScaleRef.current = stageScale;

  // ── Cleanup helper ──────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Cancel in-flight download
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Cancel active render task
    activeRenderRef.current?.cancel();
    activeRenderRef.current = null;

    // Cancel active viewport render
    activeViewportRenderRef.current?.cancel();
    activeViewportRenderRef.current = null;

    // Close PDF document (releases pdf.js memory)
    if (pdfDocRef.current) {
      pdfDocRef.current.destroy().catch(() => {});
      pdfDocRef.current = null;
    }
    cachedPageRef.current = null;
  }, []);

  // ── Core render function ────────────────────────────────────────────────
  const renderPage = useCallback(async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any,
    targetScale: number,
  ): Promise<ImageBitmap | null> => {
    // Clamp scale to MAX_CANVAS_PIXELS
    const pageW = page.view[2] as number;
    const pageH = page.view[3] as number;
    const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (pageW * pageH));
    const safeScale = Math.min(targetScale, maxScale);

    const rotation = (page.rotate as number) || 0;
    const viewport = page.getViewport({ scale: safeScale, rotation });

    // Cancel previous render
    activeRenderRef.current?.cancel();

    const canvas = createRenderCanvas(
      Math.floor(viewport.width),
      Math.floor(viewport.height),
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');

    const renderTask = page.render({ canvasContext: ctx, viewport });
    activeRenderRef.current = renderTask;

    try {
      await renderTask.promise;
      activeScaleRef.current = safeScale;
      return await canvasToImageBitmap(canvas);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException') {
        return null; // Expected on rapid zoom — not an error
      }
      throw err;
    }
  }, []);

  // ── Viewport-clipped render for deep zoom ─────────────────────────────
  // Renders only the visible portion of the PDF at high resolution using
  // pdf.js viewport offsetX/offsetY to shift the page origin. The canvas is
  // sized to the visible region only, so content outside is naturally clipped.
  //
  // IMPORTANT: We use getViewport() to get rotation-aware page dimensions.
  // page.view gives raw un-rotated PDF points, but visibleBoundingBox normalizes
  // by the rendered (rotation-aware) size. Using page.view directly would cause
  // coordinate mismatches for rotated pages and aspect ratio errors.
  const renderViewportRegion = useCallback(async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any,
    rect: ViewportRect,
    currentStageScale: number,
  ): Promise<{
    bitmap: ImageBitmap;
    position: { x: number; y: number; width: number; height: number };
  } | null> => {
    const rotation = (page.rotate as number) || 0;

    // Get the full-page viewport at scale=1 to derive rotation-aware dimensions.
    // viewport.width/height account for rotation (swapped for 90°/270°).
    const refViewport = page.getViewport({ scale: 1, rotation });
    const vpWidth = refViewport.width as number;   // rotation-aware
    const vpHeight = refViewport.height as number;  // rotation-aware

    // Clamp viewport rect to [0, 1]
    const vMinX = Math.max(0, rect.minPctX);
    const vMinY = Math.max(0, rect.minPctY);
    const vMaxX = Math.min(1, rect.maxPctX);
    const vMaxY = Math.min(1, rect.maxPctY);
    const vW = vMaxX - vMinX;
    const vH = vMaxY - vMinY;
    if (vW <= 0 || vH <= 0) return null;

    // Scale = stageScale × devicePixelRatio for physical pixel sharpness
    const dpr = window.devicePixelRatio || 1;
    let effectiveScale = currentStageScale * dpr;

    // Canvas size = only the visible region at effectiveScale
    // Uses rotation-aware dimensions (vpWidth/vpHeight) to match visibleBoundingBox coords
    const rawW = Math.ceil(vpWidth * vW * effectiveScale);
    const rawH = Math.ceil(vpHeight * vH * effectiveScale);
    const totalPixels = rawW * rawH;

    // Clamp to MAX_CANVAS_PIXELS (unlikely for viewports, but safety first)
    if (totalPixels > MAX_CANVAS_PIXELS) {
      effectiveScale *= Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
    }

    const finalW = Math.ceil(vpWidth * vW * effectiveScale);
    const finalH = Math.ceil(vpHeight * vH * effectiveScale);
    if (finalW <= 0 || finalH <= 0) return null;

    // Cancel previous viewport render (separate ref from base render)
    activeViewportRenderRef.current?.cancel();

    const canvas = createRenderCanvas(finalW, finalH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Clip offsets in the rotation-aware pixel space.
    // These shift the full-page render so the visible region aligns with canvas (0,0).
    const clipX = Math.floor(vMinX * vpWidth * effectiveScale);
    const clipY = Math.floor(vMinY * vpHeight * effectiveScale);

    const viewport = page.getViewport({
      scale: effectiveScale,
      rotation,
      offsetX: -clipX,
      offsetY: -clipY,
    });

    const renderTask = page.render({ canvasContext: ctx, viewport });
    activeViewportRenderRef.current = renderTask;

    try {
      await renderTask.promise;
      const bitmap = await canvasToImageBitmap(canvas);
      return {
        bitmap,
        position: { x: vMinX, y: vMinY, width: vW, height: vH },
      };
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err &&
          (err as { name: string }).name === 'RenderingCancelledException') {
        return null;
      }
      throw err;
    }
  }, []);

  // ── Main download + render effect ───────────────────────────────────────
  useEffect(() => {
    // Guard: idle state
    if (!sheetId || !pdfStoragePath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset async download/render state when idle
      setIsLoading(false);
      setError(null);
      return;
    }

    currentSheetIdRef.current = sheetId;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // ── Step 1: Download PDF (or use cache) ───────────────────────
        let arrayBuffer: ArrayBuffer;
        if (
          cachedArrayBufferRef.current &&
          cachedArrayBufferRef.current.sheetId === sheetId
        ) {
          arrayBuffer = cachedArrayBufferRef.current.buffer;
        } else {
          // Release old cache
          cachedArrayBufferRef.current = null;

          const { data: blob, error: dlError } = await getSupabase()
            .storage.from('project_drawings')
            .download(pdfStoragePath);

          if (controller.signal.aborted) return;
          if (dlError || !blob) {
            throw new Error(dlError?.message || 'PDF download failed');
          }

          arrayBuffer = await blob.arrayBuffer();
          if (controller.signal.aborted) return;

          // Cache for zoom re-renders
          cachedArrayBufferRef.current = { sheetId, buffer: arrayBuffer };
        }

        // ── Step 2: Parse PDF via pdf.js ──────────────────────────────
        // Lazy import to avoid SSR crashes (FloorplanCanvas is ssr:false)
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        if (controller.signal.aborted) return;

        // Close previous document
        if (pdfDocRef.current) {
          await pdfDocRef.current.destroy().catch(() => {});
        }

        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (controller.signal.aborted) {
          doc.destroy().catch(() => {});
          return;
        }
        pdfDocRef.current = doc;

        const page = await doc.getPage(1);
        if (controller.signal.aborted) return;
        cachedPageRef.current = page;

        // Store rendered dimensions (Guardrail 4: pixel dimensions, not PDF points)
        const pageW = page.view[2] as number;
        const pageH = page.view[3] as number;
        const rotation = (page.rotate as number) || 0;
        const isRotated = rotation === 90 || rotation === 270;

        // ── Step 3: Progressive render — preview first ────────────────
        const previewBitmap = await renderPage(page, PREVIEW_RENDER_SCALE);
        if (controller.signal.aborted || currentSheetIdRef.current !== sheetId) {
          previewBitmap?.close();
          return;
        }

        if (previewBitmap && mountedRef.current) {
          // Store as LOD low — kept alive for fallback during zoom-out
          setLodLowBitmap((prev) => { prev?.close(); return previewBitmap; });

          // Compute rendered pixel dimensions at base scale for originalWidth/Height compat
          const baseMaxScale = Math.sqrt(MAX_CANVAS_PIXELS / (pageW * pageH));
          const baseSafe = Math.min(BASE_RENDER_SCALE, baseMaxScale);
          const w = isRotated ? Math.floor(pageH * baseSafe) : Math.floor(pageW * baseSafe);
          const h = isRotated ? Math.floor(pageW * baseSafe) : Math.floor(pageH * baseSafe);
          setPageWidth(w);
          setPageHeight(h);
          setIsLoading(false);
        }

        // ── Step 4: Full-quality render in background ─────────────────
        const fullBitmap = await renderPage(page, renderScale);
        if (controller.signal.aborted || currentSheetIdRef.current !== sheetId) {
          fullBitmap?.close();
          return;
        }

        if (fullBitmap && mountedRef.current) {
          setLodBaseBitmap((prev) => { prev?.close(); return fullBitmap; });
        }

        // ── Step 5: LOD high — background 4× render for deep zoom ─────
        // Renders the full page at ~4× (clamped to MAX_CANVAS_PIXELS).
        // This is the bitmap Konva stretches during zoom 2×–8×, keeping
        // stretch ≤ 2× at any zoom level. Non-blocking: user sees the
        // 2× base immediately, this upgrades in the background.
        const hqBitmap = await renderPage(page, LOD_HIGH_SCALE);
        if (controller.signal.aborted || currentSheetIdRef.current !== sheetId) {
          hqBitmap?.close();
          return;
        }

        if (hqBitmap && mountedRef.current) {
          setLodHighBitmap((prev) => { prev?.close(); return hqBitmap; });
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error loading PDF';
        if (mountedRef.current) {
          setError(message);
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      controller.abort();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId, pdfStoragePath, renderScale]);

  // ── Deep zoom viewport re-render effect ─────────────────────────────────
  // Renders the visible viewport region at high resolution when zoomed past
  // threshold. Executes immediately (no second debounce) because stageScale
  // is already debounced by FloorplanCanvas (100ms). viewportRect and
  // stageScale are read from refs for latest values.
  useEffect(() => {
    if (!sheetId || !pdfStoragePath || error || isLoading) return;

    // Below threshold — clear any stale viewport overlay
    if (stageScale <= DEEP_ZOOM_THRESHOLD) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale viewport overlay when below the deep-zoom threshold
      setViewportBitmap(prev => { prev?.close(); return null; });
      setViewportPosition(null);
      return;
    }

    // Crossfade: keep the old overlay visible while the new render runs.
    // Konva scales the old overlay correctly (same coordinate space). The
    // center stays sharp, edges show the LOD base layer. The atomic swap
    // in renderOverlay replaces it seamlessly — no gap, no flash.

    // Start render immediately — no second debounce needed.
    // stageScale is already debounced 100ms by FloorplanCanvas.
    // Cancel-on-refire via activeViewportRenderRef handles rapid calls.
    let cancelled = false;

    const renderOverlay = async () => {
      if (currentSheetIdRef.current !== sheetId) return;

      // Read latest viewport and scale from refs (not closure-captured props)
      const currentRect = viewportRectRef.current;
      if (!currentRect) return;

      try {
        const page = cachedPageRef.current;
        if (!page) return;

        const currentScale = stageScaleRef.current;
        const result = await renderViewportRegion(page, currentRect, currentScale);

        // Race guard: effect may have been cleaned up during async render
        if (cancelled || currentSheetIdRef.current !== sheetId) {
          result?.bitmap.close();
          return;
        }

        if (result && mountedRef.current) {
          setViewportBitmap(prev => { prev?.close(); return result.bitmap; });
          setViewportPosition(result.position);
        }
      } catch {
        // Non-fatal — user keeps base layer quality
      }
    };

    renderOverlay();

    return () => {
      cancelled = true;
      activeViewportRenderRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageScale, sheetId, pdfStoragePath, error, isLoading, renderViewportRegion]);

  // ── Unmount cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
      // Release GPU memory for all LOD bitmaps
      setLodLowBitmap((prev) => { prev?.close(); return null; });
      setLodBaseBitmap((prev) => { prev?.close(); return null; });
      setLodHighBitmap((prev) => { prev?.close(); return null; });
      setViewportBitmap((prev) => {
        prev?.close();
        return null;
      });
      cachedArrayBufferRef.current = null;
    };
  }, [cleanup]);

  // ── Retry handler ───────────────────────────────────────────────────────
  const retry = useCallback(() => {
    retryCounterRef.current += 1;
    setError(null);
    setIsLoading(false);
    // Force re-trigger of main effect by toggling error state
    // The main effect depends on sheetId/pdfStoragePath which haven't changed,
    // so we need to force it. We do this by clearing cached data.
    cachedArrayBufferRef.current = null;
    cleanup();
    // Re-trigger by updating a ref that forces effect re-run
    // Since we can't add retryCounter to deps without causing issues,
    // we set error to null and re-set sheetId tracking
    currentSheetIdRef.current = null;
    // The effect will re-run because we set loading to false
    // We need a state change to trigger re-render
    setIsLoading(true);
    // Manually invoke the download
    setTimeout(() => {
      // This will cause the effect to re-detect sheetId mismatch and re-run
      setIsLoading(false);
    }, 0);
  }, [cleanup]);

  return {
    imageBitmap,
    pageWidth,
    pageHeight,
    isLoading,
    error,
    retry,
    viewportBitmap,
    viewportPosition,
  };
}
