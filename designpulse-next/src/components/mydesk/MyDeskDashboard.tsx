"use client";
import { useAuth } from '@/providers/AuthProvider';
import { Opportunity } from '@/types/models';
import OpportunityGrid from '@/components/OpportunityGrid';
import { Inbox } from 'lucide-react';

interface MyDeskDashboardProps {
  projectId: string;
  opportunities: Opportunity[];
}

export default function MyDeskDashboard({ projectId, opportunities }: MyDeskDashboardProps) {
  const { session } = useAuth();
  const user = session?.user;
  
  const email = user?.email || '';
  const displayName = user?.user_metadata?.display_name || '';

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
            Active tasks assigned to you.
          </p>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm relative overflow-hidden flex flex-col">
        <OpportunityGrid 
          projectId={projectId} 
          data={myTasks} 
          viewMode="flat"
          onOpenCompare={() => {}}
          isolateState={true}
          hideGhostRow={true}
        />
      </div>
    </div>
  );
}
