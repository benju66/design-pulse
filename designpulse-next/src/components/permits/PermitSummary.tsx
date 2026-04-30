import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { Permit } from '@/types/models';

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
  permits: Permit[];
  forceCollapse?: boolean;
}

export const PermitSummary = ({ permits, forceCollapse = false }: Props) => {
  const storeCollapsed = useUIStore(state => state.isPermitSummaryCollapsed);
  const toggleCollapse = useUIStore(state => state.togglePermitSummary);
  
  const isCollapsed = forceCollapse || storeCollapsed;

  const metrics = useMemo(() => {
    const totalCount = permits.length;
    let underReview = 0;
    let approved = 0;

    permits.forEach(permit => {
      const status = permit.status || 'Preparing';
      
      if (status === 'Under Review' || status === 'Comments Received') {
        underReview++;
      }
      if (status === 'Approved') {
        approved++;
      }
    });

    return {
      totalCount,
      underReview,
      approved
    };
  }, [permits]);

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
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Permits:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{metrics.totalCount}</span>
                <TooltipPopover align="left" title="Total Permits" description="Total number of permits tracked in this project." />
              </div>
              
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="relative group flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-500">Under Review:</span>
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{metrics.underReview}</span>
                <TooltipPopover title="Under Review" description="Permits currently under review by the AHJ." />
              </div>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              
              <div className="relative group flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">Approved:</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{metrics.approved}</span>
                <TooltipPopover align="right" title="Approved" description="Permits that have been fully approved." />
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
            <div className="flex flex-col border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-4 @5xl:col-span-2">
               <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 px-1">Permit Pipeline</h3>
               <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-4 h-full">
                  {/* Total Permits */}
                  <div className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Tracked</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalCount}</span>
                    <TooltipPopover align="left" title="Total Permits" description="Total number of permits explicitly tracked in the system." />
                  </div>
                  {/* Under Review */}
                  <div className="relative group bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-sm text-indigo-600 dark:text-indigo-500 font-medium">Under Review</span>
                    <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{metrics.underReview}</span>
                    <TooltipPopover title="Under Review" description="Permits currently under review by the AHJ, including those with comments received." />
                  </div>
                  {/* Approved */}
                  <div className="relative group bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Approved</span>
                    <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{metrics.approved}</span>
                    <TooltipPopover align="right" title="Approved" description="Permits that have been fully approved." />
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
