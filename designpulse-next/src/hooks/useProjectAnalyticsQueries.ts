import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';


export const useTradeVariances = (projectId: string) => {
  return useQuery({
    queryKey: ['tradeVariances', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.rpc('get_project_trade_variances', { p_project_id: projectId });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
};

export const useGCBottleneckMetrics = (projectId: string) => {
  return useQuery({
    queryKey: ['gcBottleneckMetrics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.rpc('get_gc_bottleneck_metrics', { p_project_id: projectId });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
};

export const useOwnerROIMetrics = (projectId: string) => {
  return useQuery({
    queryKey: ['ownerROIMetrics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.rpc('get_owner_roi_metrics', { p_project_id: projectId });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
};

export const useDesignCompletionMetrics = (projectId: string) => {
  return useQuery({
    queryKey: ['designCompletionMetrics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.rpc('get_design_completion_metrics', { p_project_id: projectId });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
};

// Rosetta Stone: Project-level CSI Specs
// Called once in the parent grid, passed via meta.csiSpecs — never called per-row

