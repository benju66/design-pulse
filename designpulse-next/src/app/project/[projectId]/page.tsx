"use client";

import React, { use } from 'react';
import dynamic from 'next/dynamic';
import { useOpportunities } from '@/hooks/useOpportunityQueries';
import { useUIStore, ProjectView, SettingsTab } from '@/stores/useUIStore';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';

import { ProjectSidebar } from '@/components/layout/ProjectSidebar';
import { ProjectSettings } from '@/components/project/ProjectSettings';

// Extracted single-responsibility workspace view components
import { ValueMatrixView } from '@/components/views/ValueMatrixView';
import { BudgetLedgerView } from '@/components/views/BudgetLedgerView';
import { CoordinationView } from '@/components/views/CoordinationView';
import { DrawingsView } from '@/components/views/DrawingsView';
import { PermitsView } from '@/components/views/PermitsView';
import { LessonsLearnedView } from '@/components/views/LessonsLearnedView';
import { DeliverablesView } from '@/components/views/DeliverablesView';
import { KeyDatesView } from '@/components/views/KeyDatesView';
import { ProjectOverviewDashboard } from '@/components/project-dashboard/ProjectOverviewDashboard';

// Lazy-loaded views
const AnalyticsDashboard = dynamic(() => import('@/components/analytics/AnalyticsDashboard'));
const MyDeskDashboard = dynamic(() => import('@/components/mydesk/MyDeskDashboard'));
const VersionComparisonViewer = dynamic(
  () => import('@/components/project/VersionComparisonViewer').then(
    m => ({ default: m.VersionComparisonViewer })
  )
);
const ScenarioPlannerView = dynamic(
  () => import('@/components/views/ScenarioPlannerView').then(
    m => ({ default: m.ScenarioPlannerView })
  ),
  { ssr: false }
);

// ── Module-level navigation type guards ─────────────────────────────────────────
const VALID_PROJECT_VIEWS = new Set<ProjectView>([
  'project-overview', 'dashboard', 'dashboard-v2', 'budget-compare', 'map', 'analytics',
  'coordination', 'permits', 'deliverables', 'my-desk', 'settings', 'lessons', 'key-dates',
  'scenario-planner'
]);
function isProjectView(v: string | undefined): v is ProjectView {
  return !!v && VALID_PROJECT_VIEWS.has(v as ProjectView);
}

const VALID_SETTINGS_TABS = new Set<SettingsTab>([
  'info', 'team', 'building_areas', 'categories', 'drawings',
  'csi_specs', 'estimate', 'sidebar', 've_matrix', 'coord_matrix', 'brand_standards', 'permits',
  'packages'
]);
function isSettingsTab(v: string | undefined): v is SettingsTab {
  return !!v && VALID_SETTINGS_TABS.has(v as SettingsTab);
}

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  
  // Real-time Supabase subscription active in parent layout shell
  useProjectRealtime(projectId);

  // Read opportunities cached data for MyDesk and Analytics dashboards
  const { data: opportunities = [] } = useOpportunities(projectId);

  // ── Navigation state (persisted in Zustand) ────────────────
  const _rawView        = useUIStore(state => state.activeView[projectId]);
  const currentView: ProjectView = isProjectView(_rawView) ? _rawView : 'project-overview';
  const _setActiveView  = useUIStore(state => state.setActiveView);
  const setCurrentView  = React.useMemo(
    () => (view: ProjectView) => _setActiveView(projectId, view),
    [projectId, _setActiveView]
  );

  const _rawTab           = useUIStore(state => state.activeSettingsTab[projectId]);
  const settingsTab: SettingsTab = isSettingsTab(_rawTab) ? _rawTab : 'info';
  const _setActiveTab     = useUIStore(state => state.setActiveSettingsTab);
  const setSettingsTab    = React.useMemo(
    () => (tab: SettingsTab) => _setActiveTab(projectId, tab),
    [projectId, _setActiveTab]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* Left Sidebar Layout */}
      <ProjectSidebar 
        projectId={projectId} 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
      />

      <div className="flex flex-col flex-1 overflow-hidden relative">
        <div className="flex flex-1 overflow-hidden relative">
          
          {currentView === 'project-overview' && (
            <ProjectOverviewDashboard projectId={projectId} />
          )}

          {currentView === 'dashboard' && (
            <ValueMatrixView projectId={projectId} />
          )}

          {currentView === 'dashboard-v2' && (
            <BudgetLedgerView projectId={projectId} />
          )}

          {currentView === 'budget-compare' && (
            <div className="flex-1 overflow-hidden p-6">
              <VersionComparisonViewer projectId={projectId} />
            </div>
          )}

          {currentView === 'map' && (
            <DrawingsView projectId={projectId} />
          )}

          {currentView === 'settings' && (
            <ProjectSettings
              projectId={projectId}
              activeTab={settingsTab}
              onTabChange={setSettingsTab}
            />
          )}

          {currentView === 'analytics' && (
            <AnalyticsDashboard projectId={projectId} opportunities={opportunities} />
          )}

          {currentView === 'my-desk' && (
            <MyDeskDashboard projectId={projectId} opportunities={opportunities} />
          )}

          {currentView === 'coordination' && (
            <CoordinationView projectId={projectId} />
          )}

          {currentView === 'permits' && (
            <PermitsView projectId={projectId} />
          )}

          {currentView === 'deliverables' && (
            <DeliverablesView projectId={projectId} />
          )}

          {currentView === 'key-dates' && (
            <KeyDatesView projectId={projectId} />
          )}

          {currentView === 'lessons' && (
            <div className="flex-1 overflow-hidden">
              <LessonsLearnedView projectId={projectId} />
            </div>
          )}

          {currentView === 'scenario-planner' && (
            <ScenarioPlannerView projectId={projectId} />
          )}

        </div>
      </div>
    </div>
  );
}
