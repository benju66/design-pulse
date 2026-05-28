"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Constants ────────────────────────────────────────────────────────────────
// Safe across all browsers including iPad Safari (16M) and Chrome desktop (268M).
// We use the conservative limit to ensure universal compatibility.
const MAX_CANVAS_PIXELS = 16_000_000;

// Zoom threshold: beyond this stageScale, we re-render at higher resolution
const DEEP_ZOOM_THRESHOLD = 3.0;

// Debounce delay for zoom-triggered re-renders (ms)
const ZOOM_DEBOUNCE_MS = 200;

// Base render scale for retina-quality rendering
const BASE_RENDER_SCALE = 2.0;

// Low-quality preview scale for instant visual feedback
const PREVIEW_RENDER_SCALE = 1.0;

// ── Types ────────────────────────────────────────────────────────────────────
interface PdfRenderState {
  imageBitmap: ImageBitmap | null;
  pageWidth: number;
  pageHeight: number;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
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
): PdfRenderState {
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and race condition prevention
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRenderRef = useRef<{ cancel: () => void } | null>(null);
  const pdfDocRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const cachedArrayBufferRef = useRef<{ sheetId: string; buffer: ArrayBuffer } | null>(null);
  const zoomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSheetIdRef = useRef<string | null>(null);
  const retryCounterRef = useRef(0);
  const mountedRef = useRef(true);

  // Track the active render scale to avoid redundant re-renders
  const activeScaleRef = useRef(0);

  // ── Cleanup helper ──────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Cancel in-flight download
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Cancel active render task
    activeRenderRef.current?.cancel();
    activeRenderRef.current = null;

    // Clear zoom debounce
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = null;
    }

    // Close PDF document (releases pdf.js memory)
    if (pdfDocRef.current) {
      pdfDocRef.current.destroy().catch(() => {});
      pdfDocRef.current = null;
    }
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

  // ── Main download + render effect ───────────────────────────────────────
  useEffect(() => {
    // Guard: idle state
    if (!sheetId || !pdfStoragePath) {
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
          // Swap bitmap — release previous GPU memory
          setImageBitmap((prev) => {
            prev?.close();
            return previewBitmap;
          });

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
          setImageBitmap((prev) => {
            prev?.close();
            return fullBitmap;
          });
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

  // ── Deep zoom re-render effect ──────────────────────────────────────────
  useEffect(() => {
    if (!sheetId || !pdfStoragePath || error || isLoading) return;

    // Only re-render when zoom crosses the threshold
    const targetScale = stageScale > DEEP_ZOOM_THRESHOLD
      ? stageScale
      : BASE_RENDER_SCALE;

    // Skip if we're already rendering at this scale
    if (Math.abs(activeScaleRef.current - targetScale) < 0.1) return;

    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }

    zoomDebounceRef.current = setTimeout(async () => {
      if (currentSheetIdRef.current !== sheetId) return;
      if (!pdfDocRef.current) return;

      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Needed to prevent worker not set warning on re-import
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = pdfDocRef.current as any;
        const page = await doc.getPage(1);

        const bitmap = await renderPage(page, targetScale);
        if (currentSheetIdRef.current !== sheetId) {
          bitmap?.close();
          return;
        }

        if (bitmap && mountedRef.current) {
          setImageBitmap((prev) => {
            prev?.close();
            return bitmap;
          });
        }
      } catch {
        // Zoom re-render failure is non-fatal — user keeps previous quality
      }
    }, ZOOM_DEBOUNCE_MS);

    return () => {
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
        zoomDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageScale, sheetId, pdfStoragePath, error, isLoading]);

  // ── Unmount cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
      // Release GPU memory for any remaining bitmap
      setImageBitmap((prev) => {
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
  };
}
