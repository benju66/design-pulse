"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';
import { useReconcileOpportunity } from "@/hooks/useOpportunityQueries";
import { useProjectEstimateVersions } from "@/hooks/useEstimateQueries";
import { toast } from 'sonner';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

interface ReconcileValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  opportunityId: string;
  pendingVariance: number;
}

export function ReconcileValueModal({ isOpen, onClose, projectId, opportunityId, pendingVariance }: ReconcileValueModalProps) {
  const [realizedCost, setRealizedCost] = useState<number>(pendingVariance);
  const [note, setNote] = useState("");
  
  const { mutate: reconcile, isPending } = useReconcileOpportunity(projectId);
  const { data: versions } = useProjectEstimateVersions(projectId);
  
  const activeVersion = versions?.find(v => v.is_active);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRealizedCost(pendingVariance);
      setNote("");
    }
  }, [isOpen, pendingVariance]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVersion) return;

    reconcile({
      opportunityId,
      versionId: activeVersion.id,
      realizedCost,
      note
    }, {
      onSuccess: () => {
        toast.success(`Realized ${formatCurrency(realizedCost)} — merged into ${activeVersion.version_name}`, {
          description: `The locked variance of ${formatCurrency(pendingVariance)} was reconciled with a final realized impact of ${formatCurrency(realizedCost)}.`
        });
        onClose();
      }
    });
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle className="text-indigo-500 w-5 h-5" />
            Reconcile VE Value
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {!activeVersion && (
            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-3 rounded-md text-sm flex items-start gap-2 border border-amber-200 dark:border-amber-800/50">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>No active estimate version found. You must have an active baseline budget before reconciling items.</p>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Locked Variance</span>
            <span className={`font-semibold ${pendingVariance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(pendingVariance)}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Realized Value in Budget
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input 
                type="number" 
                value={realizedCost || ''}
                onChange={(e) => setRealizedCost(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={!activeVersion || isPending}
              />
            </div>
            <p className="text-xs text-slate-500">The actual amount incorporated into {activeVersion?.version_name || 'the budget'}.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Reconciliation Note
            </label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
              placeholder="e.g. Added to division 9 subcontract..."
              disabled={!activeVersion || isPending}
              required
            />
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              intent="coordination"
              disabled={!activeVersion}
              isLoading={isPending}
              loadingText="Incorporating..."
            >
              True-Up & Incorporate
            </Button>
          </div>
        </form>
    </ModalShell>
  );
}
