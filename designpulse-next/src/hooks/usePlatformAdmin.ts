import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ['is_platform_admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (error) throw error;
      return !!data;
    },
    staleTime: Infinity, // Cache for the session
  });
}
