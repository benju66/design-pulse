
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useClients } from '@/hooks/useClientQueries';
import { useProjects } from '@/hooks/useProjectCoreQueries';
import { Briefcase, Link2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function BrandStandardsSyncGrid({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data: projects } = useProjects();
  const currentProject = projects?.find(p => p.id === projectId);
  
  const { data: clients = [] } = useClients();
  const client = clients.find(c => c.id === currentProject?.client_id);

  // Fetch global brand standards for this client
  const { data: globalStandards = [], isLoading: isGlobalLoading } = useQuery({
    queryKey: ['client_brand_standards', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('client_brand_standards')
        .select('*')
        .eq('client_id', client.id)
        .eq('is_deleted', false);
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id
  });

  // Fetch project mapped standards
  const { data: projectStandards = [], isLoading: isProjectLoading } = useQuery({
    queryKey: ['project_brand_standards', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_brand_standards')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false);
      if (error) throw error;
      return data;
    }
  });

  const syncStandards = useMutation({
    mutationFn: async (payload: any[]) => {
      const { error } = await supabase.rpc('bulk_map_project_standards', {
        p_project_id: projectId,
        p_standards: payload
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_brand_standards', projectId] });
      toast.success('Brand standards synced successfully.');
    },
    onError: (err) => {
      console.error('Sync error:', err);
      toast.error('Failed to sync brand standards.');
    }
  });

  if (!currentProject?.client_id) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center animate-in fade-in">
        <Briefcase size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No Client Assigned</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
          This project is not currently associated with a Client. To sync Brand Standards, you must first assign a Client in the Project Info tab.
        </p>
      </div>
    );
  }

  const isLoading = isGlobalLoading || isProjectLoading;

  const handleSyncMissing = () => {
    // Find global standards that aren't mapped to this project yet
    const missing = globalStandards.filter(gs => !projectStandards.some(ps => ps.client_standard_id === gs.id));
    if (missing.length === 0) {
      toast.info('All global standards are already synced.');
      return;
    }

    const payload = missing.map(gs => ({
      client_standard_id: gs.id,
      cost_code: gs.cost_code,
      standard_description: gs.standard_description,
      is_verified: false // Needs verification in the staging grid
    }));

    syncStandards.mutate(payload);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
            <Link2 size={20} className="text-sky-500" />
            Brand Standards Sync
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Map {client?.name}'s global brand standards to specific project requirements.
          </p>
        </div>
        <button
          onClick={handleSyncMissing}
          disabled={syncStandards.isPending || isLoading}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
        >
          {syncStandards.isPending ? 'Syncing...' : 'Sync Missing Standards'}
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-500">Loading standards...</div>
      ) : projectStandards.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-slate-500">No brand standards synced yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="pb-3 font-semibold">Standard Description</th>
                <th className="pb-3 font-semibold">Cost Code / Spec</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {projectStandards.map(ps => (
                <tr key={ps.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">{ps.standard_description}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{ps.cost_code || 'Unmapped'}</td>
                  <td className="py-3">
                    {ps.is_verified ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                        <AlertTriangle size={12} /> Pending Verification
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
