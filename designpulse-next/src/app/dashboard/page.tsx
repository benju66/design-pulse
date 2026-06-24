"use client";
import { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Settings, X, Briefcase, LayoutGrid, List, AlertTriangle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useProjects } from '@/hooks/useProjectCoreQueries';
import { useGlobalLessons } from '@/hooks/useLessonQueries';
import { useIsPlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useUserProjectMembers } from '@/hooks/useGlobalQueries';
import { useAuth } from '@/providers/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import GlobalSettingsModal from '@/components/dashboard/GlobalSettingsModal';
import CreateProjectModal from '@/components/dashboard/CreateProjectModal';
import CreateClientModal from '@/components/dashboard/CreateClientModal';
import UserAccountDropdown from '@/components/layout/UserAccountDropdown';
import { useUIStore, DashboardViewMode } from '@/stores/useUIStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useClients } from '@/hooks/useClientQueries';
import ProjectCardGrid from '@/components/dashboard/ProjectCardGrid';
import ProjectList from '@/components/dashboard/ProjectList';
import ClientCardGrid from '@/components/dashboard/ClientCardGrid';
import ClientListTable from '@/components/dashboard/ClientListTable';
import GlobalLessonsTable from '@/components/dashboard/GlobalLessonsTable';

const VALID_DASHBOARD_MODES = new Set<DashboardViewMode>(['card', 'table']);

function isDashboardMode(v: string | undefined): v is DashboardViewMode {
  return !!v && VALID_DASHBOARD_MODES.has(v as DashboardViewMode);
}

export default function DashboardPage() {
  const { data: projects = [], isLoading: isProjectsLoading } = useProjects();
  const { data: clients = [], isLoading: isClientsLoading, isError: isClientsError } = useClients();
  const { data: isSuperAdmin, isLoading: isAuthLoading } = useIsPlatformAdmin();
  const { session } = useAuth();
  const { data: myMemberships = [], isLoading: isMembershipsLoading } = useUserProjectMembers(session?.user?.id || null);
  
  const rawViewMode = useUIStore(s => s.dashboardViewMode);
  const setDashboardViewMode = useUIStore(s => s.setDashboardViewMode);
  const dashboardViewMode = isDashboardMode(rawViewMode) ? rawViewMode : 'card';

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [procoreLinkData, setProcoreLinkData] = useState<{ projectId: string, companyId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'clients' | 'lessons'>('projects');

  // Lazy: only fetch the cross-project lessons rollup once the Lessons tab is opened.
  const { data: lessons = [], isLoading: isLessonsLoading } = useGlobalLessons(activeTab === 'lessons');

  const isGcAdminAnywhere = myMemberships.some(m => m.role === 'gc_admin');
  const canAccessSettings = isSuperAdmin || isGcAdminAnywhere;
  const isGlobalAuthLoading = isAuthLoading || isMembershipsLoading;

  const visibleProjects = useMemo(() => {
    if (isSuperAdmin) return projects.filter(p => !p.is_archived);
    const assignedProjectIds = new Set(myMemberships.map(m => m.project_id));
    return projects.filter(p => !p.is_archived && assignedProjectIds.has(p.id));
  }, [projects, isSuperAdmin, myMemberships]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('link_procore_project');
      const companyId = params.get('link_procore_company');
      
      if (projectId && companyId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProcoreLinkData({ projectId, companyId });
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Manage your project portfolio and global client standards.
          </p>
        </div>
        <div className="flex items-center gap-4 h-11">
          <ThemeToggle />
          
          <div className="w-48">
            <UserAccountDropdown isCollapsed={false} direction="down" />
          </div>

          {isGlobalAuthLoading ? (
            <>
              <div className="w-[150px] h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
              <div className="w-[180px] h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
            </>
          ) : (
            <>
              {canAccessSettings && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Global Settings & Master Data"
                >
                  <Settings size={20} />
                  <span className="hidden sm:inline">Global Settings</span>
                </Button>
              )}
              {isSuperAdmin && activeTab === 'projects' && (
                <Button
                  size="lg"
                  onClick={() => setIsCreateProjectModalOpen(true)}
                >
                  <Plus size={20} />
                  <span className="hidden sm:inline">New Project</span>
                  <span className="sm:hidden">New</span>
                </Button>
              )}
              {isSuperAdmin && activeTab === 'clients' && (
                <Button
                  size="lg"
                  onClick={() => setIsCreateClientModalOpen(true)}
                >
                  <Plus size={20} />
                  <span className="hidden sm:inline">New Client</span>
                  <span className="sm:hidden">New</span>
                </Button>
              )}
            </>
          )}
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
              {/* eslint-disable-next-line react/no-unescaped-entities */}
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
        isOpen={isCreateProjectModalOpen} 
        onClose={() => setIsCreateProjectModalOpen(false)} 
        procoreProjectId={procoreLinkData?.projectId}
        procoreCompanyId={procoreLinkData?.companyId}
      />
      <CreateClientModal
        isOpen={isCreateClientModalOpen}
        onClose={() => setIsCreateClientModalOpen(false)}
      />

      {/* Segmented Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'projects' 
                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building2 size={16} />
            Projects
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'clients'
                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Briefcase size={16} />
            Clients
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'lessons'
                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Lightbulb size={16} />
            Lessons
          </button>
        </div>

        {/* Card/Table toggle — N/A for the Lessons rollup (table only). */}
        <div className={`flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit ${activeTab === 'lessons' ? 'invisible' : ''}`}>
          <button
            onClick={() => setDashboardViewMode('card')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              dashboardViewMode === 'card' 
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={16} />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            onClick={() => setDashboardViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              dashboardViewMode === 'table' 
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <List size={16} />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={`${activeTab}-${dashboardViewMode}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          layout
          className="flex-1"
        >
          {activeTab === 'lessons' ? (
            <GlobalLessonsTable lessons={lessons} isLoading={isLessonsLoading} />
          ) : activeTab === 'projects' ? (
            isProjectsLoading ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 py-12">
                Loading projects...
              </div>
            ) : dashboardViewMode === 'card' ? (
              <ProjectCardGrid
                projects={visibleProjects}
                isSuperAdmin={isSuperAdmin}
                onOpenCreateProject={() => setIsCreateProjectModalOpen(true)}
              />
            ) : (
              <ProjectList
                projects={visibleProjects}
                isSuperAdmin={isSuperAdmin}
                onOpenCreateProject={() => setIsCreateProjectModalOpen(true)}
              />
            )
          ) : (
            isClientsLoading ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 py-12">
                Loading clients...
              </div>
            ) : isClientsError ? (
              <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-rose-300 dark:border-rose-700 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20">
                <AlertTriangle size={48} className="text-rose-400 dark:text-rose-500 mb-4" />
                <p className="text-rose-600 dark:text-rose-400 mb-2 text-lg font-semibold">Failed to load clients</p>
                <p className="text-slate-500 text-sm">Check your connection and try refreshing the page.</p>
              </div>
            ) : dashboardViewMode === 'card' ? (
              <ClientCardGrid clients={clients} />
            ) : (
              <ClientListTable clients={clients} />
            )
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

