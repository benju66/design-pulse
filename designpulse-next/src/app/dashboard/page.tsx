"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Plus, ArrowRight, Settings, LogOut, X } from 'lucide-react';
import { useProjects } from '@/hooks/useProjectQueries';
import { useIsPlatformAdmin } from '@/hooks/usePlatformAdmin';
import { ThemeToggle } from '@/components/ThemeToggle';
import GlobalSettingsModal from '@/components/dashboard/GlobalSettingsModal';
import CreateProjectModal from '@/components/dashboard/CreateProjectModal';
import { supabase } from '@/supabaseClient';

export default function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: isSuperAdmin, isLoading: isAuthLoading } = useIsPlatformAdmin();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [procoreLinkData, setProcoreLinkData] = useState<{ projectId: string, companyId: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('link_procore_project');
      const companyId = params.get('link_procore_company');
      
      if (projectId && companyId) {
        setProcoreLinkData({ projectId, companyId });
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Design Pulse Projects</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Select a project to view its VE tracker and interactive floor plans.
          </p>
        </div>
        <div className="flex items-center gap-4 h-11">
          <ThemeToggle />
          
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-900/30 text-slate-500 hover:text-rose-500 w-10 h-10 rounded-xl transition-colors shadow-sm"
            title="Log out"
          >
            <LogOut size={18} />
          </button>

          {isAuthLoading ? (
            <>
              <div className="w-[150px] h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
              <div className="w-[180px] h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
            </>
          ) : isSuperAdmin ? (
            <>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 h-10 rounded-xl font-bold transition-colors shadow-sm"
                title="Global Settings & Master Data"
              >
                <Settings size={20} />
                <span className="hidden sm:inline">Global Settings</span>
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-5 h-10 rounded-xl font-bold transition-colors shadow-sm"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">New Project</span>
                <span className="sm:hidden">New</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
      
      {procoreLinkData && (
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-4 rounded-2xl mb-8 flex items-start justify-between">
          <div>
            <h3 className="text-sky-800 dark:text-sky-300 font-bold flex items-center gap-2">
              <Building2 size={18} />
              Procore Account Linked
            </h3>
            <p className="text-sky-600 dark:text-sky-400 text-sm mt-1">
              Your Procore login was successful. To complete the setup, either create a <strong>New Project</strong> below, or open an existing project's settings to manually apply the link.
            </p>
          </div>
          <button onClick={() => setProcoreLinkData(null)} className="text-sky-400 hover:text-sky-600">
            <X size={20} />
          </button>
        </div>
      )}

      <GlobalSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <CreateProjectModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        procoreProjectId={procoreLinkData?.projectId}
        procoreCompanyId={procoreLinkData?.companyId}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Loading projects...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
          {projects.filter(p => !p.is_archived).map(project => (
            <Link key={project.id} href={`/project/${project.id}`}>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-700 transition-all group cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className="bg-sky-100 dark:bg-sky-900/30 p-3.5 rounded-xl text-sky-600 dark:text-sky-400">
                    <Building2 size={26} strokeWidth={1.5} />
                  </div>
                  <ArrowRight className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" size={22} />
                </div>
                {project.project_number && (
                  <div className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md w-fit mb-2">
                    {project.project_number}
                  </div>
                )}
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">
                  {project.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-auto line-clamp-2">
                  {project.description || 'No description provided.'}
                </p>
              </div>
            </Link>
          ))}
          
          {/* Empty State Fallback */}
          {projects.filter(p => !p.is_archived).length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <Building2 size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-4 text-lg">No projects found.</p>
              {isSuperAdmin && (
                <button 
                  onClick={() => setIsCreateModalOpen(true)} 
                  className="text-sky-500 font-bold hover:underline"
                >
                  Spin up your first sandbox project
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
