import { Opportunity, DisciplineDetails, DisciplineConfig } from '@/types/models';
import { useUpdateOpportunity, useProjectSettings } from '@/hooks/useProjectQueries';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Row } from '@tanstack/react-table';

interface DisciplineAccordionProps {
  row: Row<Opportunity>;
  projectId: string;
}

export const DisciplineAccordion = ({ row, projectId }: DisciplineAccordionProps) => {
  const opportunity = row.original;
  const { data: settings } = useProjectSettings(projectId);
  const updateMutation = useUpdateOpportunity(projectId);

  const defaultDisciplines: DisciplineConfig[] = [
    { id: 'd_arch', label: 'Arch' },
    { id: 'd_civil', label: 'Civil' },
    { id: 'd_struct', label: 'Struct' },
    { id: 'd_mech', label: 'Mech' },
    { id: 'd_elec', label: 'Elec' },
    { id: 'd_plumb', label: 'Plumb' }
  ];
  const disciplines: DisciplineConfig[] = (settings as any)?.disciplines || defaultDisciplines;
  const coordDetails = opportunity.coordination_details || {};

  const handleUpdate = (discipline: string, updates: Partial<DisciplineDetails>) => {
    const current = (coordDetails as any)[discipline] || { status: 'Not Required', notes: '' };
    const updatedDetails = {
      ...(coordDetails as Record<string, any>),
      [discipline]: { ...current, ...updates }
    };

    updateMutation.mutate({
      id: opportunity.id,
      updates: { coordination_details: updatedDetails }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Complete': return <CheckCircle2 size={14} className="text-emerald-500" />;
      case 'Pending': 
      case 'Required': return <AlertCircle size={14} className="text-amber-500" />;
      default: return <Circle size={14} className="text-slate-300 dark:text-slate-600" />;
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-800">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {disciplines.map((discipline: DisciplineConfig) => {
          const current = (coordDetails as any)[discipline.id] || { status: 'Not Required', notes: '' };
          
          return (
            <div key={discipline.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  {getStatusIcon(current.status)}
                  {discipline.label}
                </h5>
                <select
                  value={current.status}
                  onChange={(e) => handleUpdate(discipline.id, { status: e.target.value as DisciplineDetails['status'] })}
                  className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-none rounded py-1 px-2 focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer"
                >
                  <option value="Not Required">Not Required</option>
                  <option value="Pending">Pending</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>
              <textarea
                value={current.notes}
                onChange={(e) => handleUpdate(discipline.id, { notes: e.target.value })}
                placeholder="Coordination notes or sheet references..."
                className="w-full text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-md p-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-300"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
