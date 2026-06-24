import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { Client, ClientBrandStandard, ClientDocument, ClientProjectsMetrics, ClientLesson } from '@/types/models';

// ── Context types for optimistic rollback ────────────────────────────────────

interface CreateClientContext {
  previous: Client[] | undefined;
}

interface BrandStandardContext {
  previous: ClientBrandStandard[] | undefined;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CLIENT CRUD ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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

// Rollup of a client's lessons learned across all of its projects (via get_client_lessons RPC).
export function useClientLessons(clientId: string | null) {
  return useQuery<ClientLesson[], Error>({
    queryKey: ['client_lessons', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .rpc('get_client_lessons', { p_client_id: clientId }); // C11

      if (error) {
        console.warn("Supabase Client Lessons Error:", error);
        throw error; // Q1: Surface to TanStack error state
      }
      return data as ClientLesson[];
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

export function useUpdateClient(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, Partial<Client>>({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Client>(['client', clientId], data);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated successfully.');
    },
    onError: (err) => {
      console.error('Update Client Error:', err);
      toast.error(`Failed to update client: ${err.message}`);
    }
  });
}

export function useArchiveClient() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, string>({
    mutationFn: async (clientId) => {
      const { data, error } = await supabase
        .from('clients')
        .update({ is_archived: true })
        .eq('id', clientId)
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client archived.');
    },
    onError: (err) => {
      console.error('Archive Client Error:', err);
      toast.error(`Failed to archive client: ${err.message}`);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── BRAND STANDARDS CRUD ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function useBrandStandards(clientId: string | null) {
  return useQuery<ClientBrandStandard[], Error>({
    queryKey: ['brand_standards', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_brand_standards')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }); // MVCC tie-breaker (C22)

      if (error) {
        console.warn("Brand Standards Error:", error);
        throw error;
      }
      return data as ClientBrandStandard[];
    },
    enabled: !!clientId
  });
}

type CreateBrandStandardVars = Pick<ClientBrandStandard, 'id' | 'client_id' | 'standard_description'> &
  Partial<Omit<ClientBrandStandard, 'id' | 'client_id' | 'standard_description'>>;

export function useCreateBrandStandard() {
  const queryClient = useQueryClient();
  return useMutation<ClientBrandStandard, Error, CreateBrandStandardVars, BrandStandardContext>({
    mutationFn: async (vars) => {
      const { data, error } = await supabase
        .from('client_brand_standards')
        .insert([{
          id: vars.id, // C8: client-minted UUID
          client_id: vars.client_id,
          standard_description: vars.standard_description,
          cost_code: vars.cost_code ?? null,
          division: vars.division ?? null,
          normalized_csi_number: vars.normalized_csi_number ?? null,
          category: vars.category ?? null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data as ClientBrandStandard;
    },
    onMutate: async (vars) => {
      const key = ['brand_standards', vars.client_id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ClientBrandStandard[]>(key);
      queryClient.setQueryData<ClientBrandStandard[]>(key, old => [
        ...(old || []),
        {
          id: vars.id,
          client_id: vars.client_id,
          source_project_id: null,
          standard_description: vars.standard_description,
          cost_code: vars.cost_code ?? null,
          division: vars.division ?? null,
          normalized_csi_number: vars.normalized_csi_number ?? null,
          category: vars.category ?? null,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]);
      return { previous };
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['brand_standards', vars.client_id] });
    },
    onError: (err, vars, context) => {
      console.error('Create Brand Standard Error:', err);
      toast.error(`Failed to create standard: ${err.message}`);
      if (context?.previous) {
        queryClient.setQueryData(['brand_standards', vars.client_id], context.previous);
      }
    }
  });
}

export function useUpdateBrandStandard(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation<ClientBrandStandard, Error, { id: string; updates: Record<string, unknown> }, BrandStandardContext>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('client_brand_standards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ClientBrandStandard;
    },
    onMutate: async ({ id, updates }) => {
      const key = ['brand_standards', clientId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ClientBrandStandard[]>(key);
      if (previous) {
        queryClient.setQueryData<ClientBrandStandard[]>(key, old => 
          old?.map(item => item.id === id ? { ...item, ...updates } : item)
        );
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand_standards', clientId] });
    },
    onError: (err, _vars, context) => {
      console.error('Update Brand Standard Error:', err);
      toast.error(`Failed to update standard: ${err.message}`);
      if (context?.previous) {
        queryClient.setQueryData(['brand_standards', clientId], context.previous);
      }
    }
  });
}

export function useDeleteBrandStandard(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, BrandStandardContext>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('client_brand_standards')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const key = ['brand_standards', clientId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ClientBrandStandard[]>(key);
      queryClient.setQueryData<ClientBrandStandard[]>(key, old =>
        (old || []).filter(s => s.id !== id)
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand_standards', clientId] });
      toast.success('Standard removed.');
    },
    onError: (err, _id, context) => {
      console.error('Delete Brand Standard Error:', err);
      toast.error(`Failed to remove standard: ${err.message}`);
      if (context?.previous) {
        queryClient.setQueryData(['brand_standards', clientId], context.previous);
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CLIENT DOCUMENTS CRUD ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function useClientDocuments(clientId: string | null, standardId?: string | null) {
  return useQuery<ClientDocument[], Error>({
    queryKey: ['client_documents', clientId, standardId ?? 'all'],
    queryFn: async () => {
      if (!clientId) return [];
      let query = supabase
        .from('client_documents')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }); // MVCC tie-breaker (C22)

      if (standardId) {
        query = query.eq('brand_standard_id', standardId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Client Documents Error:", error);
        throw error;
      }
      return data as ClientDocument[];
    },
    enabled: !!clientId
  });
}

interface UploadDocumentVars {
  clientId: string;
  file: File;
  brandStandardId?: string | null;
  description?: string | null;
  category?: string | null;
  replacesDocumentId?: string | null;
  version?: number;
}

export function useUploadClientDocument() {
  const queryClient = useQueryClient();
  return useMutation<ClientDocument, Error, UploadDocumentVars>({
    mutationFn: async (vars) => {
      const docId = crypto.randomUUID(); // C8: client-minted UUID
      const storagePath = `${vars.clientId}/${docId}/${vars.file.name}`;

      // Step 1: Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('client_documents')
        .upload(storagePath, vars.file, {
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // Step 2: Create metadata via RPC (atomic ownership validation)
      const { data, error: rpcError } = await supabase.rpc('create_client_document', {
        p_id: docId,
        p_client_id: vars.clientId,
        p_brand_standard_id: vars.brandStandardId ?? null,  // C11: explicit null
        p_file_name: vars.file.name,
        p_storage_path: storagePath,
        p_file_size: vars.file.size,
        p_mime_type: vars.file.type || null,
        p_description: vars.description ?? null,
        p_category: vars.category ?? null,
        p_version: vars.version ?? 1,
        p_replaces_id: vars.replacesDocumentId ?? null,
      });

      if (rpcError) {
        // Cleanup orphaned storage object on metadata failure
        await supabase.storage.from('client_documents').remove([storagePath]);
        throw rpcError;
      }

      // Return a reconstructed document for cache update
      return {
        id: data as string,
        client_id: vars.clientId,
        brand_standard_id: vars.brandStandardId ?? null,
        file_name: vars.file.name,
        storage_path: storagePath,
        file_size: vars.file.size,
        mime_type: vars.file.type || null,
        description: vars.description ?? null,
        category: vars.category ?? null,
        version: vars.version ?? 1,
        replaces_document_id: vars.replacesDocumentId ?? null,
        uploaded_by: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ClientDocument;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['client_documents', vars.clientId] });
      toast.success('Document uploaded successfully.');
    },
    onError: (err) => {
      console.error('Upload Document Error:', err);
      toast.error(`Failed to upload document: ${err.message}`);
    }
  });
}

export function useDeleteClientDocument(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (docId) => {
      const { error } = await supabase
        .from('client_documents')
        .update({ is_deleted: true })
        .eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_documents', clientId] });
      toast.success('Document removed.');
    },
    onError: (err) => {
      console.error('Delete Document Error:', err);
      toast.error(`Failed to remove document: ${err.message}`);
    }
  });
}

export function useDocumentVersionHistory(documentId: string | null) {
  return useQuery<ClientDocument[], Error>({
    queryKey: ['document_versions', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      // Follow the replaces_document_id chain backwards
      const { data, error } = await supabase
        .from('client_documents')
        .select('*')
        .or(`id.eq.${documentId},replaces_document_id.eq.${documentId}`)
        .order('version', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data as ClientDocument[];
    },
    enabled: !!documentId
  });
}
