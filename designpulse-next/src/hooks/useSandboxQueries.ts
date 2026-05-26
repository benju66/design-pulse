import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import type { VePackage, VePackageItem, VePackageWithItems } from '@/types/sandbox';

// ============================================================================
// Query Key
// ============================================================================
const PACKAGES_KEY = (projectId: string) => ['ve-packages', projectId] as const;

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetch all non-deleted packages for a project, with their items joined client-side.
 * Two separate Supabase queries (packages + items) joined via reduce.
 */
export function useVePackages(projectId: string | null) {
  return useQuery<VePackageWithItems[], Error>({
    queryKey: PACKAGES_KEY(projectId!),
    queryFn: async () => {
      if (!projectId) return [];

      // Parallel fetch: packages + items
      const [packagesResult, itemsResult] = await Promise.all([
        supabase
          .from('ve_packages')
          .select('*')
          .eq('project_id', projectId)
          .eq('is_deleted', false)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('ve_package_items')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (packagesResult.error) {
        console.warn('Supabase VE Packages Error:', packagesResult.error);
        return [];
      }
      if (itemsResult.error) {
        console.warn('Supabase VE Package Items Error:', itemsResult.error);
        return [];
      }

      const packages = packagesResult.data as VePackage[];
      const items = itemsResult.data as VePackageItem[];

      // Client-side join: group items by package_id
      const itemsByPackage = items.reduce<Record<string, VePackageItem[]>>((acc, item) => {
        acc[item.package_id] = acc[item.package_id] || [];
        acc[item.package_id].push(item);
        return acc;
      }, {});

      return packages.map(pkg => ({
        ...pkg,
        items: itemsByPackage[pkg.id] || [],
      }));
    },
    enabled: !!projectId,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new VE package with optimistic insert.
 */
export function useCreatePackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<VePackage, Error, { name?: string; color?: string }>({
    mutationFn: async ({ name, color } = {}) => {
      // Get current max sort_order for positioning
      const existing = queryClient.getQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId));
      const maxSort = existing?.reduce((max, p) => Math.max(max, p.sort_order), -1) ?? -1;

      const { data, error } = await supabase
        .from('ve_packages')
        .insert({
          project_id: projectId,
          name: name || 'New Package',
          color: color || 'violet',
          sort_order: maxSort + 1,
        })
        .select()
        .single();

      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as VePackage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
    },
    onError: (err) => {
      console.error('Create Package Error:', err);
      toast.error(`Failed to create package: ${err.message}`);
    },
  });
}

/**
 * Update a package (rename, recolor, reorder, update notes).
 */
export function useUpdatePackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    VePackage,
    Error,
    { id: string; updates: Partial<Pick<VePackage, 'name' | 'color' | 'notes' | 'sort_order'>> },
    { previous: VePackageWithItems[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('ve_packages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as VePackage;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: PACKAGES_KEY(projectId) });
      const previous = queryClient.getQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId));

      queryClient.setQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId), old => {
        if (!old) return old;
        return old.map(pkg => pkg.id === id ? { ...pkg, ...updates } : pkg);
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PACKAGES_KEY(projectId), context.previous);
      }
      console.error('Update Package Error:', err);
      toast.error(`Failed to update package: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
    },
  });
}

/**
 * Soft-delete a package (is_deleted = true).
 */
export function useDeletePackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    string,
    Error,
    string, // packageId
    { previous: VePackageWithItems[] | undefined }
  >({
    mutationFn: async (packageId) => {
      const { error } = await supabase
        .from('ve_packages')
        .update({ is_deleted: true })
        .eq('id', packageId);
      if (error) throw new Error(error.message || JSON.stringify(error));
      return packageId;
    },
    onMutate: async (packageId) => {
      await queryClient.cancelQueries({ queryKey: PACKAGES_KEY(projectId) });
      const previous = queryClient.getQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId));

      queryClient.setQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId), old => {
        if (!old) return old;
        return old.filter(pkg => pkg.id !== packageId);
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PACKAGES_KEY(projectId), context.previous);
      }
      console.error('Delete Package Error:', err);
      toast.error(`Failed to delete package: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
    },
  });
}

/**
 * Bulk-add opportunity IDs to a package.
 * Items are added with assumed_option_id = null (user selects contenders in the panel).
 * Silently skips duplicates via onConflict.
 */
export function useAddPackageItems(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    VePackageItem[],
    Error,
    { packageId: string; opportunityIds: string[] }
  >({
    mutationFn: async ({ packageId, opportunityIds }) => {
      if (opportunityIds.length === 0) return [];

      const { data, error } = await supabase
        .from('ve_package_items')
        .upsert(
          opportunityIds.map((oppId, idx) => ({
            package_id: packageId,
            opportunity_id: oppId,
            project_id: projectId,
            assumed_option_id: null,
            sort_order: idx,
          })),
          { onConflict: 'package_id,opportunity_id', ignoreDuplicates: true }
        )
        .select();

      if (error) throw new Error(error.message || JSON.stringify(error));
      return (data || []) as VePackageItem[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
      toast.success('Items added to package');
    },
    onError: (err) => {
      console.error('Add Package Items Error:', err);
      toast.error(`Failed to add items: ${err.message}`);
    },
  });
}

/**
 * Remove a single item from a package.
 */
export function useRemovePackageItem(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    string,
    Error,
    string, // packageItemId
    { previous: VePackageWithItems[] | undefined }
  >({
    mutationFn: async (packageItemId) => {
      const { error } = await supabase
        .from('ve_package_items')
        .delete()
        .eq('id', packageItemId);
      if (error) throw new Error(error.message || JSON.stringify(error));
      return packageItemId;
    },
    onMutate: async (packageItemId) => {
      await queryClient.cancelQueries({ queryKey: PACKAGES_KEY(projectId) });
      const previous = queryClient.getQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId));

      queryClient.setQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId), old => {
        if (!old) return old;
        return old.map(pkg => ({
          ...pkg,
          items: pkg.items.filter(item => item.id !== packageItemId),
        }));
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PACKAGES_KEY(projectId), context.previous);
      }
      console.error('Remove Package Item Error:', err);
      toast.error(`Failed to remove item: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
    },
  });
}

/**
 * Update sort_order after DnD reorder of items within a package.
 */
export function useReorderPackageItems(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { items: Array<{ id: string; sort_order: number }> }>({
    mutationFn: async ({ items }) => {
      // Batch update via Promise.all — items array is typically small (<20)
      const results = await Promise.all(
        items.map(({ id, sort_order }) =>
          supabase
            .from('ve_package_items')
            .update({ sort_order })
            .eq('id', id)
        )
      );

      const failed = results.find(r => r.error);
      if (failed?.error) throw new Error(failed.error.message || JSON.stringify(failed.error));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
    },
    onError: (err) => {
      console.error('Reorder Package Items Error:', err);
      toast.error(`Failed to reorder items: ${err.message}`);
    },
  });
}

/**
 * Update assumed_option_id on a package item (contender selection for scenario planning).
 */
export function useSetAssumedOption(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    VePackageItem,
    Error,
    { packageItemId: string; assumedOptionId: string | null },
    { previous: VePackageWithItems[] | undefined }
  >({
    mutationFn: async ({ packageItemId, assumedOptionId }) => {
      const { data, error } = await supabase
        .from('ve_package_items')
        .update({ assumed_option_id: assumedOptionId })
        .eq('id', packageItemId)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as VePackageItem;
    },
    onMutate: async ({ packageItemId, assumedOptionId }) => {
      await queryClient.cancelQueries({ queryKey: PACKAGES_KEY(projectId) });
      const previous = queryClient.getQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId));

      queryClient.setQueryData<VePackageWithItems[]>(PACKAGES_KEY(projectId), old => {
        if (!old) return old;
        return old.map(pkg => ({
          ...pkg,
          items: pkg.items.map(item =>
            item.id === packageItemId
              ? { ...item, assumed_option_id: assumedOptionId }
              : item
          ),
        }));
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PACKAGES_KEY(projectId), context.previous);
      }
      console.error('Set Assumed Option Error:', err);
      toast.error(`Failed to set contender: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
    },
  });
}

/**
 * EDGE-1: Fire-and-forget cleanup of stale assumed_option_id references.
 * Called when useSandboxMetrics detects a contender that no longer exists in the live options array.
 */
export function useCleanupStaleOptionRef(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (packageItemId) => {
      const { error } = await supabase
        .from('ve_package_items')
        .update({ assumed_option_id: null })
        .eq('id', packageItemId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
    },
  });
}

/**
 * Duplicate an existing package with all its items.
 * Creates a new package with "(Copy)" suffix and clones all junction rows.
 */
export function useDuplicatePackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<VePackageWithItems, Error, VePackageWithItems>({
    mutationFn: async (sourcePackage) => {
      // 1. Create the new package
      const { data: newPkg, error: pkgError } = await supabase
        .from('ve_packages')
        .insert({
          project_id: projectId,
          name: `${sourcePackage.name} (Copy)`,
          color: sourcePackage.color,
          notes: sourcePackage.notes,
          sort_order: sourcePackage.sort_order + 1,
        })
        .select()
        .single();

      if (pkgError) throw new Error(pkgError.message || JSON.stringify(pkgError));

      const pkg = newPkg as VePackage;

      // 2. Clone all items (with their assumed_option_id values)
      if (sourcePackage.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('ve_package_items')
          .insert(
            sourcePackage.items.map((item, idx) => ({
              package_id: pkg.id,
              opportunity_id: item.opportunity_id,
              project_id: projectId,
              assumed_option_id: item.assumed_option_id,
              sort_order: idx,
            }))
          );
        if (itemsError) throw new Error(itemsError.message || JSON.stringify(itemsError));
      }

      return { ...pkg, items: [] }; // Items will be fetched on invalidation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PACKAGES_KEY(projectId) });
      toast.success('Package duplicated');
    },
    onError: (err) => {
      console.error('Duplicate Package Error:', err);
      toast.error(`Failed to duplicate package: ${err.message}`);
    },
  });
}
