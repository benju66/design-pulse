"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  DEEP_ZOOM_THRESHOLD,
  OVERLAY_SETTLE_MS,
  pickLodBitmap,
  type ViewportRect,
} from '@/utils/pdfRenderMath';
import type { PdfWorkerRequest, PdfWorkerResponse } from '@/workers/pdfRenderProtocol';

export type { ViewportRect };

// Base render scale: match physical screen density for retina sharpness.
// Math.max ensures at least 2× on standard screens.
const BASE_RENDER_SCALE = typeof window !== 'undefined'
  ? Math.max(window.devicePixelRatio || 1, 2.0)
  : 2.0;

// After the 2× base LOD lands, wait this long before pre-rendering the 4×
// deep-zoom LOD in the worker, so the first deep zoom is already sharp. The
// on-demand path (first crossing of DEEP_ZOOM_THRESHOLD) remains as fallback.
const HIGH_LOD_IDLE_MS = 2000;

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

/**
 * usePdfRenderer — thin client of pdfRender.worker.
 *
 * Downloads a PDF from the 'project_drawings' Supabase Storage bucket, then hands
 * the bytes to a dedicated Web Worker that does ALL pdf.js rasterization off the
 * main thread (the previous implementation rasterized on the main thread, blocking
 * Konva pan/zoom during the 4× LOD render). The worker streams back an LOD bitmap
 * pyramid (1× preview → 2× base eagerly; 4× lazily on first deep zoom) plus sharp
 * viewport crops when zoomed past DEEP_ZOOM_THRESHOLD.
 *
 * @param sheetId        - The sheet UUID (null/empty = idle)
 * @param pdfStoragePath - Supabase Storage path (e.g., "{projectId}/{sheetId}/sheet.pdf")
 * @param renderScale    - Base render scale (e.g., 2.0 for retina)
 * @param stageScale     - Current Konva stage zoom level
 * @param viewportRect   - Current visible bounding box in [0-1] coordinates
 */
export function usePdfRenderer(
  sheetId: string | null,
  pdfStoragePath: string | null,
  renderScale: number = BASE_RENDER_SCALE,
  stageScale: number,
  viewportRect: ViewportRect | null,
): PdfRenderState {
  // Instant first-paint placeholder: the server-rendered thumbnail (thumb.png),
  // shown only until the worker's 1× preview lands (it is lower-res, so `low`
  // outranks it in pickLodBitmap). Eliminates the blank-canvas gap on sheet open.
  const [placeholderBitmap, setPlaceholderBitmap] = useState<ImageBitmap | null>(null);
  // LOD bitmap pyramid — three pdf.js quality levels.
  const [lodLowBitmap, setLodLowBitmap] = useState<ImageBitmap | null>(null);   // 1× preview
  const [lodBaseBitmap, setLodBaseBitmap] = useState<ImageBitmap | null>(null); // 2× base
  const [lodHighBitmap, setLodHighBitmap] = useState<ImageBitmap | null>(null); // 4× deep

  const imageBitmap = useMemo(
    () => pickLodBitmap(stageScale, {
      placeholder: placeholderBitmap,
      low: lodLowBitmap,
      base: lodBaseBitmap,
      high: lodHighBitmap,
    }),
    [stageScale, lodHighBitmap, lodBaseBitmap, lodLowBitmap, placeholderBitmap],
  );

  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Viewport overlay state for deep zoom
  const [viewportBitmap, setViewportBitmap] = useState<ImageBitmap | null>(null);
  const [viewportPosition, setViewportPosition] = useState<PdfRenderState['viewportPosition']>(null);

  const workerRef = useRef<Worker | null>(null);
  const loadIdRef = useRef(0);
  const viewportRequestIdRef = useRef(0);
  const highRequestedRef = useRef(false);
  const highIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once the first pdf.js LOD (1× preview) arrived for the current load — a
  // late-arriving thumbnail must be discarded, not shown over the sharper preview.
  const firstLodArrivedRef = useRef(false);
  // Byte cache keyed by sheetId so re-mounts / retries skip the re-download.
  const cachedBytesRef = useRef<{ sheetId: string; buffer: ArrayBuffer } | null>(null);
  const mountedRef = useRef(true);

  // Ref-based viewportRect and stageScale so the overlay effect reads the freshest
  // post-settle values without the render callback churning on every pan frame.
  const viewportRectRef = useRef<ViewportRect | null>(null);
  // eslint-disable-next-line react-hooks/refs -- intentional latest-value ref read by the debounced overlay effect
  viewportRectRef.current = viewportRect;

  const stageScaleRef = useRef(stageScale);
  // eslint-disable-next-line react-hooks/refs -- intentional latest-value ref read by the debounced overlay effect
  stageScaleRef.current = stageScale;

  const handleWorkerMessage = useCallback((ev: MessageEvent<PdfWorkerResponse>) => {
    const msg = ev.data;
    // Drop replies from a superseded load (sheet switched mid-render)
    const stale = msg.loadId !== loadIdRef.current || !mountedRef.current;

    switch (msg.type) {
      case 'page-info':
        if (stale) return;
        setPageWidth(msg.pageWidth);
        setPageHeight(msg.pageHeight);
        break;
      case 'lod':
        if (stale) { msg.bitmap.close(); return; }
        if (msg.level === 'low') {
          setLodLowBitmap((prev) => { prev?.close(); return msg.bitmap; });
          setIsLoading(false);
          // The 1× preview supersedes the low-res thumbnail placeholder.
          firstLodArrivedRef.current = true;
          setPlaceholderBitmap((prev) => { prev?.close(); return null; });
        } else if (msg.level === 'base') {
          setLodBaseBitmap((prev) => { prev?.close(); return msg.bitmap; });
          // Idle pre-render of the 4× LOD so the first deep zoom is already sharp.
          const loadIdAtBase = msg.loadId;
          if (highIdleTimerRef.current) clearTimeout(highIdleTimerRef.current);
          highIdleTimerRef.current = setTimeout(() => {
            if (loadIdAtBase !== loadIdRef.current || highRequestedRef.current) return;
            highRequestedRef.current = true;
            const highMsg: PdfWorkerRequest = { type: 'render-high', loadId: loadIdAtBase };
            workerRef.current?.postMessage(highMsg);
          }, HIGH_LOD_IDLE_MS);
        } else {
          setLodHighBitmap((prev) => { prev?.close(); return msg.bitmap; });
        }
        break;
      case 'viewport':
        if (stale || msg.requestId !== viewportRequestIdRef.current) {
          msg.bitmap.close();
          return;
        }
        setViewportBitmap((prev) => { prev?.close(); return msg.bitmap; });
        setViewportPosition(msg.position);
        break;
      case 'error':
        if (stale) return;
        setError(msg.message);
        setIsLoading(false);
        break;
    }
  }, []);

  // Lazily create the worker. Constructing it starts fetching/compiling the
  // worker bundle (incl. pdf.js) in parallel with the Supabase download.
  const ensureWorker = useCallback((): Worker | null => {
    if (typeof window === 'undefined') return null;
    if (!workerRef.current) {
      const worker = new Worker(
        new URL('../workers/pdfRender.worker.ts', import.meta.url),
        { type: 'module', name: 'pdf-render' },
      );
      worker.onmessage = handleWorkerMessage;
      workerRef.current = worker;
    }
    return workerRef.current;
  }, [handleWorkerMessage]);

  // ── Main download + load effect ─────────────────────────────────────────
  useEffect(() => {
    if (!sheetId || !pdfStoragePath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset async render state when idle
      setIsLoading(false);
      setError(null);
      return;
    }

    const loadId = ++loadIdRef.current;
    highRequestedRef.current = false;
    firstLodArrivedRef.current = false;
    viewportRequestIdRef.current++;
    if (highIdleTimerRef.current) {
      clearTimeout(highIdleTimerRef.current);
      highIdleTimerRef.current = null;
    }
    // Reset the prior sheet's async render state on a sheet switch so the LOD
    // selector can never show the wrong drawing while the new one loads.
    setIsLoading(true);
    setError(null);
    setPlaceholderBitmap((prev) => { prev?.close(); return null; });
    setLodLowBitmap((prev) => { prev?.close(); return null; });
    setLodBaseBitmap((prev) => { prev?.close(); return null; });
    setLodHighBitmap((prev) => { prev?.close(); return null; });
    setViewportBitmap((prev) => { prev?.close(); return null; });
    setViewportPosition(null);

    const worker = ensureWorker();
    if (!worker) return;

    const controller = new AbortController();

    // Instant first paint: decode the server-rendered thumbnail (thumb.png, in the
    // same folder as sheet.pdf) while the PDF downloads + parses in the worker.
    // It is shown only until the 1× preview lands (pickLodBitmap ranks it last).
    const thumbPath = pdfStoragePath.replace(/sheet\.pdf$/, 'thumb.png');
    if (thumbPath !== pdfStoragePath) {
      (async () => {
        try {
          const { data: blob } = await getSupabase()
            .storage.from('project_drawings')
            .download(thumbPath);
          if (!blob) return;
          const bitmap = await createImageBitmap(blob);
          if (
            controller.signal.aborted ||
            loadIdRef.current !== loadId ||
            firstLodArrivedRef.current ||
            !mountedRef.current
          ) {
            bitmap.close();
            return;
          }
          setPlaceholderBitmap((prev) => { prev?.close(); return bitmap; });
          setIsLoading(false);
        } catch {
          // Non-fatal — the pdf.js 1× preview covers first paint instead.
        }
      })();
    }

    const run = async () => {
      try {
        let buffer: ArrayBuffer;
        if (cachedBytesRef.current && cachedBytesRef.current.sheetId === sheetId) {
          buffer = cachedBytesRef.current.buffer;
        } else {
          cachedBytesRef.current = null;
          const { data: blob, error: dlError } = await getSupabase()
            .storage.from('project_drawings')
            .download(pdfStoragePath);

          if (controller.signal.aborted || loadIdRef.current !== loadId) return;
          if (dlError || !blob) {
            throw new Error(dlError?.message || 'PDF download failed');
          }
          buffer = await blob.arrayBuffer();
          if (controller.signal.aborted || loadIdRef.current !== loadId) return;
          cachedBytesRef.current = { sheetId, buffer };
        }

        // Transfer a copy — the cached original must stay usable for the next
        // load (postMessage transfer detaches the ArrayBuffer).
        const transferable = buffer.slice(0);
        const loadMsg: PdfWorkerRequest = {
          type: 'load',
          loadId,
          buffer: transferable,
          baseScale: renderScale,
        };
        worker.postMessage(loadMsg, [transferable]);
      } catch (err: unknown) {
        if (controller.signal.aborted || loadIdRef.current !== loadId) return;
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
    };
  }, [sheetId, pdfStoragePath, renderScale, retryNonce, ensureWorker]);

  // ── Lazy 4× LOD: request once per load, the first time the user deep-zooms ──
  useEffect(() => {
    if (isLoading || error || !sheetId) return;
    if (stageScale <= DEEP_ZOOM_THRESHOLD || highRequestedRef.current) return;
    highRequestedRef.current = true;
    const msg: PdfWorkerRequest = { type: 'render-high', loadId: loadIdRef.current };
    workerRef.current?.postMessage(msg);
  }, [stageScale, isLoading, error, sheetId]);

  // ── Deep zoom viewport re-render effect ─────────────────────────────────
  useEffect(() => {
    if (!sheetId || error || isLoading) return;

    if (stageScale <= DEEP_ZOOM_THRESHOLD) {
      // Bump the request id so any in-flight overlay reply is dropped.
      viewportRequestIdRef.current++;
      const cancelMsg: PdfWorkerRequest = { type: 'cancel-viewport' };
      workerRef.current?.postMessage(cancelMsg);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale overlay below the deep-zoom threshold
      setViewportBitmap((prev) => { prev?.close(); return null; });
      setViewportPosition(null);
      return;
    }

    // Debounce so rapid pan/zoom-end events coalesce into a single render.
    const timer = setTimeout(() => {
      const rect = viewportRectRef.current;
      if (!rect) return;
      const msg: PdfWorkerRequest = {
        type: 'render-viewport',
        loadId: loadIdRef.current,
        requestId: ++viewportRequestIdRef.current,
        rect,
        stageScale: stageScaleRef.current,
        dpr: window.devicePixelRatio || 1,
      };
      workerRef.current?.postMessage(msg);
    }, OVERLAY_SETTLE_MS);

    return () => clearTimeout(timer);
  }, [stageScale, viewportRect, sheetId, error, isLoading]);

  // ── Unmount cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (highIdleTimerRef.current) clearTimeout(highIdleTimerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
      cachedBytesRef.current = null;
      setPlaceholderBitmap((prev) => { prev?.close(); return null; });
      setLodLowBitmap((prev) => { prev?.close(); return null; });
      setLodBaseBitmap((prev) => { prev?.close(); return null; });
      setLodHighBitmap((prev) => { prev?.close(); return null; });
      setViewportBitmap((prev) => { prev?.close(); return null; });
    };
  }, []);

  const retry = useCallback(() => {
    cachedBytesRef.current = null;
    setError(null);
    setRetryNonce((n) => n + 1);
  }, []);

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
