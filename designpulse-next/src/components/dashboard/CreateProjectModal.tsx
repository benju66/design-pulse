'use client';

import React, { useState, useEffect } from 'react';
import { useCreateProject } from '@/hooks/useProjectCoreQueries';
import { useClients } from '@/hooks/useClientQueries';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  procoreProjectId?: string;
  procoreCompanyId?: string;
}

export default function CreateProjectModal({ isOpen, onClose, procoreProjectId, procoreCompanyId }: CreateProjectModalProps) {
  const createProject = useCreateProject();
  const [isFetchingProcore, setIsFetchingProcore] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    description: '',
    project_number: '',
    client_id: ''
  });
  const { data: clients = [] } = useClients();

  // Auto-fetch and populate data when modal opens with a Procore ID
  useEffect(() => {
    if (isOpen && procoreProjectId && procoreCompanyId && !newProjectData.name) {
      const fetchProcoreData = async () => {
        setIsFetchingProcore(true);
        try {
          const res = await fetch(`/api/procore/project-details?projectId=${procoreProjectId}&companyId=${procoreCompanyId}`);
          if (res.ok) {
            const data = await res.json();
            setNewProjectData(prev => ({
              ...prev,
              name: data.name || prev.name,
              project_number: data.project_number || prev.project_number,
              description: data.description || prev.description
            }));
          }
        } catch (error) {
          console.error("Failed to auto-fill from Procore", error);
        } finally {
          setIsFetchingProcore(false);
        }
      };
      fetchProcoreData();
    }
  }, [isOpen, procoreProjectId, procoreCompanyId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectData.name.trim()) return;

    createProject.mutate({
      name: newProjectData.name.trim(),
      description: newProjectData.description.trim() || undefined,
      project_number: newProjectData.project_number.trim() || null,
      client_id: newProjectData.client_id || null,
      procore_project_id: procoreProjectId || null,
      procore_company_id: procoreCompanyId || null
    }, {
      onSuccess: () => {
        setNewProjectData({ name: '', description: '', project_number: '', client_id: '' });
        onClose();
      }
    });
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Create New Project
            {isFetchingProcore && <Loader2 className="animate-spin text-sky-500 w-5 h-5" />}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        {procoreProjectId && (
          <div className="px-6 pt-4">
            <div className="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 px-4 py-3 rounded-xl text-sm font-medium border border-sky-200 dark:border-sky-800">
              🔗 This project will be linked to Procore Project ID: <strong>{procoreProjectId}</strong>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Display Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              autoFocus
              required
              disabled={isFetchingProcore}
              value={newProjectData.name}
              onChange={e => setNewProjectData({ ...newProjectData, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow disabled:opacity-50"
              placeholder="e.g., Acme Headquarters"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project ID / Number</label>
            <input
              type="text"
              disabled={isFetchingProcore}
              value={newProjectData.project_number}
              onChange={e => setNewProjectData({ ...newProjectData, project_number: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-mono uppercase disabled:opacity-50"
              placeholder="e.g., PROJ-2026-001"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Client (Optional)</label>
            <select
              disabled={isFetchingProcore}
              value={newProjectData.client_id}
              onChange={e => setNewProjectData({ ...newProjectData, client_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow disabled:opacity-50"
            >
              <option value="">No Client Assigned</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              disabled={isFetchingProcore}
              value={newProjectData.description}
              onChange={e => setNewProjectData({ ...newProjectData, description: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow min-h-[100px] resize-none disabled:opacity-50"
              placeholder="Brief overview of the project scope..."
            />
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <Button
              variant="ghost"
              size="lg"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={!newProjectData.name.trim() || isFetchingProcore}
              isLoading={createProject.isPending}
              loadingText="Creating..."
            >
              Create Project
            </Button>
          </div>
        </form>
    </ModalShell>
  );
}
