"use client";
import { useState, useRef, useEffect } from 'react';
import { LogOut, UserCircle } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import UserProfileModal from '@/components/dashboard/UserProfileModal';

interface UserAccountDropdownProps {
  isCollapsed?: boolean;
  direction?: 'up' | 'down';
}

export default function UserAccountDropdown({ isCollapsed = false, direction = 'up' }: UserAccountDropdownProps) {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const provider = session?.user?.app_metadata?.provider;
  const email = session?.user?.email || '';
  const currentDisplayName = session?.user?.user_metadata?.display_name || '';
  const userMetadata = session?.user?.user_metadata || {};
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking inside the profile modal
      if (isProfileModalOpen) return;
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileModalOpen]);

  const initials = (currentDisplayName || email).substring(0, 2).toUpperCase();
  const dropdownPositionClasses = direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center rounded-lg font-medium transition-all ${
            isCollapsed ? 'p-2 justify-center' : 'gap-3 px-3 py-2 text-sm w-full'
          } hover:bg-slate-800 hover:text-slate-100 text-slate-400 border border-transparent hover:border-slate-700/50`}
          title={isCollapsed ? currentDisplayName || email : undefined}
        >
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px] text-white shadow-sm"
            style={{ backgroundColor: userMetadata.default_color || '#0ea5e9' }}
          >
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
          <div className={`absolute ${dropdownPositionClasses} left-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50`}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              {provider === 'email' ? (
                <div className="flex flex-col truncate pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentDisplayName || 'No Name Set'}</span>
                  {userMetadata.job_title && (
                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">{userMetadata.job_title}</span>
                  )}
                  {userMetadata.company_name && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 truncate mt-0.5 uppercase tracking-wider">{userMetadata.company_name}</span>
                  )}
                  <span className="text-xs text-slate-400 truncate mt-1">{email}</span>
                </div>
              ) : (
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentDisplayName || 'Procore User'}</span>
                  <span className="text-xs text-slate-500 truncate">{email}</span>
                  <span className="text-[10px] mt-1 font-mono bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-1 py-0.5 rounded w-fit">Managed via Procore</span>
                </div>
              )}
            </div>
            <div className="p-2 space-y-1">
              {provider === 'email' && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 rounded-lg transition-colors"
                >
                  <UserCircle size={16} />
                  <span>Profile Settings</span>
                </button>
              )}
              
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

      <UserProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)}
        currentMeta={userMetadata}
      />
    </>
  );
}
