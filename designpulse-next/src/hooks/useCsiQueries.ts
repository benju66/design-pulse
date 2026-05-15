import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

import { toast } from 'sonner';
import { ProjectCsiSpec, CsiSpecItem } from '@/types/models';

export function useProjectCsiSpecs(projectId: string | null) {
  return useQuery<ProjectCsiSpec[], Error>({
    queryKey: ['project_csi_specs', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_csi_specs')
        .select('*')
        .eq('project_id', projectId)
        .order('csi_number', { ascending: true });
      if (error) {
        console.warn('project_csi_specs error:', error);
        return [];
      }
      return data as ProjectCsiSpec[];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 min — CSI specs are populated infrequently
  });
}

export function useUploadCsiTOC() {
  return useMutation({
    mutationFn: async (file: File) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication expired. Please log in again.');

      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/extract-csi-toc`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData
      });
      if (!res.ok) throw new Error('Extraction failed');
      
      const extracted = await res.json() as CsiSpecItem[];
      return extracted.map(item => ({ ...item, id: crypto.randomUUID() }));
    }
  });
}

export function useBulkUpsertProjectCsiSpecs(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ProjectCsiSpec>[]) => {
      if (!payload.length) return;

      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        chunks.push(payload.slice(i, i + CHUNK_SIZE));
      }
      
      await Promise.all(
        chunks.map(chunk => 
          supabase.rpc('bulk_upsert_project_csi_specs', {
            p_project_id: projectId,
            p_payload: chunk
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_csi_specs', projectId] });
      toast.success('CSI specs saved successfully.');
    },
    onError: (err: Error) => {
      console.error('Bulk Upsert Error:', err);
      toast.error(`Failed to save specs: ${err.message}`);
    }
  });
}

