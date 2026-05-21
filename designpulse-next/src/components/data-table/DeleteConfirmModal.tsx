'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';

/**
 * Shared delete confirmation modal for DataTable grids.
 * Pixel-identical across all three tables — pure extraction.
 */

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  count: number;
  /** Entity name displayed in the modal (e.g., "Items", "Tasks", "Permits") */
  entityName: string;
  /** Optional custom warning description */
  description?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  count,
  entityName,
  description,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="sm">
      {/* Modal */}
      <div className="p-6">
        {/* Warning icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Delete {count} {entityName}?
          </h3>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {description ??
            `This action cannot be undone. ${count} ${entityName.toLowerCase()} will be permanently removed.`}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            isLoading={isDeleting}
            loadingText="Deleting..."
          >
            {`Delete (${count})`}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
