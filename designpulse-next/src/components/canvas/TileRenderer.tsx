/* eslint-disable react-hooks/refs */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import { supabase } from '@/supabaseClient';

export interface TileRendererProps {
  projectId: string;
  sheetId: string;
  maxZoom: number;
  originalWidth: number;
  originalHeight: number;
  stageScale: number;
  stagePosition: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  offsetX: number;
  offsetY: number;
}

interface TileData {
  id: string; // "z/x/y"
  z: number;
  x: number;
  y: number;
}

const TILE_SIZE = 256;

/** Maximum number of cached tiles before LRU eviction kicks in. */
const MAX_TILE_CACHE_SIZE = 300;

export const TileRenderer: React.FC<TileRendererProps> = ({
  projectId,
  sheetId,
  maxZoom,
  originalWidth,
  originalHeight,
  stageScale,
  stagePosition,
  viewportWidth,
  viewportHeight,
  offsetX,
  offsetY
}) => {
  // ── Ref-driven tile cache (C-3: eliminates infinite useEffect loop) ──────
  // Tracking state is stored in refs to avoid re-triggering the fetch effect.
  // Only `renderEpoch` triggers re-renders when new tiles finish loading.
  const tileCache = useRef<Record<string, HTMLImageElement>>({});
  const inflight = useRef<Set<string>>(new Set());
  const activeControllers = useRef<Record<string, AbortController>>({});
  const [renderEpoch, setRenderEpoch] = useState(0);

  // Clear tile cache when sheet changes — prevents stale tiles from a previous
  // sheet (or the processing phase with maxZoom=0) from persisting in refs.
  useEffect(() => {
    // Abort all in-flight fetches for the previous sheet
    for (const controller of Object.values(activeControllers.current)) {
      controller.abort();
    }
    tileCache.current = {};
    inflight.current = new Set();
    activeControllers.current = {};
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderEpoch(0);
  }, [sheetId, maxZoom]);

  // Supabase Storage URL for authenticated tile fetches
  const storageBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/project_drawings`;

  // ── Calculate which tiles are visible ────────────────────────────────────
  const visibleTiles = useMemo(() => {
    const zoomFloat = maxZoom + Math.log2(stageScale);
    let z = Math.round(zoomFloat);
    z = Math.max(0, Math.min(maxZoom, z));

    const scaleAtZ = Math.pow(2, z - maxZoom);
    
    const levelWidth = originalWidth * scaleAtZ;
    const levelHeight = originalHeight * scaleAtZ;

    // The image is visually offset by offsetX and offsetY in the unscaled stage space.
    // stagePosition is the top-left of the canvas in stage coordinates.
    const minX = ((-stagePosition.x / stageScale) - offsetX) * scaleAtZ;
    const minY = ((-stagePosition.y / stageScale) - offsetY) * scaleAtZ;
    const maxX = (((viewportWidth - stagePosition.x) / stageScale) - offsetX) * scaleAtZ;
    const maxY = (((viewportHeight - stagePosition.y) / stageScale) - offsetY) * scaleAtZ;

    const startCol = Math.max(0, Math.floor(minX / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(minY / TILE_SIZE));
    const endCol = Math.min(Math.ceil(levelWidth / TILE_SIZE) - 1, Math.floor(maxX / TILE_SIZE));
    const endRow = Math.min(Math.ceil(levelHeight / TILE_SIZE) - 1, Math.floor(maxY / TILE_SIZE));

    const tiles: TileData[] = [];
    for (let x = startCol; x <= endCol; x++) {
      for (let y = startRow; y <= endRow; y++) {
        tiles.push({
          id: `${z}/${x}/${y}`,
          z,
          x,
          y
        });
      }
    }
    return tiles;
  }, [maxZoom, originalWidth, originalHeight, stageScale, stagePosition, viewportWidth, viewportHeight, offsetX, offsetY]);

  // ── Fetch tiles (ref-driven, no infinite loop) ──────────────────────────
  useEffect(() => {
    let isMounted = true;

    const fetchBatch = async () => {
      // C-4: Single auth call per effect cycle, not per tile
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      for (const tile of visibleTiles) {
        if (tileCache.current[tile.id] || inflight.current.has(tile.id)) continue;
        inflight.current.add(tile.id);

        const controller = new AbortController();
        activeControllers.current[tile.id] = controller;

        // C-1 + C-6: Path matches backend dzsave structure and Storage RLS path_tokens[1]
        const url = `${storageBaseUrl}/${projectId}/${sheetId}/tiles/${tile.z}/${tile.x}_${tile.y}.webp`;

        fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} for tile ${tile.id}`);
            return res.blob();
          })
          .then(blob => {
            const objectUrl = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
              // C-2: Revoke objectUrl immediately after the browser has decoded it
              URL.revokeObjectURL(objectUrl);
              tileCache.current[tile.id] = img;
              inflight.current.delete(tile.id);
              delete activeControllers.current[tile.id];
              if (isMounted) setRenderEpoch(e => e + 1);
            };

            img.onerror = () => {
              // C-2: Revoke on error too — prevent orphaned blob URLs
              URL.revokeObjectURL(objectUrl);
              inflight.current.delete(tile.id);
              delete activeControllers.current[tile.id];
            };

            img.src = objectUrl;
          })
          .catch((err: unknown) => {
            // P-6: Typed error handling (Rule C1 — no `any`)
            if (err instanceof DOMException && err.name === 'AbortError') return;
            inflight.current.delete(tile.id);
            delete activeControllers.current[tile.id];
          });
      }
    };

    fetchBatch();

    // Abort off-screen tile fetches to save bandwidth
    const visibleSet = new Set(visibleTiles.map(t => t.id));
    for (const tileId of Object.keys(activeControllers.current)) {
      if (!visibleSet.has(tileId)) {
        activeControllers.current[tileId].abort();
        delete activeControllers.current[tileId];
        inflight.current.delete(tileId);
      }
    }

    // LRU eviction: cap cache at MAX_TILE_CACHE_SIZE entries
    const cachedKeys = Object.keys(tileCache.current);
    if (cachedKeys.length > MAX_TILE_CACHE_SIZE) {
      const evictionCount = cachedKeys.length - MAX_TILE_CACHE_SIZE;
      let evicted = 0;
      for (const key of cachedKeys) {
        if (evicted >= evictionCount) break;
        if (!visibleSet.has(key)) {
          delete tileCache.current[key];
          evicted++;
        }
      }
    }

    return () => {
      isMounted = false;
    };
    // C-3: Dependencies are strictly the inputs that change which tiles to show.
    // loadedTiles and loadingTiles are NOT in this array (they're refs now).
  }, [visibleTiles, sheetId, projectId, storageBaseUrl]);

  // ── Render tiles ────────────────────────────────────────────────────────
  // `renderEpoch` in scope ensures React re-renders when new tiles arrive.
  void renderEpoch; // explicit reference for React dependency tracking

  return (
    <Group>

      {visibleTiles.map(tile => {
        const img = tileCache.current[tile.id];
        if (!img) return null;
        
        const scaleAtZ = Math.pow(2, tile.z - maxZoom);
        const invScale = 1 / scaleAtZ;
        
        return (
          <KonvaImage
            key={tile.id}
            image={img}
            x={offsetX + (tile.x * TILE_SIZE * invScale)}
            y={offsetY + (tile.y * TILE_SIZE * invScale)}
            width={img.width * invScale}
            height={img.height * invScale}
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      })}
    </Group>
  );
};
