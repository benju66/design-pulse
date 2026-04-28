"use client";
import { useState, useRef, useEffect } from 'react';
import { LogOut, Check, X } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserAccountDropdownProps {
  isCollapsed?: boolean;
}

export default function UserAccountDropdown({ isCollapsed = false }: UserAccountDropdownProps) {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const queryClient = useQueryClient();
  const provider = session?.user?.app_metadata?.provider;
  const email = session?.user?.email || '';
  const currentDisplayName = session?.user?.user_metadata?.display_name || '';
  
  const [editName, setEditName] = useState(currentDisplayName);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: editName.trim() }
      });
      if (error) throw error;
      
      // Crucial constraint: invalidate system_users cache
      queryClient.invalidateQueries({ queryKey: ['system_users'] });
      
      toast.success('Display name updated');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(`Failed to update name: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (currentDisplayName || email).substring(0, 2).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center rounded-lg font-medium transition-all ${
          isCollapsed ? 'p-2 justify-center' : 'gap-3 px-3 py-2 text-sm w-full'
        } hover:bg-slate-800 hover:text-slate-100 text-slate-400 border border-transparent hover:border-slate-700/50`}
        title={isCollapsed ? currentDisplayName || email : undefined}
      >
        <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
          {initials}
        </div>
        {!isCollapsed && (
          <div className="flex flex-col items-start truncate overflow-hidden">
            <span className="text-slate-200 truncate w-full text-left">{currentDisplayName || 'No Name Set'}</span>
            <span className="text-[10px] text-slate-500 truncate w-full text-left">{email}</span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            {provider === 'email' ? (
              isEditing ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Display Name</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                      placeholder="Enter your name"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                      autoFocus
                    />
                    <button 
                      onClick={handleSaveName}
                      disabled={isSaving}
                      className="bg-sky-500 hover:bg-sky-600 text-white rounded-md p-1.5 flex items-center justify-center shrink-0 disabled:opacity-50"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => { setIsEditing(false); setEditName(currentDisplayName); }}
                      className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-md p-1.5 flex items-center justify-center shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start group">
                  <div className="flex flex-col truncate pr-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentDisplayName || 'No Name Set'}</span>
                    <span className="text-xs text-slate-500 truncate">{email}</span>
                  </div>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-sky-500 hover:text-sky-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )
            ) : (
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentDisplayName || 'Procore User'}</span>
                <span className="text-xs text-slate-500 truncate">{email}</span>
                <span className="text-[10px] mt-1 font-mono bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-1 py-0.5 rounded w-fit">Managed via Procore</span>
              </div>
            )}
          </div>
          <div className="p-2">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
