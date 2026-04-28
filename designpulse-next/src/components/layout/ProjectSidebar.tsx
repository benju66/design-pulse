"use client";
import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Settings, ChevronLeft, ChevronRight, Home, LogOut } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useProjectSettings } from '@/hooks/useProjectQueries';
import { DEFAULT_SIDEBAR_ITEMS } from '@/lib/constants';
import { SidebarItem } from '@/types/models';
import { supabase } from '@/supabaseClient';

interface ProjectSidebarProps {
  projectId: string;
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const ProjectSidebar = ({ projectId, currentView, setCurrentView }: ProjectSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: settings } = useProjectSettings(projectId);
  
  const viewItems = (settings?.sidebar_items as unknown as SidebarItem[]) || (DEFAULT_SIDEBAR_ITEMS as unknown as SidebarItem[]);
  
  // Merge missing default views dynamically (e.g. newly added features)
  const mergedItems = [...viewItems];
  DEFAULT_SIDEBAR_ITEMS.forEach(defaultItem => {
    if (!mergedItems.find(i => i.id === defaultItem.id)) {
      mergedItems.push({ ...defaultItem } as SidebarItem);
    }
  });

  const activeViewItems = mergedItems.filter((item: SidebarItem) => item.visible);

  return (
    <div 
      className={`${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 border-r border-slate-800 select-none relative z-50`}
    >
      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 z-10 transition-colors"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={`p-4 border-b border-slate-800 flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center justify-between w-full ${isCollapsed ? 'flex-col gap-4' : ''}`}>
          <h1 className={`font-bold text-white flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 text-xl'}`}>
            <div className="w-6 h-6 bg-sky-500 rounded-md shrink-0"></div>
            {!isCollapsed && <span>Design Pulse</span>}
          </h1>
          <Link 
            href="/dashboard"
            className="text-slate-400 hover:text-white transition-colors flex shrink-0 items-center justify-center p-1 rounded-md hover:bg-slate-800"
            title="Back to Projects Dashboard"
          >
            <Home size={18} />
          </Link>
        </div>
        {!isCollapsed && (
          <div className="mt-2 text-xs font-mono text-slate-500 bg-slate-950/50 px-2 py-1 rounded inline-block self-start">
            PRJ: {projectId}
          </div>
        )}
      </div>
      
      <div className={`flex-1 py-4 flex flex-col gap-1 overflow-y-auto ${isCollapsed ? 'px-2 items-center' : 'px-3'}`}>
        {!isCollapsed ? (
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 pl-1 mt-2">Views</h3>
        ) : (
          <div className="w-full h-px bg-slate-800 my-2" />
        )}
        
        {activeViewItems.map(item => {
          const Icon = (LucideIcons as any)[item.iconName] || LucideIcons.Square;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center rounded-lg font-medium transition-all ${
                isCollapsed ? 'p-2 justify-center' : 'gap-3 px-3 py-2 text-sm'
              } ${
                isActive 
                  ? 'bg-sky-500 text-white shadow-sm' 
                  : 'hover:bg-slate-800 hover:text-slate-100 text-slate-400'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          )
        })}

        {!isCollapsed ? (
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 pl-1 mt-6">Configuration</h3>
        ) : (
          <div className="w-full h-px bg-slate-800 my-4" />
        )}

        <button
          onClick={() => setCurrentView('settings')}
          title={isCollapsed ? 'Project Settings' : undefined}
          className={`flex items-center rounded-lg font-medium transition-all ${
            isCollapsed ? 'p-2 justify-center' : 'gap-3 px-3 py-2 text-sm'
          } ${
            currentView === 'settings'
              ? 'bg-sky-500 text-white shadow-sm' 
              : 'hover:bg-slate-800 hover:text-slate-100 text-slate-400'
          }`}
        >
          <Settings size={18} className="shrink-0" />
          {!isCollapsed && <span>Project Settings</span>}
        </button>
      </div>

      <div className={`p-4 border-t border-slate-800 mt-auto flex flex-col gap-4 bg-slate-950/30`}>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          title={isCollapsed ? 'Log out' : undefined}
          className={`flex items-center rounded-lg font-medium transition-all ${
            isCollapsed ? 'p-2 justify-center' : 'gap-3 px-3 py-2 text-sm'
          } hover:bg-rose-500/10 hover:text-rose-400 text-slate-400`}
        >
          <LogOut size={18} className="shrink-0" />
          {!isCollapsed && <span>Log out</span>}
        </button>

        <div className={`flex items-center border-t border-slate-800/50 pt-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && <span className="text-xs font-medium text-slate-400">Theme Preference</span>}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};
