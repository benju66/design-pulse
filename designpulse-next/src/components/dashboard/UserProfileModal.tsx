import React, { useState, useEffect } from 'react';
import { X, Check, Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';
import { supabase } from '@/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMeta: {
    display_name?: string;
    company_name?: string;
    job_title?: string;
    default_color?: string;
  };
}

const PRESET_COLORS = [
  '#0ea5e9', // sky-500
  '#f43f5e', // rose-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#6366f1', // indigo-500
  '#d946ef', // fuchsia-500
  '#8b5cf6', // violet-500
  '#14b8a6', // teal-500
];

export default function UserProfileModal({ isOpen, onClose, currentMeta }: UserProfileModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    display_name: '',
    company_name: '',
    job_title: '',
    default_color: '#0ea5e9'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        display_name: currentMeta.display_name || '',
        company_name: currentMeta.company_name || '',
        job_title: currentMeta.job_title || '',
        default_color: currentMeta.default_color || '#0ea5e9'
      });
    }
  }, [isOpen, currentMeta]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.display_name.trim()) {
      toast.error('Display Name is required');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: formData.display_name.trim(),
          company_name: formData.company_name.trim(),
          job_title: formData.job_title.trim(),
          default_color: formData.default_color
        }
      });
      if (error) throw error;
      
      // Invalidate queries so admin directory updates if necessary
      queryClient.invalidateQueries({ queryKey: ['system_users'] });
      
      toast.success('Profile updated successfully');
      onClose();
    } catch (err: any) {
      toast.error(`Failed to update profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="sm" nested>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Account Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
          {/* Display Name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Display Name <span className="text-rose-500">*</span></label>
            <input 
              type="text" 
              value={formData.display_name}
              onChange={e => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              placeholder="e.g. John Doe"
              required
            />
          </div>

          {/* Job Title */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Job Title</label>
            <input 
              type="text" 
              value={formData.job_title}
              onChange={e => setFormData({ ...formData, job_title: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              placeholder="e.g. Senior Architect"
            />
          </div>

          {/* Company Name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Company Name</label>
            <input 
              type="text" 
              value={formData.company_name}
              onChange={e => setFormData({ ...formData, company_name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              placeholder="e.g. Acme Construction"
            />
          </div>

          {/* Default Color */}
          <div className="flex flex-col gap-3 mt-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Paintbrush size={16} className="text-slate-400" />
              Markup & Pin Color
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              This color represents you on the canvas and in activity feeds.
            </p>
            
            <div className="flex flex-wrap gap-3 mt-1">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, default_color: color })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                    formData.default_color?.toLowerCase() === color.toLowerCase() 
                      ? 'border-slate-900 dark:border-white scale-110 shadow-md' 
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {formData.default_color?.toLowerCase() === color.toLowerCase() && (
                    <Check size={14} className="text-white drop-shadow-md" strokeWidth={3} />
                  )}
                </button>
              ))}
              
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 shrink-0">
                  <input 
                    type="color" 
                    value={formData.default_color}
                    onChange={e => setFormData({ ...formData, default_color: e.target.value })}
                    className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                    title="Custom Color"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-6 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              isLoading={isSaving}
              loadingText="Saving..."
              className="min-w-[100px]"
            >
              Save Changes
            </Button>
          </div>
        </form>
    </ModalShell>
  );
}
