"use client";
import { useState, useEffect } from 'react';
import { OpportunityOption } from '@/types/models';
import { useReturnOpportunity } from '@/hooks/useOpportunityQueries';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReturnVEModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  projectId: string;
  lockedOption: OpportunityOption | null;
}

export function ReturnVEModal({ isOpen, onClose, opportunityId, projectId, lockedOption }: ReturnVEModalProps) {
  const [revisedCost, setRevisedCost] = useState<string>(lockedOption?.cost_impact?.toString() || '0');
  const [note, setNote] = useState('');
  
  const returnMutation = useReturnOpportunity(projectId);

  useEffect(() => {
    if (isOpen) {
      setRevisedCost(lockedOption?.cost_impact?.toString() || '0');
      setNote('');
    }
  }, [isOpen, lockedOption]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      toast.error('A note is required to return this item.');
      return;
    }

    try {
      await returnMutation.mutateAsync({
        opportunityId,
        revisedCost: parseFloat(revisedCost) || 0,
        note: note.trim()
      });
      toast.success('Item successfully returned to the Design Team.');
      onClose();
    } catch (err: any) {
      toast.error('Failed to return item', { description: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-rose-600 dark:text-rose-500 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Return to Design Team
          </h2>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 overflow-y-auto space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This will unlock the item and send it back to the Value Matrix. Please provide the revised true-up cost and explain why it is being returned.
            </p>

            {lockedOption && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                  <span className="font-semibold">{lockedOption.title}</span>
                  <span className="text-xs text-slate-500 mt-1">
                    Original Locked Value: ${Number(lockedOption.cost_impact || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="revisedCost" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Revised Cost Impact ($)
              </label>
              <input
                id="revisedCost"
                type="number"
                value={revisedCost}
                onChange={(e) => setRevisedCost(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:text-white sm:text-sm transition-colors"
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="note" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Return Note (Required)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Hard bids came back higher than estimated."
                required
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:text-white sm:text-sm transition-colors resize-none"
              />
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 mt-auto">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={returnMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={returnMutation.isPending || !note.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {returnMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {returnMutation.isPending ? 'Returning...' : 'Return Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
