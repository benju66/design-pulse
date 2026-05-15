"use client";
import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client } from '@/types/models';
import { useUpdateClient } from '@/hooks/useClientQueries';

interface ClientProfileTabProps {
  client: Client;
  canEdit: boolean;
}

export function ClientProfileTab({ client, canEdit }: ClientProfileTabProps) {
  const updateClient = useUpdateClient(client.id);

  const [form, setForm] = useState({
    name: '',
    description: '',
    primary_contact_name: '',
    primary_contact_email: '',
    general_standards_url: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  const resetForm = useCallback(() => {
    setForm({
      name: client.name || '',
      description: client.description || '',
      primary_contact_name: client.primary_contact_name || '',
      primary_contact_email: client.primary_contact_email || '',
      general_standards_url: client.general_standards_url || '',
    });
    setHasChanges(false);
  }, [client]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetForm();
  }, [resetForm]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateClient.mutate(
      {
        name: form.name,
        description: form.description || null,
        primary_contact_name: form.primary_contact_name || null,
        primary_contact_email: form.primary_contact_email || null,
        general_standards_url: form.general_standards_url || null,
      },
      { onSuccess: () => setHasChanges(false) }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Client Identity */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Client Identity</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Core information about this client. Changes are saved globally and apply to all linked projects.
        </p>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Client Name</label>
              <input
                type="text"
                disabled={!canEdit}
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g. Acme Corporation"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Database ID</label>
              <input
                type="text"
                readOnly
                disabled
                value={client.id}
                className="w-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none font-mono opacity-70 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              disabled={!canEdit}
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Brief description of the client organization..."
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Contact Information</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Primary point of contact for brand standards and project coordination.
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contact Name</label>
            <input
              type="text"
              disabled={!canEdit}
              value={form.primary_contact_name}
              onChange={e => handleChange('primary_contact_name', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g. Jane Smith"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contact Email</label>
            <input
              type="email"
              disabled={!canEdit}
              value={form.primary_contact_email}
              onChange={e => handleChange('primary_contact_email', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g. jane@acme.com"
            />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">General Standards URL</label>
          <input
            type="url"
            disabled={!canEdit}
            value={form.general_standards_url}
            onChange={e => handleChange('general_standards_url', e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="https://..."
          />
          <p className="text-xs text-slate-500 mt-1">Link to the client&apos;s master design standards document.</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 mb-4">Record Metadata</h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <span className="text-slate-500">Created:</span>{' '}
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Last Updated:</span>{' '}
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {new Date(client.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Save / Discard Bar — matches ProjectSettings pattern */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 dark:border-slate-300"
          >
            <span className="text-sm font-semibold">Unsaved changes</span>
            <button
              onClick={resetForm}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
            >
              <RotateCcw size={14} /> Discard
            </button>
            <button
              onClick={handleSave}
              disabled={updateClient.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors disabled:opacity-50"
            >
              <Save size={14} /> {updateClient.isPending ? 'Saving...' : 'Save'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
