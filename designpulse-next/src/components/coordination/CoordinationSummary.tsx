import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { Opportunity } from '@/types/models';

interface TooltipPopoverProps {
  title: string;
  description: string;
  align?: 'left' | 'center' | 'right';
}

const TooltipPopover = ({ title, description, align = 'center' }: TooltipPopoverProps) => {
  const alignClass = 
    align === 'left' ? 'left-0' :
    align === 'right' ? 'right-0' :
    'left-1/2 -translate-x-1/2';
    
  return (
    <div className={`absolute top-full mt-3 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[100] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform -translate-y-2 group-hover:translate-y-0 pointer-events-none ${alignClass}`}>
      <div className="p-3 text-left">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{title}</h4>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{description}</p>
      </div>
    </div>
  );
};

interface Props {
  opportunities: Opportunity[];
  forceCollapse?: boolean;
}

export const CoordinationSummary = ({ opportunities, forceCollapse = false }: Props) => {
  const storeCollapsed = useUIStore(state => state.isCoordSummaryCollapsed);
  const toggleCollapse = useUIStore(state => state.toggleCoordSummary);
  
  const isCollapsed = forceCollapse || storeCollapsed;

  const metrics = useMemo(() => {
    const totalCount = opportunities.length;
    let itemsInDraft = 0;
    let inProgress = 0;
    let readyForReview = 0;
    let criticalItems = 0;
    const disciplines = {
      d_arch: { required: 0, complete: 0 },
      d_mech: { required: 0, complete: 0 },
      d_elec: { required: 0, complete: 0 }
    };

    opportunities.forEach(opp => {
      const status = opp.coordination_status || 'Draft';
      
      if (status === 'Draft') itemsInDraft++;
      if (status === 'In Drafting') inProgress++;
      if (status === 'Ready for Review') readyForReview++;
      
      if (opp.priority === 'Critical' && status !== 'Ready for Review' && status !== 'Implemented') {
        criticalItems++;
      }

      // 3. Discipline Progress
      const details = (opp.coordination_details || {}) as Record<string, any>;
      ['d_arch', 'd_mech', 'd_elec'].forEach(d => {
        const dStatus = details[d]?.status;
        if (dStatus && dStatus !== 'Not Required') {
          disciplines[d as keyof typeof disciplines].required++;
          if (dStatus === 'Complete') {
            disciplines[d as keyof typeof disciplines].complete++;
          }
        }
      });
    });

    return {
      totalCount,
      itemsInDraft,
      inProgress,
      readyForReview,
      criticalItems,
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
    <motion.div layout className="w-full">
      <AnimatePresence mode="popLayout" initial={false}>
        {isCollapsed ? (
          <motion.div
            layout
            key="micro"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex-wrap w-full"
          >
            <div className="flex items-center flex-wrap gap-4 px-2">
              <div className="relative group flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Tracked:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{metrics.totalCount}</span>
                <TooltipPopover align="left" title="Total Tracked" description="Total number of VE items currently in the coordination pipeline." />
              </div>
              
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="relative group flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-500">In Progress:</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{metrics.inProgress}</span>
                <TooltipPopover title="In Progress" description="Items currently in the active drafting phase." />
              </div>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="relative group flex items-center gap-2">
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-500">Review:</span>
                <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{metrics.readyForReview}</span>
                <TooltipPopover title="Ready for Review" description="Items where all required discipline checklists are marked as complete." />
              </div>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="relative group flex items-center gap-2">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-500">Critical:</span>
                <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{metrics.criticalItems}</span>
                <TooltipPopover align="right" title="Critical Blockers" description="High priority items that have not yet reached the Ready for Review stage." />
              </div>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="relative group flex items-center gap-3 ml-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-lg">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completion:</span>
                 <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Arch <span className="font-bold">{metrics.disciplines.d_arch.complete}/{metrics.disciplines.d_arch.required}</span></span>
                 <span className="text-slate-300 dark:text-slate-600">•</span>
                 <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Mech <span className="font-bold">{metrics.disciplines.d_mech.complete}/{metrics.disciplines.d_mech.required}</span></span>
                 <span className="text-slate-300 dark:text-slate-600">•</span>
                 <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Elec <span className="font-bold">{metrics.disciplines.d_elec.complete}/{metrics.disciplines.d_elec.required}</span></span>
              </div>
            </div>
            
            {!forceCollapse && (
              <div className="ml-auto flex items-center pl-4 border-l border-slate-200 dark:border-slate-700">
                <button 
                  onClick={toggleCollapse}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                  title="Expand Summary"
                >
                  <ChevronDown size={18} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            layout
            key="macro"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 @5xl:grid-cols-2 gap-6 relative w-full"
          >
            <div className="absolute -top-3 -right-3 z-10">
              <button 
                onClick={toggleCollapse}
                className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shadow-sm transition-all hover:scale-105"
                title="Collapse Summary"
              >
                <ChevronUp size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Cluster 1: Pipeline Status */}
            <div className="flex flex-col border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-4">
               <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 px-1">Pipeline Status</h3>
               <div className="grid grid-cols-1 @3xl:grid-cols-4 gap-4 h-full">
                  {/* Draft Items */}
                  <div className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Draft</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.itemsInDraft}</span>
                    <TooltipPopover align="left" title="Draft Items" description="Total number of VE items explicitly marked as Draft and not yet actively in progress." />
                  </div>
                  {/* In Progress */}
                  <div className="relative group bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-sm text-amber-600 dark:text-amber-500 font-medium">In Progress</span>
                    <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">{metrics.inProgress}</span>
                    <TooltipPopover title="In Progress" description="Items currently in the active drafting and coordination phase." />
                  </div>
                  {/* Ready for Review */}
                  <div className="relative group bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">Ready for Review</span>
                    <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">{metrics.readyForReview}</span>
                    <TooltipPopover title="Ready for Review" description="Items where all required discipline checklists are marked as complete and are awaiting final approval." />
                  </div>
                  {/* Critical Blockers */}
                  <div className={`relative group ${metrics.criticalItems > 0 ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30' : 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800'} border rounded-xl p-4 flex flex-col justify-center`}>
                    <span className={`text-sm ${metrics.criticalItems > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-500 dark:text-slate-400'} font-medium`}>Critical Blockers</span>
                    <span className={`text-2xl font-bold ${metrics.criticalItems > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{metrics.criticalItems}</span>
                    <TooltipPopover align="right" title="Critical Blockers" description="High priority items that have not yet reached the Ready for Review stage and require immediate attention." />
                  </div>
               </div>
            </div>

            {/* Cluster 2: Discipline Coordination */}
            <div className="flex flex-col border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/20 dark:bg-slate-900/5 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-600/80 dark:text-slate-500/80 uppercase tracking-wider mb-4 px-1">Discipline Coordination</h3>
              <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-4 h-full content-center">
                {renderDisciplineProgress('Architecture', 'd_arch')}
                {renderDisciplineProgress('Mechanical', 'd_mech')}
                {renderDisciplineProgress('Electrical', 'd_elec')}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
