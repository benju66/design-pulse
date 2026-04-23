import React from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { ExpandedCard } from './opportunities/ExpandedCard';
import { useUpdateOpportunity } from '@/hooks/useProjectQueries';

export default function CompareModal({ isOpen, onClose, projectId, opportunities }) {
  const compareQueue = useUIStore(state => state.compareQueue);
  const updateData = useUpdateOpportunity(projectId);

  if (!isOpen) return null;

  const compareItems = opportunities.filter(opp => compareQueue.includes(opp.id));
  
  // Create a dummy row object for ExpandedCard
  const createMockRow = (opp) => ({
    original: opp,
    getIsExpanded: () => true,
    toggleExpanded: () => {},
  });

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-6">
      <div className="bg-white dark:bg-slate-900 w-full h-full max-w-[1600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Compare Options</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Reviewing {compareItems.length} selected items side-by-side.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-slate-100 dark:bg-slate-950/50">
          <div className="flex gap-6 h-full min-w-max">
            {compareItems.map(opp => (
              <div key={opp.id} className="h-full overflow-y-auto w-[600px] flex flex-col">
                <div className="bg-white dark:bg-slate-800 rounded-t-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 mx-4 mt-4 border-b-0">
                  <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">{opp.title || 'Untitled Option'}</h3>
                  <div className="flex gap-6 mt-3 text-sm text-slate-500 dark:text-slate-400">
                    <span className="bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-full"><strong>Location:</strong> {opp.location || 'N/A'}</span>
                    <span className={`px-3 py-1 rounded-full font-semibold ${opp.cost_impact < 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                      <strong>Cost Impact:</strong> ${opp.cost_impact || 0}
                    </span>
                  </div>
                </div>
                {/* ExpandedCard already has margins, we subtract the top margin so it attaches to the header */}
                <div className="-mt-4">
                  <ExpandedCard row={createMockRow(opp)} updateData={updateData} />
                </div>
              </div>
            ))}
            {compareItems.length === 0 && (
              <div className="w-full flex items-center justify-center text-slate-500">
                No items selected to compare.
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
