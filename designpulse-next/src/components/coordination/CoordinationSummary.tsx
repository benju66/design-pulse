import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { Opportunity } from '@/types/models';

interface Props {
  opportunities: Opportunity[];
}

export const CoordinationSummary = ({ opportunities }: Props) => {
  const isCollapsed = useUIStore(state => state.isCoordSummaryCollapsed);
  const toggleCollapse = useUIStore(state => state.toggleCoordSummary);

  const metrics = useMemo(() => {
    let pendingTasks = 0;
    let criticalBlockers = 0;
    let readyForReview = 0;
    const disciplines = {
      d_arch: { required: 0, complete: 0 },
      d_mech: { required: 0, complete: 0 },
      d_elec: { required: 0, complete: 0 }
    };

    opportunities.forEach(opp => {
      // 1. Pending Tasks
      if (opp.status === 'In Drafting' || opp.status === 'Pending Plan Update') {
        pendingTasks++;
        // 2. Critical Blockers
        if (opp.priority === 'Critical') {
          criticalBlockers++;
        }
      }

      if (opp.status === 'Ready for Review') {
        readyForReview++;
      }

      // 3. Discipline Progress
      const details = (opp.coordination_details || {}) as Record<string, any>;
      ['d_arch', 'd_mech', 'd_elec'].forEach(d => {
        const status = details[d]?.status;
        if (status && status !== 'Not Required') {
          disciplines[d as keyof typeof disciplines].required++;
          if (status === 'Complete') {
            disciplines[d as keyof typeof disciplines].complete++;
          }
        }
      });
    });

    return {
      pendingTasks,
      criticalBlockers,
      readyForReview,
      disciplines
    };
  }, [opportunities]);

  const renderDisciplineProgress = (label: string, id: 'd_arch' | 'd_mech' | 'd_elec') => {
    const data = metrics.disciplines[id];
    const percentage = data.required === 0 ? 100 : Math.round((data.complete / data.required) * 100);
    const isDone = data.required > 0 && data.complete === data.required;
    const isZero = data.required === 0;

    return (
      <div key={id} className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-600 dark:text-slate-300">{label}</span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            {isZero ? '--' : `${data.complete} / ${data.required}`}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-sky-500'}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 relative z-10 shadow-sm">
      <div 
        onClick={toggleCollapse}
        className="px-6 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-100 dark:border-slate-800/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Coordination Summary
          </span>
          {isCollapsed && (
            <div className="flex items-center gap-3 ml-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <AlertCircle size={12} className={metrics.criticalBlockers > 0 ? 'text-rose-500' : 'text-slate-400'} />
                {metrics.criticalBlockers} Critical
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-purple-500" />
                {metrics.readyForReview} Review
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="flex items-center gap-1">
                <FileText size={12} className="text-amber-500" />
                {metrics.pendingTasks} Pending
              </span>
            </div>
          )}
        </div>
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-wrap gap-6 items-center">
              
              <div className="flex items-center gap-6 pr-6 border-r border-slate-200 dark:border-slate-700/50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Updates</span>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <FileText size={16} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{metrics.pendingTasks}</span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Critical Blockers</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${metrics.criticalBlockers > 0 ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      {metrics.criticalBlockers === 0 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{metrics.criticalBlockers}</span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ready for Review</span>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{metrics.readyForReview}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex items-center gap-6 min-w-[300px]">
                {renderDisciplineProgress('Architecture', 'd_arch')}
                {renderDisciplineProgress('Mechanical', 'd_mech')}
                {renderDisciplineProgress('Electrical', 'd_elec')}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
