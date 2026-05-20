'use client';

import { AlertTriangle } from 'lucide-react';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
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
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                       bg-slate-100 dark:bg-slate-800 rounded-lg
                       hover:bg-slate-200 dark:hover:bg-slate-700
                       disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white
                       bg-red-600 rounded-lg
                       hover:bg-red-700 disabled:opacity-50
                       transition-colors flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete (${count})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
