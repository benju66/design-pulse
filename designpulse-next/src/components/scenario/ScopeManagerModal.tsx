'use client';

import { useState } from 'react';
import { ModalShell } from '@/components/ui/ModalShell';
import { Button } from '@/components/ui/Button';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useProjectSettings, useUpdateProjectSettings } from '@/hooks/useProjectCoreQueries';
import type { PackageScopeConfig } from '@/types/models';
import { toast } from 'sonner';

interface ScopeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export function ScopeManagerModal({
  isOpen,
  onClose,
  projectId,
}: ScopeManagerModalProps) {
  const { data: settings } = useProjectSettings(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);
  const scopes: PackageScopeConfig[] = settings?.package_scopes ?? [];

  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const updated = [
      ...scopes,
      { id: crypto.randomUUID(), label: newLabel.trim() },
    ];
    updateSettings.mutate(
      { package_scopes: updated as any },
      {
        onSuccess: () => {
          setNewLabel('');
          toast.success('Scope added');
        },
      }
    );
  };

  const handleRename = (id: string) => {
    if (!editLabel.trim()) return;
    const updated = scopes.map(s =>
      s.id === id ? { ...s, label: editLabel.trim() } : s
    );
    updateSettings.mutate(
      { package_scopes: updated as any },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success('Scope renamed');
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    const updated = scopes.filter(s => s.id !== id);
    updateSettings.mutate(
      { package_scopes: updated as any },
      { onSuccess: () => toast.success('Scope deleted') }
    );
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Manage Package Scopes</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Package scopes organize VE packages by category (e.g., &quot;Interior&quot;, &quot;Exterior&quot;, &quot;MEP&quot;).
        </p>

        {/* Existing scopes */}
        <div className="space-y-2">
          {scopes.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">
              No scopes configured. Add one below.
            </div>
          ) : (
            scopes.map(scope => (
              <div
                key={scope.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <Tag size={14} className="text-slate-400 shrink-0" />
                {editingId === scope.id ? (
                  <input
                    type="text"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(scope.id)}
                    className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{scope.label}</span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === scope.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRename(scope.id)}
                      disabled={updateSettings.isPending}
                    >
                      Save
                    </Button>
                  ) : (
                    <button
                      onClick={() => { setEditingId(scope.id); setEditLabel(scope.label); }}
                      className="p-1 text-slate-400 hover:text-sky-500 transition-colors"
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(scope.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Delete scope"
                    disabled={updateSettings.isPending}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add new scope */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="New scope name…"
            className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            disabled={!newLabel.trim() || updateSettings.isPending}
          >
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
