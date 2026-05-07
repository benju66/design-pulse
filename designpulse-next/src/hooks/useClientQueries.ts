import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { Client, ClientBrandStandard, ProjectBrandStandard, ClientProjectsMetrics } from '@/types/models';

export function useClients() {
  return useQuery<Client[], Error>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_deleted', false)
        .order('name', { ascending: true });
        
      if (error) {
        console.warn("Supabase Clients Error:", error);
        return [];
      }
      return data as Client[];
    }
  });
}

export function useClient(clientId: string) {
  return useQuery<Client, Error>({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
        
      if (error) {
        console.warn("Supabase Client Error:", error);
        throw error;
      }
      return data as Client;
    },
    enabled: !!clientId
  });
}

export function useClientMetrics(clientId: string | null) {
  return useQuery<ClientProjectsMetrics[], Error>({
    queryKey: ['client_metrics', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .rpc('get_client_projects_metrics', { p_client_id: clientId });
        
      if (error) {
        console.warn("Supabase Client Metrics Error:", error);
        return [];
      }
      return data as ClientProjectsMetrics[];
    },
    enabled: !!clientId
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, Partial<Client>>({
    mutationFn: async (newClient) => {
      const { data, error } = await supabase
        .from('clients')
        .insert([newClient])
        .select()
        .single();
        
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully.');
    },
    onError: (err) => {
      console.error('Create Client Error:', err);
      toast.error(`Failed to create client: ${err.message}`);
    }
  });
}
