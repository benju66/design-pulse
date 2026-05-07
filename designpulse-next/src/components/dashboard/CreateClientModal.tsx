import React, { useState } from 'react';
import { useCreateClient } from '@/hooks/useClientQueries';
import { X } from 'lucide-react';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateClientModal({ isOpen, onClose }: CreateClientModalProps) {
  const createClient = useCreateClient();
  const [newClientData, setNewClientData] = useState({
    name: '',
    description: '',
    primary_contact_name: '',
    primary_contact_email: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientData.name.trim()) return;

    createClient.mutate({
      name: newClientData.name.trim(),
      description: newClientData.description.trim() || undefined,
      primary_contact_name: newClientData.primary_contact_name.trim() || null,
      primary_contact_email: newClientData.primary_contact_email.trim() || null,
    }, {
      onSuccess: () => {
        setNewClientData({ name: '', description: '', primary_contact_name: '', primary_contact_email: '' });
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Add New Client
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Client Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              autoFocus
              required
              value={newClientData.name}
              onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow"
              placeholder="e.g., Acme Corporation"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              value={newClientData.description}
              onChange={e => setNewClientData({ ...newClientData, description: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow min-h-[100px] resize-none"
              placeholder="Brief overview of the client..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Primary Contact</label>
              <input
                type="text"
                value={newClientData.primary_contact_name}
                onChange={e => setNewClientData({ ...newClientData, primary_contact_name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow"
                placeholder="Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={newClientData.primary_contact_email}
                onChange={e => setNewClientData({ ...newClientData, primary_contact_email: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow"
                placeholder="Email Address"
              />
            </div>
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
              disabled={createClient.isPending || !newClientData.name.trim()}
              className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {createClient.isPending ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
