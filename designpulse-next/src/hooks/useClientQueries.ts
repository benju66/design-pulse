import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { Client, ClientProjectsMetrics } from '@/types/models';

// Context type for rollback on error
interface CreateClientContext {
  previous: Client[] | undefined;
}

export function useClients() {
  return useQuery<Client[], Error>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_deleted', false)
        .order('name', { ascending: true })
        .order('id', { ascending: true }); // MVCC tie-breaker (C22)
        
      if (error) {
        console.warn("Supabase Clients Error:", error);
        throw error; // Q1: Surface to TanStack error state, don't silently mask
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
        .rpc('get_client_projects_metrics', { p_client_id: clientId || null }); // C11
        
      if (error) {
        console.warn("Supabase Client Metrics Error:", error);
        throw error; // Q1: Surface to TanStack error state
      }
      return data as ClientProjectsMetrics[];
    },
    enabled: !!clientId
  });
}

// Variables type requires `id` to be pre-minted by the caller (C8)
type CreateClientVars = Pick<Client, 'id' | 'name'> & Partial<Omit<Client, 'id' | 'name'>>;

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, CreateClientVars, CreateClientContext>({
    mutationFn: async (newClient) => {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          id: newClient.id,
          name: newClient.name,
          description: newClient.description ?? null,
          primary_contact_name: newClient.primary_contact_name ?? null,
          primary_contact_email: newClient.primary_contact_email ?? null,
        }])
        .select()
        .single();
        
      if (error) throw error;
      return data as Client;
    },
    onMutate: async (newClient) => {
      await queryClient.cancelQueries({ queryKey: ['clients'] });
      const previous = queryClient.getQueryData<Client[]>(['clients']);
      queryClient.setQueryData<Client[]>(['clients'], old => [
        ...(old || []),
        {
          id: newClient.id, // Same UUID as mutationFn receives (C8)
          name: newClient.name,
          description: newClient.description ?? null,
          general_standards_url: null,
          primary_contact_name: newClient.primary_contact_name ?? null,
          primary_contact_email: newClient.primary_contact_email ?? null,
          is_archived: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]);
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client_metrics'] }); // N-2
      toast.success('Client created successfully.');
    },
    onError: (err, _vars, context) => {
      console.error('Create Client Error:', err);
      toast.error(`Failed to create client: ${err.message}`);
      if (context?.previous) {
        queryClient.setQueryData(['clients'], context.previous);
      }
    }
  });
}
