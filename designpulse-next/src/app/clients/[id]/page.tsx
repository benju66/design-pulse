"use client";
import { use, useState } from "react";
import { useClient, useClientMetrics, useBrandStandards, useClientLessons } from "@/hooks/useClientQueries";
import { ArrowLeft, User2, Layers, FileText, Building2, Lightbulb } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import UserAccountDropdown from "@/components/layout/UserAccountDropdown";
import { useIsPlatformAdmin } from "@/hooks/usePlatformAdmin";
import { ClientProfileTab } from "@/components/clients/ClientProfileTab";
import { BrandStandardsGrid } from "@/components/clients/BrandStandardsGrid";
import { ClientDocumentsTab } from "@/components/clients/ClientDocumentsTab";
import { ClientProjectsTab } from "@/components/clients/ClientProjectsTab";
import { ClientLessonsTab } from "@/components/clients/ClientLessonsTab";

type ClientTab = 'profile' | 'standards' | 'documents' | 'projects' | 'lessons_learned';

const TABS: { id: ClientTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User2 size={16} /> },
  { id: 'standards', label: 'Brand Standards', icon: <Layers size={16} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
  { id: 'projects', label: 'Projects', icon: <Building2 size={16} /> },
  { id: 'lessons_learned', label: 'Lessons Learned', icon: <Lightbulb size={16} /> },
];

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;

  // ── Data Queries (state-management shell, C24) ──────────────────────────
  const { data: client, isLoading } = useClient(clientId);
  const { data: metrics = [], isLoading: isMetricsLoading } = useClientMetrics(clientId);
  const { data: brandStandards = [] } = useBrandStandards(clientId);
  const { data: lessons = [], isLoading: isLessonsLoading } = useClientLessons(clientId);
  const { data: isPlatformAdmin, isLoading: adminLoading } = useIsPlatformAdmin();

  // ── Tab State ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ClientTab>('profile');
  const canEdit = !!isPlatformAdmin;

  // ── Loading State ───────────────────────────────────────────────────────
  if (isLoading || adminLoading || !client) {
    return (
      <div className="flex w-full h-screen bg-white dark:bg-slate-900 overflow-hidden">
        <div className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-6">
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-6" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />)}
          </div>
        </div>
        <div className="flex-1 p-8">
          <div className="max-w-[1600px] mx-auto">
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-8" />
            <div className="h-96 w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-white dark:bg-slate-900 overflow-hidden">
      {/* ── Left Sidebar ───────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col h-full">
        <div className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Back Link */}
          <Link
            href="/dashboard"
            className="text-sky-500 hover:text-sky-600 font-medium flex items-center gap-1 text-sm mb-2"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>

          {/* Client Name */}
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={client.name}>
              {client.name}
            </h2>
            {client.description && (
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{client.description}</p>
            )}
          </div>

          {/* Tab Navigation */}
          <nav className="space-y-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400'
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-sky-500' : 'text-slate-400'}>{tab.icon}</span>
                {tab.label}
                {tab.id === 'standards' && brandStandards.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                    {brandStandards.length}
                  </span>
                )}
                {tab.id === 'projects' && metrics.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                    {metrics.length}
                  </span>
                )}
                {tab.id === 'lessons_learned' && lessons.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                    {lessons.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Admin Badge */}
        {isPlatformAdmin && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Platform Admin
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Header Bar */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 px-8 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {TABS.find(t => t.id === activeTab)?.label}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="w-48">
              <UserAccountDropdown isCollapsed={false} direction="down" />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          <div className="max-w-[1600px] mx-auto pb-24">
            {activeTab === 'profile' && (
              <ClientProfileTab client={client} canEdit={canEdit} />
            )}
            {activeTab === 'standards' && (
              <BrandStandardsGrid clientId={clientId} canEdit={canEdit} />
            )}
            {activeTab === 'documents' && (
              <ClientDocumentsTab
                clientId={clientId}
                canEdit={canEdit}
                brandStandards={brandStandards}
              />
            )}
            {activeTab === 'projects' && (
              <ClientProjectsTab
                metrics={metrics}
                isLoading={isMetricsLoading}
              />
            )}
            {activeTab === 'lessons_learned' && (
              <ClientLessonsTab lessons={lessons} isLoading={isLessonsLoading} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
