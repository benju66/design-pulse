"use client";

import { useEffect, useRef, memo } from 'react';
import { Image as KonvaImage } from 'react-konva';
import { usePdfRenderer, type ViewportRect } from '@/hooks/usePdfRenderer';
import type Konva from 'konva';

// ── Props ────────────────────────────────────────────────────────────────────
export interface PdfBaseLayerProps {
  projectId: string;
  sheetId: string;
  pdfStoragePath: string | null;
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
  stageScale: number;
  onLoadingChange?: (isLoading: boolean) => void;
  onError?: (error: string | null, retry: () => void) => void;
  onDimensionsReady?: (width: number, height: number) => void;
  /** Visible viewport in normalized [0-1] coords for deep zoom rendering */
  viewportRect: ViewportRect | null;
}

// Base render scale: 2.0 for retina-quality rendering
const BASE_RENDER_SCALE = 2.0;

/**
 * PdfBaseLayer — Drop-in replacement for TileRenderer.
 *
 * Renders a single <KonvaImage> showing the pdf.js-rendered floor plan bitmap.
 * Sits inside the same Konva <Layer> as MappedZone, DraftPolygon, etc.
 *
 * Key differences from TileRenderer:
 * - One image instead of N tile images
 * - Client-side rendering instead of server-side tile pyramid
 * - Zoom-aware quality upgrades instead of pre-generated zoom levels
 * - No `maxZoom` dependency
 */
function PdfBaseLayerInner({
  projectId: _projectId,
  sheetId,
  pdfStoragePath,
  offsetX,
  offsetY,
  drawW,
  drawH,
  stageScale,
  onLoadingChange,
  onError,
  onDimensionsReady,
  viewportRect,
}: PdfBaseLayerProps) {
  const imageRef = useRef<Konva.Image>(null);

  const {
    imageBitmap,
    pageWidth,
    pageHeight,
    isLoading,
    error,
    retry,
    viewportBitmap,
    viewportPosition,
  } = usePdfRenderer(
    sheetId,
    pdfStoragePath,
    BASE_RENDER_SCALE,
    stageScale,
    viewportRect,
  );

  // ── Bubble loading state to parent ──────────────────────────────────────
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current !== isLoading) {
      prevLoadingRef.current = isLoading;
      onLoadingChange?.(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  // ── Bubble error state to parent ────────────────────────────────────────
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevErrorRef.current !== error) {
      prevErrorRef.current = error;
      onError?.(error, retry);
    }
  }, [error, retry, onError]);

  // ── Report rendered dimensions (for originalWidth/Height compat) ────────
  useEffect(() => {
    if (pageWidth > 0 && pageHeight > 0) {
      onDimensionsReady?.(pageWidth, pageHeight);
    }
  }, [pageWidth, pageHeight, onDimensionsReady]);

  // ── Force Konva to re-draw when bitmap changes ──────────────────────────
  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.getLayer()?.batchDraw();
    }
  }, [imageBitmap, viewportBitmap]);

  // Don't render anything if no bitmap available
  if (!imageBitmap) return null;

  return (
    <>
      {/* Base full-page bitmap — always visible for visual continuity */}
      <KonvaImage
        ref={imageRef}
        image={imageBitmap}
        x={offsetX}
        y={offsetY}
        width={drawW}
        height={drawH}
        listening={false}
        perfectDrawEnabled={false}
      />
      {/* High-res viewport overlay — sharp crop of visible region */}
      {viewportBitmap && viewportPosition && (
        <KonvaImage
          image={viewportBitmap}
          x={offsetX + viewportPosition.x * drawW}
          y={offsetY + viewportPosition.y * drawH}
          width={viewportPosition.width * drawW}
          height={viewportPosition.height * drawH}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </>
  );
}

export const PdfBaseLayer = memo(PdfBaseLayerInner);
