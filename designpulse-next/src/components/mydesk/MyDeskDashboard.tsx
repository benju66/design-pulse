import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Opportunity } from '@/types/models';
import OpportunityGridV2 from '@/components/OpportunityGridV2';
import { Inbox, ArrowLeft, Calculator } from 'lucide-react';
import { usePendingEstimateUpdates } from '@/hooks/useOpportunityQueries';
import { useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { ReconcileValueModal } from '@/components/opportunities/ReconcileValueModal';
import { ReturnVEModal } from '@/components/mydesk/ReturnVEModal';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface MyDeskDashboardProps {
  projectId: string;
  opportunities: Opportunity[];
}

export default function MyDeskDashboard({ projectId, opportunities }: MyDeskDashboardProps) {
  const { session } = useAuth();
  const user = session?.user;
  const email = user?.email || '';
  const displayName = user?.user_metadata?.display_name || '';

  const [activeTab, setActiveTab] = useState<'tasks' | 'estimates'>('tasks');
  const [reconcileOppId, setReconcileOppId] = useState<string | null>(null);
  const [returnOppId, setReturnOppId] = useState<string | null>(null);
  
  const { data: pendingEstimates = [] } = usePendingEstimateUpdates(projectId);

  const { permissions, isLoading: permsLoading } = useCurrentUserPermissions(projectId);

  const myEstimates = pendingEstimates;

  const myTasks = opportunities.filter(opp => {
    // Match assignee (comma-separated list)
    const assignees = (opp.assignee || '').split(',').map(s => s.trim());
    const isAssigned = assignees.includes(email) || (displayName && assignees.includes(displayName));
    if (!isAssigned) return false;
    
    // Exclude archived/completed statuses
    const isActiveVE = ['Draft', 'Pending Review'].includes(opp.status || 'Draft');
    const isActiveCoord = ['Pending Plan Update', 'Ready for Review'].includes(opp.coordination_status || 'Not Required');
    return isActiveVE || isActiveCoord;
  });

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-50 dark:bg-slate-950 h-full overflow-hidden">
      <div className="mb-4 shrink-0 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Inbox className="text-sky-500" />
            My Desk
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Active tasks and items awaiting your attention.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 mb-4 shrink-0">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'tasks'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          My Coordination Tasks ({myTasks.length})
        </button>
        {permsLoading ? (
          <div className="w-32 h-8 animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg pb-2" />
        ) : permissions.can_manage_budget && (
          <button
            onClick={() => setActiveTab('estimates')}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'estimates'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Estimator Inbox ({myEstimates.length})
          </button>
        )}
      </div>
      
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm relative overflow-hidden flex flex-col">
        {activeTab === 'tasks' ? (
          <OpportunityGridV2 
            projectId={projectId} 
            data={myTasks} 
            viewMode="flat"
            onOpenCompare={() => {}}
            isolateState={true}
            hideGhostRow={true}
          />
        ) : (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">ID</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Title</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Selected Option</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Cost Code</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Locked Variance</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {myEstimates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No pending items to incorporate into the budget!
                    </td>
                  </tr>
                ) : myEstimates.map(opp => {
                  const lockedOpt = opp.opportunity_options?.find(o => o.is_locked);
                  return (
                    <tr key={opp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{opp.display_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-xs truncate" title={opp.title || ''}>
                        {opp.title}
                      </td>
                      <td className="px-4 py-3">
                        {lockedOpt ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{lockedOpt.title}</span>
                            {lockedOpt.description && <span className="text-xs text-slate-500 truncate max-w-xs">{lockedOpt.description}</span>}
                            {lockedOpt.category && <span className="text-xs text-slate-400 mt-0.5">{lockedOpt.category}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No option locked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{opp.cost_code || 'Unassigned'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${Number(opp.locked_variance ?? opp.cost_impact) < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(Number(opp.locked_variance ?? opp.cost_impact) || 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setReturnOppId(opp.id)}
                            className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30 rounded flex items-center gap-1 transition-colors"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            Return
                          </button>
                          <button 
                            onClick={() => setReconcileOppId(opp.id)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded flex items-center gap-1 transition-colors"
                          >
                            <Calculator className="w-3 h-3" />
                            Reconcile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reconcileOppId && (
        <ReconcileValueModal
          isOpen={true}
          onClose={() => setReconcileOppId(null)}
          projectId={projectId}
          opportunityId={reconcileOppId}
          pendingVariance={Number(myEstimates.find(o => o.id === reconcileOppId)?.locked_variance ?? myEstimates.find(o => o.id === reconcileOppId)?.cost_impact) || 0}
        />
      )}

      {returnOppId && (
        <ReturnVEModal
          isOpen={true}
          onClose={() => setReturnOppId(null)}
          projectId={projectId}
          opportunityId={returnOppId}
          lockedOption={myEstimates.find(o => o.id === returnOppId)?.opportunity_options?.find(opt => opt.is_locked) || null}
        />
      )}
    </div>
  );
}
