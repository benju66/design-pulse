import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import { Point, VectorLine } from '@/types/map.types';
import type { WorkerMessage, WorkerResponse } from '@/workers/snapping.worker';

// Re-export for backward compatibility
export type { VectorLine } from '@/types/map.types';

export function useSnappingVectors(projectId: string | null, sheetId: string | null) {
  const workerRef = useRef<Worker | null>(null);
  const resolversRef = useRef<Map<string, (point: Point | null) => void>>(new Map());

  const { data: vectors, isLoading, error } = useQuery({
    queryKey: ['snapping_vectors', projectId, sheetId],
    queryFn: async () => {
      if (!sheetId || !projectId) return null;

      const { data, error } = await supabase.storage
        .from('project_drawings')
        .download(`${projectId}/${sheetId}/vectors.json`);

      if (error) {
        if (error.message.includes('Object not found')) {
           return []; // No vectors exist for this sheet
        }
        throw error;
      }

      const text = await data.text();
      const json = JSON.parse(text);

      const formattedData: VectorLine[] = json.vectors.map((line: { start: Point; end: Point }) => {
        return {
          minX: Math.min(line.start.pctX, line.end.pctX),
          minY: Math.min(line.start.pctY, line.end.pctY),
          maxX: Math.max(line.start.pctX, line.end.pctX),
          maxY: Math.max(line.start.pctY, line.end.pctY),
          lineData: line
        };
      });

      return formattedData;
    },
    enabled: !!sheetId && !!projectId,
    staleTime: Infinity,
    retry: 1
  });

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/snapping.worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'SNAP_RESULT') {
        const resolve = resolversRef.current.get(msg.payload.id);
        if (resolve) {
          resolve(msg.payload.snappedPoint);
          resolversRef.current.delete(msg.payload.id);
        }
      }
    };

    return () => {
      // S-2: Resolve all pending promises before termination to prevent
      // dangling unresolved promises that leak memory
      resolversRef.current.forEach((resolve) => resolve(null));
      resolversRef.current.clear();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (workerRef.current && vectors) {
      const msg: WorkerMessage = { type: 'LOAD_VECTORS', payload: vectors };
      workerRef.current.postMessage(msg);
    }
  }, [vectors]);

  const calculateSnap = useCallback((point: Point, threshold: number): Promise<Point | null> => {
    return new Promise((resolve) => {
      if (!workerRef.current || !vectors || vectors.length === 0) {
        resolve(null);
        return;
      }
      
      const id = crypto.randomUUID();
      resolversRef.current.set(id, resolve);
      
      const msg: WorkerMessage = {
        type: 'FIND_SNAP',
        payload: { point, threshold, id }
      };
      workerRef.current.postMessage(msg);
    });
  }, [vectors]);

  return { calculateSnap, isLoading, error, hasVectors: !!vectors && vectors.length > 0 };
}
