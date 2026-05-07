"use client";
import { use } from "react";
import { useClient, useClientMetrics } from "@/hooks/useClientQueries";
import { ArrowLeft, Building2, ExternalLink, Link2, Users } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import UserAccountDropdown from "@/components/layout/UserAccountDropdown";

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;
  
  const { data: client, isLoading } = useClient(clientId);
  const { data: metrics = [], isLoading: isMetricsLoading } = useClientMetrics(clientId);

  if (isLoading || !client) {
    return (
      <div className="p-8 max-w-7xl mx-auto h-full flex items-center justify-center">
        <p className="text-slate-500">Loading client data...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <Link href="/dashboard" className="text-sky-500 hover:text-sky-600 font-medium flex items-center gap-1 mb-4 w-fit">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            {client.description || 'No description provided.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="w-48">
            <UserAccountDropdown isCollapsed={false} direction="down" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Associated Projects */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users size={20} className="text-sky-500" />
              Contact Information
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Primary Contact</p>
                <p className="text-slate-800 dark:text-slate-200">{client.primary_contact_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email</p>
                <p className="text-slate-800 dark:text-slate-200">
                  {client.primary_contact_email ? (
                    <a href={`mailto:${client.primary_contact_email}`} className="text-sky-500 hover:underline">
                      {client.primary_contact_email}
                    </a>
                  ) : 'Not set'}
                </p>
              </div>
              {client.general_standards_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Global Standard Document</p>
                  <a href={client.general_standards_url} target="_blank" rel="noreferrer" className="text-sky-500 hover:underline flex items-center gap-1">
                    <Link2 size={14} /> View Document
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 size={20} className="text-sky-500" />
              Associated Projects
            </h2>
            
            {isMetricsLoading ? (
              <p className="text-slate-500 text-sm">Loading projects...</p>
            ) : metrics.length === 0 ? (
              <p className="text-slate-500 text-sm">No projects associated with this client.</p>
            ) : (
              <div className="space-y-3">
                {metrics.map(proj => (
                  <Link key={proj.project_id} href={`/project/${proj.project_id}`} className="block group">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl group-hover:border-sky-300 dark:group-hover:border-sky-800 transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-sky-500 transition-colors">{proj.name}</span>
                        <ExternalLink size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="mt-2 flex gap-4 text-xs font-mono text-slate-500">
                        <div>
                          <span className="text-slate-400">Budget: </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(proj.original_budget)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Exposure: </span>
                          <span className={proj.potential_exposure < 0 ? 'text-emerald-500' : proj.potential_exposure > 0 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(proj.potential_exposure)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Global Brand Standards Grid (Placeholder for Phase 2) */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Global Brand Standards</h2>
              <button className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                Manage Standards
              </button>
            </div>
            
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center p-12 text-center">
              <p className="text-slate-500 dark:text-slate-400 mb-2">Global Brand Standards matrix will render here.</p>
              <p className="text-slate-400 text-sm max-w-sm">This grid will allow Platform Admins to map specific requirements to CSI codes or Cost Codes across all projects for this client.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
