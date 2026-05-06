import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { extractVectorsService } from '@/services/api';

export function useSnappingVectors(sheetId) {
  return useQuery({
    queryKey: ['snapping_vectors_v2', sheetId],
    queryFn: async () => {
      if (!sheetId) return null;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      try {
        const json = await extractVectorsService(sheetId, session.access_token);
        
        const formattedData = json.vectors.map(line => {
          return {
            minX: Math.min(line.start.pctX, line.end.pctX),
            minY: Math.min(line.start.pctY, line.end.pctY),
            maxX: Math.max(line.start.pctX, line.end.pctX),
            maxY: Math.max(line.start.pctY, line.end.pctY),
            lineData: line
          };
        });
        
        return formattedData;
      } catch (err) {
        console.warn('Vector snapping unavailable for this sheet:', err.message);
        throw err;
      }
    },
    enabled: !!sheetId,
    staleTime: Infinity,
    retry: 1
  });
}
