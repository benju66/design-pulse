import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/supabaseClient';
import RBush from 'rbush';
import { Point, VectorLine } from '@/types/map.types';

// Re-export for backward compatibility — canonical definition is in map.types.ts
export type { VectorLine } from '@/types/map.types';

export function useSnappingVectors(sheetId: string | null) {
  const { data: vectors, isLoading, error } = useQuery({
    queryKey: ['snapping_vectors_v2', sheetId],
    queryFn: async () => {
      if (!sheetId) return null;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/extract-vectors/${sheetId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (!response.ok) {
           throw new Error(`Failed to fetch vectors: ${response.statusText}`);
        }
        
        const json = await response.json();
        
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
      } catch (err: unknown) {
        console.warn('Vector snapping unavailable for this sheet:', err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    enabled: !!sheetId,
    staleTime: Infinity,
    retry: 1
  });

  const rBushTree = useMemo(() => {
    if (!vectors || vectors.length === 0) return null;
    const tree = new RBush<VectorLine>();
    tree.load(vectors);
    return tree;
  }, [vectors]);

  return { rBushTree, isLoading, error };
}
