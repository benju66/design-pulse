import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import type { VeScenario, VeScenarioPackage, VeScenarioWithPackages } from '@/types/scenario';

// ============================================================================
// Query Key
// ============================================================================
const SCENARIOS_KEY = (projectId: string) => ['ve-scenarios', projectId] as const;

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetch all non-deleted scenarios for a project, with their junction rows joined client-side.
 * Follows the same parallel-fetch + client-side join pattern as useVePackages.
 */
export function useVeScenarios(projectId: string | null) {
  return useQuery<VeScenarioWithPackages[], Error>({
    queryKey: SCENARIOS_KEY(projectId!),
    queryFn: async () => {
      if (!projectId) return [];

      const [scenariosResult, junctionResult] = await Promise.all([
        supabase
          .from('ve_scenarios')
          .select('*')
          .eq('project_id', projectId)
          .eq('is_deleted', false)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('ve_scenario_packages')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (scenariosResult.error) {
        console.warn('Supabase VE Scenarios Error:', scenariosResult.error);
        return [];
      }
      if (junctionResult.error) {
        console.warn('Supabase VE Scenario Packages Error:', junctionResult.error);
        return [];
      }

      const scenarios = scenariosResult.data as VeScenario[];
      const junctions = junctionResult.data as VeScenarioPackage[];

      // Client-side join: group junction rows by scenario_id
      const junctionsByScenario = junctions.reduce<Record<string, VeScenarioPackage[]>>((acc, jp) => {
        acc[jp.scenario_id] = acc[jp.scenario_id] || [];
        acc[jp.scenario_id].push(jp);
        return acc;
      }, {});

      return scenarios.map(s => ({
        ...s,
        scenarioPackages: junctionsByScenario[s.id] || [],
      }));
    },
    enabled: !!projectId,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new scenario.
 */
export function useCreateScenario(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<VeScenario, Error, { name?: string }>({
    mutationFn: async ({ name } = {}) => {
      const existing = queryClient.getQueryData<VeScenarioWithPackages[]>(SCENARIOS_KEY(projectId));
      const maxSort = existing?.reduce((max, s) => Math.max(max, s.sort_order), -1) ?? -1;

      const { data, error } = await supabase
        .from('ve_scenarios')
        .insert({
          project_id: projectId,
          name: name || 'New Scenario',
          sort_order: maxSort + 1,
        })
        .select()
        .single();

      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as VeScenario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
      toast.success('Scenario created');
    },
    onError: (err) => {
      console.error('Create Scenario Error:', err);
      toast.error(`Failed to create scenario: ${err.message}`);
    },
  });
}

/**
 * Update a scenario (rename, reorder, description).
 */
export function useUpdateScenario(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    VeScenario,
    Error,
    { id: string; updates: Partial<Pick<VeScenario, 'name' | 'description' | 'sort_order'>> },
    { previous: VeScenarioWithPackages[] | undefined }
  >({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('ve_scenarios')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as VeScenario;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: SCENARIOS_KEY(projectId) });
      const previous = queryClient.getQueryData<VeScenarioWithPackages[]>(SCENARIOS_KEY(projectId));

      queryClient.setQueryData<VeScenarioWithPackages[]>(SCENARIOS_KEY(projectId), old => {
        if (!old) return old;
        return old.map(s => s.id === id ? { ...s, ...updates } : s);
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SCENARIOS_KEY(projectId), context.previous);
      }
      console.error('Update Scenario Error:', err);
      toast.error(`Failed to update scenario: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
    },
  });
}

/**
 * Soft-delete a scenario.
 */
export function useDeleteScenario(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (scenarioId) => {
      const { error } = await supabase
        .from('ve_scenarios')
        .update({ is_deleted: true })
        .eq('id', scenarioId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onMutate: async (scenarioId) => {
      await queryClient.cancelQueries({ queryKey: SCENARIOS_KEY(projectId) });
      queryClient.setQueryData<VeScenarioWithPackages[]>(SCENARIOS_KEY(projectId), old =>
        old?.filter(s => s.id !== scenarioId)
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
    },
    onError: (err) => {
      console.error('Delete Scenario Error:', err);
      toast.error(`Failed to delete scenario: ${err.message}`);
    },
  });
}

/**
 * Add a package to a scenario.
 */
export function useAddScenarioPackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<VeScenarioPackage, Error, { scenarioId: string; packageId: string }>({
    mutationFn: async ({ scenarioId, packageId }) => {
      const { data, error } = await supabase
        .from('ve_scenario_packages')
        .insert({
          scenario_id: scenarioId,
          package_id: packageId,
          project_id: projectId,
          sort_order: 0,
        })
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as VeScenarioPackage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
    },
    onError: (err) => {
      console.error('Add Scenario Package Error:', err);
      toast.error(`Failed to add package: ${err.message}`);
    },
  });
}

/**
 * Remove a package from a scenario.
 */
export function useRemoveScenarioPackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { scenarioId: string; packageId: string }>({
    mutationFn: async ({ scenarioId, packageId }) => {
      const { error } = await supabase
        .from('ve_scenario_packages')
        .delete()
        .eq('scenario_id', scenarioId)
        .eq('package_id', packageId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onMutate: async ({ scenarioId, packageId }) => {
      await queryClient.cancelQueries({ queryKey: SCENARIOS_KEY(projectId) });
      queryClient.setQueryData<VeScenarioWithPackages[]>(SCENARIOS_KEY(projectId), old =>
        old?.map(s =>
          s.id === scenarioId
            ? { ...s, scenarioPackages: s.scenarioPackages.filter(sp => sp.package_id !== packageId) }
            : s
        )
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
    },
    onError: (err) => {
      console.error('Remove Scenario Package Error:', err);
      toast.error(`Failed to remove package: ${err.message}`);
    },
  });
}

/**
 * Reorder packages within a scenario — batch updates sort_order.
 * Directly affects DR-2 first-package-wins financial calculations.
 */
export function useReorderScenarioPackages(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { scenarioId: string; orderedPackageIds: string[] },
    { previous: VeScenarioWithPackages[] | undefined }
  >({
    mutationFn: async ({ scenarioId, orderedPackageIds }) => {
      // Batch update sort_order for each junction row
      await Promise.all(
        orderedPackageIds.map((packageId, index) =>
          supabase
            .from('ve_scenario_packages')
            .update({ sort_order: index })
            .eq('scenario_id', scenarioId)
            .eq('package_id', packageId)
        )
      );
    },
    onMutate: async ({ scenarioId, orderedPackageIds }) => {
      await queryClient.cancelQueries({ queryKey: SCENARIOS_KEY(projectId) });
      const previous = queryClient.getQueryData<VeScenarioWithPackages[]>(SCENARIOS_KEY(projectId));

      queryClient.setQueryData<VeScenarioWithPackages[]>(SCENARIOS_KEY(projectId), old => {
        if (!old) return old;
        return old.map(s => {
          if (s.id !== scenarioId) return s;
          // Rebuild scenarioPackages in the new order
          const byPkgId = new Map(s.scenarioPackages.map(sp => [sp.package_id, sp]));
          const reordered = orderedPackageIds
            .map((pkgId, idx) => {
              const sp = byPkgId.get(pkgId);
              return sp ? { ...sp, sort_order: idx } : null;
            })
            .filter(Boolean) as VeScenarioPackage[];
          return { ...s, scenarioPackages: reordered };
        });
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SCENARIOS_KEY(projectId), context.previous);
      }
      console.error('Reorder Scenario Packages Error:', err);
      toast.error(`Failed to reorder packages: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
    },
  });
}


/**
 * Duplicate a scenario with all its package assignments.
 */
export function useDuplicateScenario(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<VeScenarioWithPackages, Error, VeScenarioWithPackages>({
    mutationFn: async (source) => {
      // 1. Create new scenario
      const { data: newScenario, error: scenarioError } = await supabase
        .from('ve_scenarios')
        .insert({
          project_id: projectId,
          name: `${source.name} (Copy)`,
          description: source.description,
          sort_order: source.sort_order + 1,
        })
        .select()
        .single();

      if (scenarioError) throw new Error(scenarioError.message || JSON.stringify(scenarioError));
      const scenario = newScenario as VeScenario;

      // 2. Clone junction rows
      if (source.scenarioPackages.length > 0) {
        const { error: junctionError } = await supabase
          .from('ve_scenario_packages')
          .insert(
            source.scenarioPackages.map((sp, idx) => ({
              scenario_id: scenario.id,
              package_id: sp.package_id,
              project_id: projectId,
              sort_order: idx,
            }))
          );
        if (junctionError) throw new Error(junctionError.message || JSON.stringify(junctionError));
      }

      return { ...scenario, scenarioPackages: [] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
      toast.success('Scenario duplicated');
    },
    onError: (err) => {
      console.error('Duplicate Scenario Error:', err);
      toast.error(`Failed to duplicate scenario: ${err.message}`);
    },
  });
}

/**
 * Apply a scenario — batch-locks all contenders via the apply_ve_scenario RPC.
 */
export function useApplyScenario(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ locked: number; skipped: number }, Error, string>({
    mutationFn: async (scenarioId) => {
      const { data, error } = await supabase.rpc('apply_ve_scenario', {
        p_scenario_id: scenarioId,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data as { locked: number; skipped: number };
    },
    onSuccess: (result) => {
      toast.success(`Scenario applied: ${result.locked} item(s) locked`);
      // Invalidate both opportunities and packages — locks have changed
      queryClient.invalidateQueries({ queryKey: ['opportunities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['all_project_options', projectId] });
      queryClient.invalidateQueries({ queryKey: ['ve-packages', projectId] });
      queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY(projectId) });
      queryClient.invalidateQueries({ queryKey: ['budget-waterfall', projectId] });
      queryClient.invalidateQueries({ queryKey: ['master-ledger-grid', projectId] });
    },
    onError: (err) => {
      console.error('Apply Scenario Error:', err);
      toast.error(`Failed to apply scenario: ${err.message}`);
    },
  });
}
