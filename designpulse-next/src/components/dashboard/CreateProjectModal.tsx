import React, { useState } from 'react';
import { useCreateProject } from '@/hooks/useProjectQueries';
import { X } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  procoreProjectId?: string;
  procoreCompanyId?: string;
}

export default function CreateProjectModal({ isOpen, onClose, procoreProjectId, procoreCompanyId }: CreateProjectModalProps) {
  const createProject = useCreateProject();
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    description: '',
    project_number: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectData.name.trim()) return;

    createProject.mutate({
      name: newProjectData.name.trim(),
      description: newProjectData.description.trim() || undefined,
      project_number: newProjectData.project_number.trim() || null,
      procore_project_id: procoreProjectId || null,
      procore_company_id: procoreCompanyId || null
    }, {
      onSuccess: () => {
        setNewProjectData({ name: '', description: '', project_number: '' });
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create New Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={24} />
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              autoFocus
              required
              value={newProjectData.name}
              onChange={e => setNewProjectData({ ...newProjectData, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow"
              placeholder="e.g., Acme Headquarters"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project ID / Number</label>
            <input
              type="text"
              value={newProjectData.project_number}
              onChange={e => setNewProjectData({ ...newProjectData, project_number: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-mono uppercase"
              placeholder="e.g., PROJ-2026-001"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              value={newProjectData.description}
              onChange={e => setNewProjectData({ ...newProjectData, description: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow min-h-[100px] resize-none"
              placeholder="Brief overview of the project scope..."
            />
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProject.isPending || !newProjectData.name.trim()}
              className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
